
// Data Collection Service
// This edge function collects AI-related content from Twitter API

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import axiod from "https://deno.land/x/axiod@0.26.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle CORS preflight requests
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const environmentVariables = Deno.env.toObject();
  const supabaseUrl = environmentVariables.SUPABASE_URL || '';
  const supabaseAnonKey = environmentVariables.SUPABASE_ANON_KEY || '';
  const twitterBearerToken = environmentVariables.TWITTER_BEARER_TOKEN || '';
  const upstashRedisUrl = environmentVariables.UPSTASH_REDIS_REST_URL || '';
  const upstashRedisToken = environmentVariables.UPSTASH_REDIS_REST_TOKEN || '';
  
  // Validate required environment variables
  if (!twitterBearerToken) {
    console.error("Missing TWITTER_BEARER_TOKEN environment variable");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
  
  if (!upstashRedisUrl || !upstashRedisToken) {
    console.error("Missing Upstash Redis configuration variables");
    return new Response(
      JSON.stringify({ error: "Redis configuration error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting data collection process...");
    
    console.log("Collecting Twitter data immediately...");
    
    // Collect data from Twitter API
    const twitterContent = await fetchFromTwitter(twitterBearerToken);
    
    console.log("Twitter content collected, length:", twitterContent.length);
    
    // Store collected data in Supabase
    const { data, error } = await supabase
      .from('collected_content')
      .insert([{ twitter_data: twitterContent }]);
      
    if (error) {
      console.error("Error storing data in Supabase:", error);
      return new Response(
        JSON.stringify({ error: "Failed to store collected data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    // Increment the Redis counter for context updates
    let dataCollectionCounter = 1;
    try {
      // Increment counter using Upstash Redis REST API
      const incrementResponse = await fetch(`${upstashRedisUrl}/incr/data_collection_counter`, {
        headers: {
          Authorization: `Bearer ${upstashRedisToken}`
        }
      });
      
      if (!incrementResponse.ok) {
        throw new Error(`Redis increment failed: ${incrementResponse.statusText}`);
      }
      
      const incrementResult = await incrementResponse.json();
      dataCollectionCounter = incrementResult.result;
      console.log(`Data collection counter incremented to: ${dataCollectionCounter}`);
      
      // Check if we need to update medium-term context (after 48 cycles ≈ 4 days)
      if (dataCollectionCounter >= 48) {
        console.log("Triggering medium-term context update...");
        
        // Reset counter in Redis
        const resetResponse = await fetch(`${upstashRedisUrl}/set/data_collection_counter/0`, {
          headers: {
            Authorization: `Bearer ${upstashRedisToken}`
          }
        });
        
        if (!resetResponse.ok) {
          throw new Error(`Redis reset failed: ${resetResponse.statusText}`);
        }
        
        console.log("Data collection counter reset to 0");
        
        // You would trigger your context management service here
        // For now we'll just log it
        console.log("Medium-term context update would be triggered here");
      }
    } catch (redisError) {
      console.error("Error managing Redis counter:", redisError);
      // Continue execution - counter errors shouldn't stop the main flow
    }
    
    console.log("Data collection completed successfully");
    return new Response(
      JSON.stringify({ success: true, message: "Data collection completed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Data collection failed:", error);
    return new Response(
      JSON.stringify({ error: "Data collection failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to fetch data from Twitter API
async function fetchFromTwitter(bearerToken: string): Promise<string> {
  console.log("Fetching data from Twitter API...");
  
  // Base URL for Twitter API v2
  const API_BASE_URL = 'https://api.twitter.com/2';
  
  // Calculate time 24 hours ago
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // List of user IDs to fetch tweets from (smaller set to debug)
  const userIds = [
    1353836358901501952, 4398626122, 1963466798, 3448284313, 6681172
  ];
  
  // List of keywords/phrases (smaller set to debug)
  const keywords = [
    'LLM', 'ChatGPT', 'AI', 'OpenAI', 'Mistral AI', 'Claude', 'Gemini'
  ];
  
  // Combined array for all tweets
  let allTweets: string[] = [];
  
  // Function to fetch tweets from a single user ID, excluding retweets and replies
  async function fetchTweetsFromUser(userId: number): Promise<void> {
    try {
      console.log(`Fetching tweets for user ${userId}...`);
      const response = await axiod.get(`${API_BASE_URL}/users/${userId}/tweets`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        params: {
          start_time: twentyFourHoursAgo,
          'tweet.fields': 'created_at',
          max_results: 10, // reduced for debugging
          exclude: 'retweets,replies',
        },
      });
      
      if (response.data && response.data.data) {
        const tweets = response.data.data || [];
        console.log(`Found ${tweets.length} tweets for user ${userId}`);
        tweets.forEach((tweet: any) => allTweets.push(`[User ${userId}] ${tweet.text}`));
      } else {
        console.log(`No tweets found for user ${userId}`);
      }
    } catch (error) {
      console.error(`Error fetching tweets for user ${userId}:`, error.message);
      // Don't throw, just log and continue with other users
    }
  }
  
  // Function to fetch tweets by keywords
  async function fetchTweetsByKeywords(keyword: string): Promise<void> {
    try {
      console.log(`Searching tweets for keyword "${keyword}"...`);
      const query = `${keyword} -is:retweet min_faves:10`;
      
      const response = await axiod.get(`${API_BASE_URL}/tweets/search/recent`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        params: {
          query: query,
          start_time: twentyFourHoursAgo,
          'tweet.fields': 'public_metrics',
          max_results: 10, // reduced for debugging
        },
      });
      
      if (response.data && response.data.data) {
        const tweets = response.data.data || [];
        console.log(`Found ${tweets.length} tweets for keyword "${keyword}"`);
        tweets.forEach((tweet: any) => {
          const likeCount = tweet.public_metrics?.like_count || 0;
          allTweets.push(`[Keyword: ${keyword}] ${tweet.text} (Likes: ${likeCount})`);
        });
      } else {
        console.log(`No tweets found for keyword "${keyword}"`);
      }
    } catch (error) {
      console.error(`Error searching keyword "${keyword}":`, error.message);
      // Don't throw, just log and continue with other keywords
    }
  }
  
  try {
    // Step 1: Fetch tweets from user IDs one by one
    console.log(`Fetching tweets from ${userIds.length} users...`);
    for (const userId of userIds) {
      await fetchTweetsFromUser(userId);
    }
    
    // Step 2: Fetch tweets by keywords one by one
    console.log(`Searching tweets for ${keywords.length} keywords...`);
    for (const keyword of keywords) {
      await fetchTweetsByKeywords(keyword);
    }
    
    console.log(`Total tweets collected: ${allTweets.length}`);
    
    if (allTweets.length === 0) {
      return "No tweets found in the last 24 hours matching the criteria.";
    }
    
    // Format the tweets into a single string
    return allTweets.join('\n\n');
  } catch (error) {
    console.error('Error in fetchFromTwitter:', error);
    throw new Error(`Failed to fetch Twitter data: ${error.message}`);
  }
}

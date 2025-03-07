
// Data Collection Service for User IDs
// This edge function collects AI-related content from Twitter user timelines

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
    console.log("Starting user timeline data collection process...");
    
    // Collect data from Twitter API
    const twitterContent = await fetchFromTwitterUsers(twitterBearerToken);
    
    // Process and standardize the collected data
    const processedContent = {
      twitter_data: twitterContent,
      created_at: new Date().toISOString()
    };
    
    // Store collected data in Supabase
    const { data, error } = await supabase
      .from('collected_content')
      .insert([processedContent]);
      
    if (error) {
      console.error("Error storing user data in Supabase:", error);
      return new Response(
        JSON.stringify({ error: "Failed to store collected user data" }),
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
    
    console.log("User timeline data collection completed successfully");
    return new Response(
      JSON.stringify({ success: true, message: "User timeline data collection completed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("User timeline data collection failed:", error);
    return new Response(
      JSON.stringify({ error: "User timeline data collection failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to fetch data from Twitter user timelines
async function fetchFromTwitterUsers(bearerToken: string): Promise<string> {
  console.log("Fetching data from Twitter user timelines...");
  
  // Base URL for Twitter API v2
  const API_BASE_URL = 'https://api.twitter.com/2';
  
  // Calculate time 48 hours ago (updated from 24 to 48 hours)
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  
  // List of 15 user IDs (reduced for debugging)
  const userIds = [
      1353836358901501952, 1599587232175849472, 1605, 4398626122, 1720665183188922368,
      1963466798, 1618975370488999936, 1573399256836309009, 1275333333724000257, 3448284313,
      6681172, 361044311, 1743487864934162432, 1584941134203289601, 1763012993682456576
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
          start_time: fortyEightHoursAgo,
          'tweet.fields': 'created_at,public_metrics',
          max_results: 20,
          exclude: 'retweets,replies',  // Exclude both retweets and replies
        },
      });
  
      const tweets = response.data.data || [];
      console.log(`Retrieved ${tweets.length} tweets for user ${userId}`);
      
      tweets.forEach((tweet: any) => {
        const likes = tweet.public_metrics?.like_count || 0;
        allTweets.push(`[User ${userId}] ${tweet.text} (Likes: ${likes})`);
      });
    } catch (error) {
      console.error(`Error fetching tweets for user ${userId}:`, error.message);
    }
  }
  
  try {
    // Fetch tweets from user IDs
    for (const userId of userIds) {
      await fetchTweetsFromUser(userId);
    }
    
    // Format the tweets into a single string
    return allTweets.join('\n\n');
  } catch (error) {
    console.error('Error in fetchFromTwitterUsers:', error);
    throw new Error(`Failed to fetch Twitter user data: ${error.message}`);
  }
}

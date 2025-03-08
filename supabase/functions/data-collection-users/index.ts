
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
      
      // Check if we need to update medium-term context (after 12 cycles instead of 20)
      if (dataCollectionCounter >= 12) {
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

// Function to fetch data from Twitter user timelines with parallel processing and group selection
async function fetchFromTwitterUsers(bearerToken: string): Promise<string> {
  console.log("Fetching data from Twitter user timelines with time-based group selection...");
  
  // Base URL for Twitter API v2
  const API_BASE_URL = 'https://api.twitter.com/2';
  
  // Split user IDs into two groups to handle Twitter API rate limits
  // Group A - processed at 6am and 4pm CT
  const groupA = [
    1353836358901501952, 1599587232175849472, 4398626122, 1720665183188922368,
    1963466798, 1618975370488999936, 1573399256836309009, 1275333333724000257, 3448284313,
    6681172, 361044311
  ];
  
  // Group B - processed at 11am and 9pm CT
  const groupB = [
    1743487864934162432, 1584941134203289601, 1763012993682456576,
    284333988, 1884131461130825728, 18737039, 82331877, 1881168794, 1589007443853340672, 60642052,
    1314686042
  ];
  
  // Get current time in Central Time (UTC-6)
  const now = new Date();
  // Adjust to Central Time (UTC-6)
  const centralTimeOffset = -6 * 60; // -6 hours in minutes
  const centralTimeMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + centralTimeOffset;
  // Convert back to hours, handling day boundaries
  let centralTimeHours = Math.floor(centralTimeMinutes / 60);
  if (centralTimeHours < 0) centralTimeHours += 24;
  if (centralTimeHours >= 24) centralTimeHours -= 24;
  
  console.log(`Current time in Central Time: ${centralTimeHours}:${now.getUTCMinutes()}`);
  
  // Determine which group to process based on the time
  // Group A: 6am-10:59am and 4pm-8:59pm Central Time
  // Group B: 11am-3:59pm and 9pm-5:59am Central Time
  let userIds;
  if ((centralTimeHours >= 6 && centralTimeHours < 11) || 
      (centralTimeHours >= 16 && centralTimeHours < 21)) {
    userIds = groupA;
    console.log(`Processing Group A (${userIds.length} users) at ${centralTimeHours}:${now.getUTCMinutes()} CT`);
  } else {
    userIds = groupB;
    console.log(`Processing Group B (${userIds.length} users) at ${centralTimeHours}:${now.getUTCMinutes()} CT`);
  }
  
  // Combined array for all tweets
  let allTweets: string[] = [];
  
  // Function to fetch tweets from a single user ID, excluding replies
  async function fetchTweetsFromUser(userId: number): Promise<string[]> {
    try {
      console.log(`Fetching tweets for user ${userId}...`);
      const response = await axiod.get(`${API_BASE_URL}/users/${userId}/tweets`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        params: {
          'tweet.fields': 'created_at,public_metrics',
          'exclude': 'replies',  // Added this parameter to exclude replies
          max_results: 5
        },
      });
  
      const tweets = response.data.data || [];
      console.log(`Retrieved ${tweets.length} tweets for user ${userId}`);
      
      const userTweets: string[] = [];
      tweets.forEach((tweet: any) => {
        const likes = tweet.public_metrics?.like_count || 0;
        userTweets.push(`[User ${userId}] ${tweet.text} (Likes: ${likes})`);
      });
      
      return userTweets;
    } catch (error) {
      console.error(`Error fetching tweets for user ${userId}:`, error.message);
      return []; // Return empty array on error to continue with other users
    }
  }
  
  try {
    // Split users into batches of 5 to process in parallel
    const BATCH_SIZE = 5;
    const batches = [];
    
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      batches.push(userIds.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Split ${userIds.length} users into ${batches.length} batches of up to ${BATCH_SIZE} users each`);
    
    // Process each batch in parallel with a delay between batches
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} users`);
      
      // Process this batch in parallel
      const batchPromises = batch.map(userId => fetchTweetsFromUser(userId));
      const batchResults = await Promise.all(batchPromises);
      
      // Add all tweets from this batch to the combined results
      batchResults.forEach(userTweets => {
        allTweets = allTweets.concat(userTweets);
      });
      
      // If not the last batch, add a delay before processing the next batch (increased from 1 to 2 seconds)
      if (batchIndex < batches.length - 1) {
        console.log(`Waiting 2 seconds before processing next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`Collected a total of ${allTweets.length} tweets from all users`);
    
    // Format the tweets into a single string (same format as before)
    return allTweets.join('\n\n');
  } catch (error) {
    console.error('Error in fetchFromTwitterUsers:', error);
    throw new Error(`Failed to fetch Twitter user data: ${error.message}`);
  }
}



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
    
    // Process and standardize the collected data
    // Store raw text content in the twitter_data field
    const processedContent = {
      twitter_data: twitterContent,
      created_at: new Date().toISOString()
    };
    
    // Store collected data in Supabase
    const { data, error } = await supabase
      .from('collected_content')
      .insert([processedContent]);
      
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
  
  // List of 25 user IDs
  const userIds = [
      1353836358901501952, 1599587232175849472, 1605, 4398626122, 1720665183188922368,
      1963466798, 1618975370488999936, 1573399256836309009, 1275333333724000257, 3448284313,
      6681172, 361044311, 1743487864934162432, 1584941134203289601, 1763012993682456576,
      2786431437, 33836629, 1405031034, 23113993, 1714580962569588736,
      1314686042, 717930546391687170, 338443084, 346640777, 889050642903293953
  ];
  
  // List of 60 keywords/phrases
  const keywords = [
      'LLM', 'Prompt Engineering', 'DeepSeek', 'OpenAI', 'ChatGPT', 'GPT-4o', 'GPT-4.5', 'AGI',
      'Mistral', 'Claude 3.5', 'Claude 3.7 sonnet', 'Claude Opus', 'Anthropic', 'Grok 3', 'Llama 3',
      'Gemini Pro', 'Gemini Flash', 'Gemini Reasoning', 'Qwen', 'Alibaba AI', 'Meta AI', 'xAI Musk',
      'Hugging Face AI', 'DeepMind', 'Microsoft Phi', 'NVIDIA GPU', 'NVIDIA H100', 'generative AI',
      'reinforcement learning', 'transformer models', 'vector databases pinecone', 'fine-tuning LLMs',
      'retrieval augmented generation', 'RAG AI', 'chain of thought', 'DALL-E', 'MidJourney',
      'Stable Diffusion', 'Openai Sora', 'Runway Gen', 'perplexity ai', 'Elevenlabs ai',
      'GitHub copilot', 'langchain ai', 'lora fine tuning', 'AI ethics', 'EU AI Act', 'quantum computing',
      'vector database', 'multi modal ai', 'fine tuning ai', 'long form context', 'Sam Altman',
      'Microsoft AI', 'Google AI', 'Amazon AI', 'Facebook AI', 'Mixture of Experts', 'zero-shot learning',
      'few-shot learning', 'AI alignment', 'ai regulation'
  ];
  
  // Combined array for all tweets
  let allTweets: string[] = [];
  
  // Function to fetch tweets from a single user ID, excluding retweets and replies
  async function fetchTweetsFromUser(userId: number): Promise<void> {
    try {
      const response = await axiod.get(`${API_BASE_URL}/users/${userId}/tweets`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        params: {
          start_time: twentyFourHoursAgo,
          'tweet.fields': 'created_at',
          max_results: 100,
          exclude: 'retweets,replies',  // Exclude both retweets and replies
        },
      });
  
      const tweets = response.data.data || [];
      tweets.forEach((tweet: any) => allTweets.push(`[User ${userId}] ${tweet.text}`));
    } catch (error) {
      console.error(`Error fetching tweets for user ${userId}:`, error.message);
    }
  }
  
  // Function to fetch tweets by keywords with 50+ likes, excluding retweets
  async function fetchTweetsByKeywords(keywordBatch: string[]): Promise<void> {
    const query = `${keywordBatch.join(' OR ')} min_faves:50 -is:retweet`;
    try {
      const response = await axiod.get(`${API_BASE_URL}/tweets/search/recent`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        params: {
          query: query,
          start_time: twentyFourHoursAgo,
          'tweet.fields': 'public_metrics',
          max_results: 100,
        },
      });
  
      const tweets = response.data.data || [];
      tweets.forEach((tweet: any) => allTweets.push(`[Keyword Search] ${tweet.text} (Likes: ${tweet.public_metrics?.like_count})`));
    } catch (error) {
      console.error(`Error searching keywords:`, error.message);
    }
  }
  
  try {
    // Step 1: Fetch tweets from user IDs
    for (const userId of userIds) {
      await fetchTweetsFromUser(userId);
    }
    
    // Step 2: Fetch tweets by keywords (split into batches due to 512-char limit)
    const batchSize = 15; // Adjust based on query length; 15 keeps it under 512 chars
    for (let i = 0; i < keywords.length; i += batchSize) {
      const keywordBatch = keywords.slice(i, i + batchSize);
      await fetchTweetsByKeywords(keywordBatch);
    }
    
    // Format the tweets into a single string
    return allTweets.join('\n\n');
  } catch (error) {
    console.error('Error in fetchFromTwitter:', error);
    throw new Error(`Failed to fetch Twitter data: ${error.message}`);
  }
}

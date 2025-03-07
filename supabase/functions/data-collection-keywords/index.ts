// Data Collection Service for Keywords
// This edge function collects AI-related content from Twitter API using keywords

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
  
  // Validate required environment variables
  if (!twitterBearerToken) {
    console.error("Missing TWITTER_BEARER_TOKEN environment variable");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting keyword-based data collection process...");
    
    // Collect data from Twitter API
    const twitterContent = await fetchFromTwitterKeywords(twitterBearerToken);
    
    // Get the latest record to update with keyword data
    const { data: latestRecord, error: fetchError } = await supabase
      .from('collected_content')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (fetchError || !latestRecord || latestRecord.length === 0) {
      console.log("No existing record found, creating new record for keyword data");
      // Create a new record with keyword data
      const { error: insertError } = await supabase
        .from('collected_content')
        .insert([{
          twitter_keywordreturn: twitterContent,
          created_at: new Date().toISOString()
        }]);
        
      if (insertError) {
        console.error("Error creating record for keyword data:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to store keyword data" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    } else {
      // Update the latest record with keyword data
      const { error: updateError } = await supabase
        .from('collected_content')
        .update({ twitter_keywordreturn: twitterContent })
        .eq('id', latestRecord[0].id);
        
      if (updateError) {
        console.error("Error updating keyword data:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update keyword data" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }
    
    console.log("Keyword data collection completed successfully");
    return new Response(
      JSON.stringify({ success: true, message: "Keyword data collection completed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Keyword data collection failed:", error);
    return new Response(
      JSON.stringify({ error: "Keyword data collection failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to fetch data from Twitter using keywords
async function fetchFromTwitterKeywords(bearerToken: string): Promise<string> {
  console.log("Fetching data from Twitter using keywords...");
  
  // Base URL for Twitter API v2
  const API_BASE_URL = 'https://api.twitter.com/2';
  
  // Calculate time 48 hours ago (updated from 24 to 48 hours)
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  
  // List of 30 keywords/phrases (reduced for debugging)
  const keywords = [
      'LLM', 'Prompt Engineering', 'DeepSeek', 'OpenAI', 'ChatGPT', 'GPT-4o', 'GPT-4.5', 'AGI',
      'Mistral', 'Claude 3.5', 'Claude 3 sonnet', 'Claude Opus', 'Anthropic', 'Grok 3', 'Llama 3',
      'Gemini Pro', 'Gemini Flash', 'Gemini Reasoning', 'Qwen', 'Alibaba AI', 'Meta AI', 'xAI Musk',
      'Hugging Face AI', 'DeepMind', 'Microsoft Phi', 'NVIDIA GPU', 'NVIDIA H100', 'generative AI',
      'reinforcement learning', 'transformer models'
  ];
  
  // Combined array for all tweets
  let allTweets: string[] = [];
  
  // Function to fetch tweets by keywords with 50+ likes, excluding retweets
  async function fetchTweetsByKeywords(keywordBatch: string[]): Promise<void> {
    const formattedKeywords = keywordBatch.map(keyword => {
      if (keyword.includes(' ')) {
        return `"${keyword}"`;
      } else {
        return keyword;
      }
    });
    const query = `${formattedKeywords.join(' OR ')} min_faves:50 -is:retweet`;
    console.log(`Searching with query: ${query.substring(0, 100)}...`);
    
    try {
      const response = await axiod.get(`${API_BASE_URL}/tweets/search/recent`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        params: {
          query: query,
          start_time: fortyEightHoursAgo,
          'tweet.fields': 'public_metrics,created_at',
          max_results: 20,
        },
      });
  
      const tweets = response.data.data || [];
      console.log(`Retrieved ${tweets.length} tweets for keyword batch`);
      
      tweets.forEach((tweet: any) => {
        const likes = tweet.public_metrics?.like_count || 0;
        allTweets.push(`[Keyword Search] ${tweet.text} (Likes: ${likes}, Created: ${tweet.created_at})`);
      });
    } catch (error) {
      console.error(`Error searching keywords:`, error.message);
      if (error.response) {
        console.error('Twitter API response:', error.response.data);
      }
    }
  }
  
  try {
    // Fetch tweets by keywords (split into batches due to 512-char limit)
    const batchSize = 10; // Adjust based on query length; 10 keeps it well under 512 chars
    for (let i = 0; i < keywords.length; i += batchSize) {
      const keywordBatch = keywords.slice(i, i + batchSize);
      await fetchTweetsByKeywords(keywordBatch);
    }
    
    // Format the tweets into a single string
    return allTweets.join('\n\n');
  } catch (error) {
    console.error('Error in fetchFromTwitterKeywords:', error);
    throw new Error(`Failed to fetch Twitter keyword data: ${error.message}`);
  }
}

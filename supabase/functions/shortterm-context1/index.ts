
// Short-term Context 1 Processor
// Processes recent Twitter and Perplexity data using Google Gemini API

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const environmentVariables = Deno.env.toObject();
  const supabaseUrl = environmentVariables.SUPABASE_URL || '';
  const supabaseAnonKey = environmentVariables.SUPABASE_ANON_KEY || '';
  const geminiApiKey = environmentVariables.GEMINI_API_KEY || '';
  
  // Validate required environment variables
  if (!geminiApiKey) {
    console.error("Missing GEMINI_API_KEY environment variable");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting short-term context 1 processing...");
    
    // Fetch the 12 most recent rows from collected_content
    const { data: recentContent, error: fetchError } = await supabase
      .from('collected_content')
      .select('twitter_data, perplexity_data, created_at')
      .order('created_at', { ascending: false })
      .limit(12);
      
    if (fetchError) {
      console.error("Error fetching recent content:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch recent content" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    if (!recentContent || recentContent.length === 0) {
      console.log("No recent content found to process");
      return new Response(
        JSON.stringify({ message: "No content to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    // Order by created_at chronologically
    recentContent.sort((a, b) => 
      new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
    
    // Process Twitter data - extract tweets and remove user IDs
    let processedTwitterData = "";
    for (const content of recentContent) {
      if (content.twitter_data) {
        const tweets = content.twitter_data.split('\n\n');
        for (const tweet of tweets) {
          // Remove user ID and extract just the tweet content
          const cleanedTweet = tweet.replace(/\[User \d+\] /, '');
          if (cleanedTweet.trim()) {
            processedTwitterData += cleanedTweet + '\n\n';
          }
        }
      }
    }
    
    // Process Perplexity data - remove thinking text
    let processedPerplexityData = "";
    for (const content of recentContent) {
      if (content.perplexity_data) {
        // Remove text between <think> and </think> tags if they exist
        const cleanedPerplexityData = content.perplexity_data.replace(/<think>[\s\S]*?<\/think>/g, '');
        if (cleanedPerplexityData.trim()) {
          processedPerplexityData += cleanedPerplexityData + '\n\n';
        }
      }
    }
    
    // Combine all data chronologically (it's already sorted by date)
    const combinedData = `
TWITTER DATA:
${processedTwitterData}

PERPLEXITY DATA:
${processedPerplexityData}
`;
    
    // Process the combined data with Google Gemini API
    console.log("Processing data with Gemini API...");
    const processedContext = await processWithGemini(combinedData, geminiApiKey);
    
    // Store the processed data in the unrefined table
    const { data: insertData, error: insertError } = await supabase
      .from('unrefined')
      .insert([{ shortterm_context1_unrefined: processedContext }])
      .select('id');
      
    if (insertError) {
      console.error("Error storing processed context:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store processed context" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    const contextId = insertData?.[0]?.id;
    console.log(`Short-term context 1 processing completed and stored with ID: ${contextId}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Short-term context 1 processing completed",
        context_id: contextId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Short-term context 1 processing failed:", error);
    return new Response(
      JSON.stringify({ error: "Short-term context 1 processing failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to process data with Google Gemini API
async function processWithGemini(inputData: string, apiKey: string): Promise<string> {
  console.log("Calling Gemini API...");
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are tasked with a simple task of taking the following data from twitter and perplexity and 'cleaning' them. 
                
Regarding the Twitter data - Remove the user id numbers, then simply list the individual tweets in chronological order by time/day ensuring that you do NOT alter the individual tweets at all
Regarding the Perplexity data - Remove all the thinking text (in between '<think>....</think>'), and then also chronologically order by time/day
FINAL INSTRUCTIONS - Perform only the instructions assigned to you. Do not include extra side comments or statements. 

${inputData}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 8192,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error:", errorData);
      throw new Error(`Gemini API returned ${response.status}: ${errorData}`);
    }

    const result = await response.json();
    console.log("Gemini API response received successfully");
    
    // Extract the generated content
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || 
                           "No content generated from Gemini API";
    
    return generatedText;
  } catch (error) {
    console.error("Error in Gemini API processing:", error);
    return `Error processing with Gemini API: ${error.message}`;
  }
}

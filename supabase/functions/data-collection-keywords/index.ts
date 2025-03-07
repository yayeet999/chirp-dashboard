
// Data Collection Service for Perplexity AI
// This edge function collects AI-related content from Perplexity API using Sonar Reasoning Pro model

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const perplexityApiKey = environmentVariables.PERPLEXITY_API_KEY || '';
  
  // Validate required environment variables
  if (!perplexityApiKey) {
    console.error("Missing PERPLEXITY_API_KEY environment variable");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting Perplexity data collection process...");
    
    // Collect data from Perplexity API
    const perplexityData = await fetchFromPerplexity(perplexityApiKey);
    
    // Get the latest record to update with Perplexity data
    const { data: latestRecord, error: fetchError } = await supabase
      .from('collected_content')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (fetchError || !latestRecord || latestRecord.length === 0) {
      console.log("No existing record found, creating new record for Perplexity data");
      // Create a new record with Perplexity data
      const { error: insertError } = await supabase
        .from('collected_content')
        .insert([{
          perplexity_data: perplexityData,
          created_at: new Date().toISOString()
        }]);
        
      if (insertError) {
        console.error("Error creating record for Perplexity data:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to store Perplexity data" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    } else {
      // Update the latest record with Perplexity data
      const { error: updateError } = await supabase
        .from('collected_content')
        .update({ perplexity_data: perplexityData })
        .eq('id', latestRecord[0].id);
        
      if (updateError) {
        console.error("Error updating Perplexity data:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update Perplexity data" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }
    
    console.log("Perplexity data collection completed successfully");
    return new Response(
      JSON.stringify({ success: true, message: "Perplexity data collection completed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Perplexity data collection failed:", error);
    return new Response(
      JSON.stringify({ error: "Perplexity data collection failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to fetch data from Perplexity Sonar Reasoning Pro API
async function fetchFromPerplexity(apiKey: string): Promise<string> {
  console.log("Fetching data from Perplexity Sonar Reasoning Pro API...");
  
  // Get current date in a readable format
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Updated prompt with dynamic date
  const prompt = `Perform a wide and extensive search to find the most recently released AI models in the past 48 hours from today's date of "${formattedDate}". Focus on both open and closed source ai LLMs. They must have been newly released in the past 48 hours.`;

  const requestBody = {
    model: "sonar-reasoning-pro",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 8192,
    search_recency_filter: "week", // Keep "week" to cover the recent 48-hour range
    return_citations: false,
  };

  try {
    console.log("Sending request to Perplexity API...");
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", errorText);
      throw new Error(`Perplexity API returned ${response.status}: ${errorText}`);
    }

    console.log("Response received from Perplexity API");
    const data = await response.json();
    const content = data.choices[0]?.message?.content || "No content returned from Perplexity";
    
    console.log("Successfully retrieved data from Perplexity API");
    
    // Format the result with prompt information and current date
    return `[Perplexity Sonar Reasoning Pro] Date: ${formattedDate}\n\nQuery: Find most recently released AI models in the past 48 hours.\n\n${content}`;
  } catch (error) {
    console.error('Error in fetchFromPerplexity:', error);
    throw new Error(`Failed to fetch Perplexity data: ${error.message}`);
  }
}

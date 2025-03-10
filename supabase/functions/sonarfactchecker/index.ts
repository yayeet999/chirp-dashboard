
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const environmentVariables = Deno.env.toObject();
  const supabaseUrl = environmentVariables.SUPABASE_URL || '';
  const supabaseAnonKey = environmentVariables.SUPABASE_ANON_KEY || '';
  const perplexityApiKey = environmentVariables.PERPLEXITY_API_KEY || '';
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting sonarfactchecker processing...");
    
    // Get the record ID from the request body
    const requestData = await req.json().catch(() => ({}));
    const recordId = requestData.recordId;
    
    if (!recordId) {
      throw new Error("Record ID is required");
    }
    
    console.log(`Processing fact check for record: ${recordId}`);
    
    // Fetch the sonardeepresearch content from the database
    const { data: record, error: fetchError } = await supabase
      .from('tweetgenerationflow')
      .select('sonardeepresearch')
      .eq('id', recordId)
      .maybeSingle();
    
    if (fetchError) {
      console.error(`Error fetching record ${recordId}:`, fetchError);
      throw new Error(`Failed to fetch record ${recordId}: ${fetchError.message}`);
    }
    
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    
    if (!record.sonardeepresearch) {
      throw new Error(`Record ${recordId} has no sonardeepresearch data to fact check`);
    }
    
    const researchContent = record.sonardeepresearch;
    console.log("Found research content. Starting fact checking...");
    console.log("Research content length:", researchContent.length);
    console.log("Research content (first 200 chars):", researchContent.substring(0, 200));
    
    // Call the fact check research function
    const factCheckedContent = await callFactCheckResearch(researchContent, perplexityApiKey);
    
    if (!factCheckedContent) {
      throw new Error("Fact checking returned empty content");
    }
    
    console.log("Fact checking complete. Saving results to database...");
    console.log("Fact checked content length:", factCheckedContent.length);
    console.log("Fact checked content (first 200 chars):", factCheckedContent.substring(0, 200));
    
    // Save the fact-checked content back to the database
    const { data: updateData, error: updateError } = await supabase
      .from('tweetgenerationflow')
      .update({
        sonarfactchecked: factCheckedContent
      })
      .eq('id', recordId);
      
    if (updateError) {
      console.error("Error updating record with fact-checked content:", updateError);
      throw new Error(`Failed to save fact-checked content to database: ${updateError.message}`);
    }
    
    console.log("Fact-checked content saved to database successfully");
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        recordId: recordId,
        message: "Fact checking completed successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Fact checking process failed:", error);
    return new Response(
      JSON.stringify({ error: "Fact checking process failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Implement the fact checking function
async function callFactCheckResearch(reportContent, apiKey) {
  console.log("Initiating Fact-Check Research...");
  
  if (!apiKey) {
    throw new Error("Perplexity API key is missing");
  }
  
  if (!reportContent || reportContent.trim() === '') {
    throw new Error("No content provided for fact-checking");
  }
  
  const url = "https://api.perplexity.ai/chat/completions";
  
  const systemInstruction = `Act as an expert meticulous fact-checker researcher. You will be given a length research text in addition to these instructions, process the research text as follows:
1. REMOVE the entire <think>...text...</think> section at the beginning of the provided research text (delete without analysis)
2. Thoroughly verify and fact-check the entire remaining research text using reputable sources OUTPUT ONLY THE UPDATED AND CORRECTED VERSION OF THE EXACT RESEARCH TEXT YOU WERE GIVEN.
3. Cross-check data, claims, metrics, and statistics with primary sources
4. Correct or remove any statements, claims, or data points determined to be false or inaccurate
5. OUTPUT ONLY THE UPDATED AND CORRECTED VERSION OF THE EXACT RESEARCH TEXT YOU WERE GIVEN. IF no corrections or updates are needed after your thorough verification, simply output the original research text you were given exactly as you were given, minus the removed <think> section. Do not include extra comments or statements`;

  try {
    console.log("Sending request to Perplexity API...");
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model: "sonar-deep-research",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: reportContent }
        ],
        max_tokens: 2600,
        temperature: 0.2
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Perplexity API Error: ${response.status} - ${errorText}`);
      throw new Error(`Perplexity API returned ${response.status}: ${errorText}`);
    }
    
    console.log("Received response from Perplexity API");
    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
      console.error("Invalid response format from Perplexity API:", JSON.stringify(data));
      throw new Error("Invalid response format from Perplexity API");
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error(`FactCheck Error: ${error.message}`);
    throw new Error(`Verification failed: ${error.message}`);
  }
}

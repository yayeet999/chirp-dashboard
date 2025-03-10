
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
    
    // Use backgroundProcessFactCheck function for the long-running operation
    // and return a quick response to avoid timeout
    const backgroundTask = async () => {
      console.log(`Background task started for record: ${recordId}`);
      
      try {
        // Call the fact check research function with improved API structure
        const factCheckedContent = await callFactCheckResearch(researchContent, perplexityApiKey);
        
        if (!factCheckedContent) {
          console.error("Background task error: Fact checking returned empty content");
          return;
        }
        
        console.log("Fact checking complete in background task. Saving results to database...");
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
          console.error("Background task error: Error updating record with fact-checked content:", updateError);
          return;
        }
        
        console.log("Background task completed: Fact-checked content saved to database successfully");
      } catch (error) {
        console.error("Background task error: Fact checking process failed:", error);
      }
    };
    
    // Start background processing without waiting for completion
    // @ts-ignore - EdgeRuntime is available in Deno edge runtime but TypeScript doesn't know about it
    EdgeRuntime.waitUntil(backgroundTask());
    
    console.log(`Initiated background fact-checking for record: ${recordId}`);
    
    // Return immediate success response while processing continues in background
    return new Response(
      JSON.stringify({ 
        success: true, 
        recordId: recordId,
        message: "Fact checking initiated and will continue in the background",
        status: "processing"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 202 }
    );
    
  } catch (error) {
    console.error("Fact checking process failed:", error);
    return new Response(
      JSON.stringify({ error: "Fact checking process failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Improved fact checking function using simplified API structure
async function callFactCheckResearch(reportContent, apiKey) {
  console.log("Initiating Fact-Check Research...");
  
  if (!apiKey) {
    throw new Error("Perplexity API key is missing");
  }
  
  if (!reportContent || reportContent.trim() === '') {
    throw new Error("No content provided for fact-checking");
  }
  
  const url = "https://api.perplexity.ai/chat/completions";
  
  // Prepare the system instructions to be included in the user message
  const systemInstructionText = `Act as an expert meticulous fact-checker researcher. Process the following research text as follows:
1. REMOVE the entire <think>...text...</think> section at the beginning of the provided research text (delete without analysis)
2. Thoroughly verify and fact-check the entire remaining research text using reputable sources by performing a comprehensive web search across many different reputable relevant domains. Please ignore the included sources in the research text, perform your own comprehensive web search and thorough analysis to confirm/fact-check each stated statisitc/fact/claim in the research text WITHOUT relying on the included mentioned sources.
3. Cross-check data, claims, metrics, and statistics with primary sources
4. CORRECT OR REMOVE ANY STATEMENT, CLAIMS, OR DATA POINTS DETERMINE TO BE FACTUALLY FALSE OR INACCURATE
5. HOWEVER LEAVE FACTUALLY CORRECT SECTIONS AND TEXT UNAFFECTED AND UNEDITED
6. AFTER YOU HAVE THOROUGHLY AND CORRECTLY FACT-CHECKED AND CORRECTED/UPDATED ANY POTENTIAL ERRORS, OUTPUT ONLY THE UPDATED AND CORRECTED VERSION (if corrections were needed) OF THE RESEARCH TEXT YOU WERE GIVEN. IF no corrections or updates are needed after your thorough verification, simply output the original research text you were given exactly as you were given, minus the removed <think> section. However if corrections WERE needed, output the entire same research text with the previously factually incorrect errors now fully correct and properly fact-checked, also minus the <think> section. 

Here is the text to process:
${reportContent}`;

  try {
    console.log("Sending request to Perplexity API...");
    console.log("Instruction + content length:", systemInstructionText.length);
    
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
          { role: "user", content: systemInstructionText }
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

// Listen for shutdown event to log when the function is terminated
addEventListener('beforeunload', (event) => {
  console.log('Function is shutting down, reason:', event.detail?.reason);
});

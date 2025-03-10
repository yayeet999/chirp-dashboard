
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
      .single();
    
    if (fetchError) {
      console.error(`Error fetching record ${recordId}:`, fetchError);
      throw new Error(`Failed to fetch record ${recordId}`);
    }
    
    if (!record || !record.sonardeepresearch) {
      throw new Error(`Record ${recordId} has no sonardeepresearch data to fact check`);
    }
    
    const researchContent = record.sonardeepresearch;
    console.log("Found research content. Starting fact checking...");
    console.log("Research content (first 200 chars):", researchContent.substring(0, 200));
    
    // Call the fact check research function
    const factCheckedContent = await callFactCheckResearch(researchContent, perplexityApiKey);
    
    console.log("Fact checking complete. Saving results to database...");
    console.log("Fact checked content (first 200 chars):", factCheckedContent.substring(0, 200));
    
    // Save the fact-checked content back to the database
    const { data: updateData, error: updateError } = await supabase
      .from('tweetgenerationflow')
      .update({
        sonarfactchecked: factCheckedContent
      })
      .eq('id', recordId)
      .select();
      
    if (updateError) {
      console.error("Error updating record with fact-checked content:", updateError);
      throw new Error("Failed to save fact-checked content to database");
    }
    
    console.log("Fact-checked content saved to database");
    
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

// Implement the fact checking function as provided by the user
async function callFactCheckResearch(reportContent, apiKey) {
  console.log("Initiating Fact-Check Research...");
  const url = "https://api.perplexity.ai/chat/completions";
  
  const systemInstruction = `Act as an expert meticulous fact-checker researcher. You will be given a research report, process the report as follows:
1. REMOVE the entire <think>...text...</think> section at the beginning of the provided research report (delete without analysis)
2. Thoroughly verify and fact-check the entire remaining research report using reputable sources
3. Cross-check data, claims, metrics, and statistics with primary sources
4. Correct or remove any statements, claims, or data points determined to be false or inaccurate
5. Output ONLY the updated and correct version of the research report. IF no corrections or updates are needed after your thorough verification, simply output the original report exactly as is minus the removed <think> section. Do not include extra comments or statements`;

  try {
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
      throw new Error(`Perplexity API returned ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Error processing document";
  } catch (error) {
    console.error(`FactCheck Error: ${error.message}`);
    return `Verification failed: ${error.message}`;
  }
}

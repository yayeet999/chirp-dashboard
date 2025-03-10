
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
  const openAIApiKey = environmentVariables.OPENAI_API_KEY || '';
  const upstashVectorUrl = environmentVariables.UPSTASH_VECTOR_REST_URL || '';
  const upstashVectorToken = environmentVariables.UPSTASH_VECTOR_REST_TOKEN || '';
  const perplexityApiKey = environmentVariables.PERPLEXITY_API_KEY || '';
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting pretweetcontext processing...");
    
    // Get the record ID from the request body if provided
    const requestData = await req.json().catch(() => ({}));
    let recordId = requestData.recordId;
    
    // If no record ID is provided, fetch the most recent tweetgenerationflow entry with geminiobservation
    if (!recordId) {
      const { data: latestRecord, error: fetchError } = await supabase
        .from('tweetgenerationflow')
        .select('id, geminiobservation, created_at')
        .not('geminiobservation', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (fetchError) {
        console.error("Error fetching latest tweetgenerationflow record:", fetchError);
        throw new Error("Failed to fetch latest tweetgenerationflow record");
      }
      
      if (!latestRecord || latestRecord.length === 0) {
        throw new Error("No tweetgenerationflow records found with geminiobservation");
      }
      
      recordId = latestRecord[0].id;
      
      // Ensure we have geminiobservation data
      if (!latestRecord[0].geminiobservation) {
        throw new Error("Latest record has no geminiobservation data");
      }
      
      console.log(`Using most recent tweetgenerationflow record: ${recordId}`);
    } else {
      console.log(`Using provided tweetgenerationflow record: ${recordId}`);
    }
    
    // Fetch the specific tweetgenerationflow record
    const { data: record, error: recordError } = await supabase
      .from('tweetgenerationflow')
      .select('geminiobservation')
      .eq('id', recordId)
      .single();
    
    if (recordError) {
      console.error(`Error fetching tweetgenerationflow record ${recordId}:`, recordError);
      throw new Error(`Failed to fetch tweetgenerationflow record ${recordId}`);
    }
    
    if (!record || !record.geminiobservation) {
      throw new Error(`Record ${recordId} has no geminiobservation data`);
    }
    
    const geminiObservation = record.geminiobservation;
    console.log("Found geminiobservation. Starting vector search and Perplexity research...");
    
    // Process tasks in parallel
    const [vectorContextResult, perplexityResult] = await Promise.all([
      processVectorSearch(geminiObservation, openAIApiKey, upstashVectorUrl, upstashVectorToken),
      callSonarDeepResearch(geminiObservation, perplexityApiKey)
    ]);
    
    // Update the tweetgenerationflow record with both results
    const { data: updateData, error: updateError } = await supabase
      .from('tweetgenerationflow')
      .update({
        vectorcontext: JSON.stringify(vectorContextResult),
        sonardeepresearch: perplexityResult
      })
      .eq('id', recordId)
      .select();
      
    if (updateError) {
      console.error("Error updating tweetgenerationflow with pretweetcontext data:", updateError);
      throw new Error("Failed to save pretweetcontext data to database");
    }
    
    console.log("Vector context and Sonar deep research saved to tweetgenerationflow table");
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        recordId: recordId,
        message: "Vector context and Sonar deep research successfully processed"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Pretweetcontext processing failed:", error);
    return new Response(
      JSON.stringify({ error: "Pretweetcontext processing failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to create embedding and perform vector search
async function processVectorSearch(text: string, apiKey: string, vectorUrl: string, vectorToken: string) {
  console.log("Creating embedding for vector search...");
  
  // Generate embedding from OpenAI
  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: "text-embedding-ada-002" // OpenAI embedding model
    }),
  });

  if (!embeddingResponse.ok) {
    const error = await embeddingResponse.json();
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate embedding for vector search");
  }

  const embeddingData = await embeddingResponse.json();
  const embedding = embeddingData.data[0].embedding;
  
  // Perform vector search using Upstash Vector
  console.log("Performing vector search in Upstash...");
  const vectorResponse = await fetch(`${vectorUrl}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${vectorToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      index: "firasgptknowledge",
      vector: embedding,
      topK: 4,
      includeMetadata: true,
      includeVectors: false
    }),
  });

  if (!vectorResponse.ok) {
    const error = await vectorResponse.text();
    console.error("Upstash Vector API error:", error);
    throw new Error("Failed to perform vector search");
  }

  const vectorResult = await vectorResponse.json();
  console.log(`Retrieved ${vectorResult.matches?.length || 0} vector matches`);
  
  // Extract relevant information from vector search results
  // Fix: Handle the case where matches might be undefined
  if (!vectorResult.matches || !Array.isArray(vectorResult.matches)) {
    console.log("No matches found in vector search results or invalid format");
    return [];  // Return empty array if no matches
  }
  
  return vectorResult.matches.map((match: any) => ({
    text: match.metadata?.text || "No text available",
    source: match.metadata?.source || "Unknown source",
    type: match.metadata?.type || "Unknown type",
    score: match.score
  }));
}

// Function to call Perplexity Sonar Deep Research API
async function callSonarDeepResearch(query: string, apiKey: string) {
  console.log("Calling Perplexity Sonar Deep Research...");
  const url = "https://api.perplexity.ai/chat/completions";
  
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
        messages: [{ role: "user", content: query }],
        max_tokens: 3000
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Perplexity API Error: ${response.status} - ${errorText}`);
      throw new Error(`Perplexity API returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Received Perplexity Sonar Deep Research response");
    
    // Extract the actual response content
    const researchContent = data.choices?.[0]?.message?.content || "No response from Perplexity API";
    return researchContent;
  } catch (error) {
    console.error(`Error calling Perplexity API: ${error.message}`);
    throw error;
  }
}

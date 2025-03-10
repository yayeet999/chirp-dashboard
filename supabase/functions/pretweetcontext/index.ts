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
    console.log("Gemini observation text (first 200 chars):", geminiObservation.substring(0, 200));
    
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
    console.log(`Vector matches found: ${vectorContextResult.length}`);
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        recordId: recordId,
        message: "Vector context and Sonar deep research successfully processed",
        vectorMatchCount: vectorContextResult.length
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
  
  // Clean the input text - keeping original as we want to match with markdown
  const cleanText = text;
  console.log("Input text length for embedding:", cleanText.length);
  
  try {
    // Generate embedding from OpenAI
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: cleanText,
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
    
    console.log("Successfully generated embedding, vector dimension:", embedding.length);
    
    // Try a series of approaches to find matches
    const approaches = [
      { name: "Basic search with no filter", filter: undefined, threshold: 0.40 },
      { name: "Search with simple filter", filter: { "metadata.text": {"$exists": true} }, threshold: 0.40 },
      { name: "Search with all fields", filter: undefined, threshold: 0 }
    ];
    
    for (const approach of approaches) {
      console.log(`Trying vector search approach: ${approach.name}`);
      
      const vectorRequestBody: any = {
        index: "firasgptknowledge",
        vector: embedding,
        topK: 10,
        includeMetadata: true,
        includeVectors: false
      };
      
      // Only add filter and threshold if defined
      if (approach.filter) {
        vectorRequestBody.filter = approach.filter;
      }
      
      if (approach.threshold > 0) {
        vectorRequestBody.scoreThreshold = approach.threshold;
      }
      
      console.log("Vector search request:", JSON.stringify(vectorRequestBody));
      
      try {
        const vectorResponse = await fetch(`${vectorUrl}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${vectorToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(vectorRequestBody),
        });

        if (!vectorResponse.ok) {
          const errorText = await vectorResponse.text();
          console.error(`Upstash Vector API error for approach ${approach.name}:`, errorText);
          console.log("Trying next approach...");
          continue;
        }

        const vectorResult = await vectorResponse.json();
        console.log(`Approach ${approach.name} response status:`, vectorResult.status || "No status");
        
        if (vectorResult.matches && vectorResult.matches.length > 0) {
          console.log(`Found ${vectorResult.matches.length} matches with approach: ${approach.name}`);
          
          // Log the first match to understand what we're getting back
          if (vectorResult.matches[0]) {
            console.log("First match example - score:", vectorResult.matches[0].score);
            console.log("First match metadata keys:", Object.keys(vectorResult.matches[0].metadata || {}));
          }
          
          // Return matches if found
          return vectorResult.matches.map((match: any) => ({
            text: match.metadata?.text || "No text available",
            source: match.metadata?.source || "Unknown source",
            type: match.metadata?.type || "Unknown type",
            score: match.score
          }));
        }
        
        console.log(`No matches found with approach: ${approach.name}`);
      } catch (error) {
        console.error(`Error with approach ${approach.name}:`, error);
        console.log("Trying next approach...");
      }
    }
    
    // Last resort direct format for the query with no parsing
    console.log("Trying final direct approach with minimal query");
    
    try {
      const finalRequestBody = {
        "index": "firasgptknowledge",
        "vector": embedding,
        "topK": 10,
        "includeMetadata": true
      };
      
      console.log("Final vector search request:", JSON.stringify(finalRequestBody));
      
      const finalResponse = await fetch(`${vectorUrl}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vectorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalRequestBody),
      });
      
      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error("Final Upstash Vector API error:", errorText);
        return [];
      }
      
      const finalResult = await finalResponse.json();
      console.log("Final approach response:", JSON.stringify(finalResult).substring(0, 200) + "...");
      
      if (finalResult.matches && finalResult.matches.length > 0) {
        console.log(`Found ${finalResult.matches.length} matches in final approach`);
        return finalResult.matches.map((match: any) => ({
          text: match.metadata?.text || "No text available",
          source: match.metadata?.source || "Unknown source",
          type: match.metadata?.type || "Unknown type",
          score: match.score
        }));
      }
    } catch (error) {
      console.error("Error in final approach:", error);
    }
    
    console.log("No matches found in vector search after all attempts");
    
    // For debugging - let's query what data we actually have in the index
    console.log("Checking index info to verify it contains data");
    try {
      const infoResponse = await fetch(`${vectorUrl}/info?index=firasgptknowledge`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vectorToken}`
        }
      });
      
      if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        console.log("Index info:", JSON.stringify(infoData));
      } else {
        console.error("Could not get index info:", await infoResponse.text());
      }
    } catch (infoError) {
      console.error("Error checking index info:", infoError);
    }
    
    return [];
  } catch (error) {
    console.error("Error in processVectorSearch:", error);
    throw error; // Propagate the error to properly handle it 
  }
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


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
      .maybeSingle();
    
    if (recordError) {
      console.error(`Error fetching tweetgenerationflow record ${recordId}:`, recordError);
      throw new Error(`Failed to fetch tweetgenerationflow record ${recordId}`);
    }
    
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    
    if (!record.geminiobservation) {
      throw new Error(`Record ${recordId} has no geminiobservation data`);
    }
    
    const geminiObservation = record.geminiobservation;
    console.log("Found geminiobservation. Starting vector search and Perplexity research...");
    console.log("Gemini observation length:", geminiObservation.length);
    console.log("Gemini observation text (first 200 chars):", geminiObservation.substring(0, 200));
    
    // Process tasks in parallel
    console.log("Processing vector search and Perplexity research in parallel...");
    
    try {
      const [vectorContextResult, perplexityResult] = await Promise.all([
        processVectorSearch(geminiObservation, openAIApiKey, upstashVectorUrl, upstashVectorToken),
        callSonarDeepResearch(geminiObservation, perplexityApiKey)
      ]);
      
      console.log("Both vector search and Perplexity research completed.");
      console.log(`Vector matches found: ${vectorContextResult.length}`);
      console.log("Perplexity research length:", perplexityResult.length);
      
      // Update the tweetgenerationflow record with both results
      console.log("Updating database with vector context and Sonar deep research...");
      
      const { data: updateData, error: updateError } = await supabase
        .from('tweetgenerationflow')
        .update({
          vectorcontext: JSON.stringify(vectorContextResult),
          sonardeepresearch: perplexityResult
        })
        .eq('id', recordId);
        
      if (updateError) {
        console.error("Error updating tweetgenerationflow with pretweetcontext data:", updateError);
        throw new Error("Failed to save pretweetcontext data to database");
      }
      
      console.log("Vector context and Sonar deep research saved to tweetgenerationflow table");
      
      // Verify that the data was actually saved before triggering fact-checking
      console.log("Verifying data was saved correctly before triggering fact-checking...");
      
      const { data: verifyData, error: verifyError } = await supabase
        .from('tweetgenerationflow')
        .select('sonardeepresearch')
        .eq('id', recordId)
        .maybeSingle();
        
      if (verifyError) {
        console.error("Error verifying data was saved:", verifyError);
        throw new Error("Failed to verify data was saved");
      }
      
      if (!verifyData || !verifyData.sonardeepresearch) {
        console.error("Data verification failed: sonardeepresearch not found in database");
        throw new Error("Data was not saved correctly");
      }
      
      console.log("Data verification successful. Proceeding with fact-checking...");
      
      // Now that we've verified the data is saved, trigger the fact-checker
      console.log("Triggering sonarfactchecker function for fact checking...");
      
      const factCheckResponse = await fetch(`${supabaseUrl}/functions/v1/sonarfactchecker`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recordId })
      });
      
      if (!factCheckResponse.ok) {
        const errorText = await factCheckResponse.text();
        console.error(`Error triggering fact check: ${factCheckResponse.status} - ${errorText}`);
        
        // Return success response with warning about fact-checking
        return new Response(
          JSON.stringify({ 
            success: true, 
            recordId: recordId,
            message: "Vector context and Sonar deep research successfully processed",
            vectorMatchCount: vectorContextResult.length,
            factCheckInitiated: false,
            factCheckError: `Failed to trigger fact-checking: ${factCheckResponse.status}`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      
      console.log("Fact checking successfully triggered");
      
      // Return success response
      return new Response(
        JSON.stringify({ 
          success: true, 
          recordId: recordId,
          message: "Vector context and Sonar deep research successfully processed",
          vectorMatchCount: vectorContextResult.length,
          factCheckInitiated: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (processingError) {
      console.error("Error during parallel processing:", processingError);
      throw new Error(`Processing failed: ${processingError.message}`);
    }
    
  } catch (error) {
    console.error("Pretweetcontext processing failed:", error);
    return new Response(
      JSON.stringify({ error: "Pretweetcontext processing failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to create embedding and perform vector search with ultra-simplified approach
async function processVectorSearch(text, apiKey, vectorUrl, vectorToken) {
  console.log("Creating embedding for ultra-simplified vector search...");
  
  if (!text || text.trim() === '') {
    console.error("No text provided for vector search");
    return [];
  }
  
  if (!apiKey) {
    console.error("OpenAI API key is missing");
    return [];
  }
  
  if (!vectorUrl || !vectorToken) {
    console.error("Upstash Vector URL or token is missing");
    return [];
  }
  
  try {
    // Generate embedding from OpenAI
    console.log("Requesting embedding from OpenAI...");
    
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-ada-002"
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.json();
      console.error("OpenAI API error:", error);
      throw new Error(`Failed to generate embedding: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    
    if (!embeddingData.data || !embeddingData.data[0] || !embeddingData.data[0].embedding) {
      console.error("Invalid embedding response format:", JSON.stringify(embeddingData));
      throw new Error("Invalid embedding response format");
    }
    
    const embedding = embeddingData.data[0].embedding;
    
    console.log("Successfully generated embedding, vector dimension:", embedding.length);
    
    // Most basic query possible - just vector and topK
    const basicRequestBody = {
      "index": "firasgptknowledge",
      "vector": embedding,
      "topK": 7,
      "includeMetadata": true
    };
    
    console.log("Sending vector search request to Upstash...");
    console.log("Vector search request shape:", JSON.stringify({
      index: basicRequestBody.index,
      topK: basicRequestBody.topK,
      includeMetadata: basicRequestBody.includeMetadata,
      vectorDimension: embedding.length
    }));
    
    const vectorResponse = await fetch(`${vectorUrl}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vectorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(basicRequestBody),
    });
    
    if (!vectorResponse.ok) {
      const errorText = await vectorResponse.text();
      console.error("Upstash Vector API error:", errorText);
      throw new Error(`Vector search failed: ${vectorResponse.status}`);
    }
    
    const vectorResult = await vectorResponse.json();
    console.log("Vector search response received");
    
    // Check for 'result' property
    if (vectorResult.result && vectorResult.result.length > 0) {
      console.log(`Found ${vectorResult.result.length} matches`);
      
      // Return matches if found - map the result format to our expected format
      return vectorResult.result.map((match) => ({
        text: match.metadata?.text || "No text available",
        source: match.metadata?.source || "Unknown source",
        type: match.metadata?.type || "Unknown type",
        score: match.score
      }));
    }
    
    console.log("No matches found in vector search");
    return [];
    
  } catch (error) {
    console.error("Error in processVectorSearch:", error);
    // Return empty result instead of throwing to maintain function resilience
    return [];
  }
}

// Function to call Perplexity Sonar Deep Research API
async function callSonarDeepResearch(query, apiKey) {
  console.log("Calling Perplexity Sonar Deep Research...");
  
  if (!query || query.trim() === '') {
    console.error("No query provided for Perplexity research");
    throw new Error("No query provided for Perplexity research");
  }
  
  if (!apiKey) {
    console.error("Perplexity API key is missing");
    throw new Error("Perplexity API key is missing");
  }
  
  const url = "https://api.perplexity.ai/chat/completions";
  
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
        messages: [{ role: "user", content: query }],
        max_tokens: 1500
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Perplexity API Error: ${response.status} - ${errorText}`);
      throw new Error(`Perplexity API returned ${response.status}: ${errorText}`);
    }
    
    console.log("Received Perplexity Sonar Deep Research response");
    
    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
      console.error("Invalid response format from Perplexity API:", JSON.stringify(data));
      throw new Error("Invalid response format from Perplexity API");
    }
    
    // Extract the actual response content
    const researchContent = data.choices[0].message.content;
    console.log("Research content length:", researchContent.length);
    
    return researchContent;
  } catch (error) {
    console.error(`Error calling Perplexity API: ${error.message}`);
    throw new Error(`Error retrieving research: ${error.message}`);
  }
}


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
  const geminiApiKey = environmentVariables.GEMINI_API_KEY || '';
  const openAIApiKey = environmentVariables.OPENAI_API_KEY || '';
  const upstashVectorUrl = environmentVariables.UPSTASH_VECTOR_REST_URL || '';
  const upstashVectorToken = environmentVariables.UPSTASH_VECTOR_REST_TOKEN || '';
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting gemsonarclean processing...");
    
    // Get the record ID from the request body
    const requestData = await req.json().catch(() => ({}));
    const recordId = requestData.recordId;
    
    if (!recordId) {
      throw new Error("Record ID is required");
    }
    
    console.log(`Processing text cleaning for record: ${recordId}`);
    
    // Fetch the sonarfactchecked content from the database
    const { data: record, error: fetchError } = await supabase
      .from('tweetgenerationflow')
      .select('sonarfactchecked')
      .eq('id', recordId)
      .maybeSingle();
    
    if (fetchError) {
      console.error(`Error fetching record ${recordId}:`, fetchError);
      throw new Error(`Failed to fetch record ${recordId}: ${fetchError.message}`);
    }
    
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    
    if (!record.sonarfactchecked) {
      throw new Error(`Record ${recordId} has no sonarfactchecked data to clean`);
    }
    
    const factCheckedContent = record.sonarfactchecked;
    console.log("Found fact-checked content. Starting cleaning process...");
    console.log("Fact-checked content length:", factCheckedContent.length);
    console.log("Fact-checked content (first 200 chars):", factCheckedContent.substring(0, 200));
    
    // Use backgroundProcessCleanText function for the long-running operation
    // and return a quick response to avoid timeout
    const backgroundTask = async () => {
      console.log(`Background task started for record: ${recordId}`);
      
      try {
        // Call Gemini API to clean the text
        const cleanedText = await cleanTextWithGemini(factCheckedContent, geminiApiKey);
        
        if (!cleanedText) {
          console.error("Background task error: Text cleaning returned empty content");
          return;
        }
        
        console.log("Text cleaning complete in background task. Saving results to database...");
        console.log("Cleaned text length:", cleanedText.length);
        console.log("Cleaned text (first 200 chars):", cleanedText.substring(0, 200));
        
        // Save the cleaned content back to the database
        const { error: updateError } = await supabase
          .from('tweetgenerationflow')
          .update({
            cleanedsonar: cleanedText
          })
          .eq('id', recordId);
          
        if (updateError) {
          console.error("Background task error: Error updating record with cleaned text:", updateError);
          return;
        }
        
        console.log("Background task: Cleaned text saved to database successfully");
        
        // Split the text into chunks
        const chunks = splitTextIntoChunks(cleanedText);
        console.log(`Split text into ${chunks.length} chunks for embedding`);
        
        // Process each chunk and create embeddings
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(`Processing chunk ${i+1}/${chunks.length}, length: ${chunk.length} characters`);
          
          try {
            // Generate embedding for the chunk
            const embeddingId = await createAndStoreEmbedding(
              chunk, 
              `tweet-generation-${recordId}-chunk-${i+1}`, 
              openAIApiKey,
              upstashVectorUrl,
              upstashVectorToken
            );
            
            console.log(`Successfully created embedding for chunk ${i+1}, ID: ${embeddingId}`);
          } catch (embeddingError) {
            console.error(`Error creating embedding for chunk ${i+1}:`, embeddingError);
          }
        }
        
        console.log(`Background task completed: All chunks processed for record ${recordId}`);
      } catch (error) {
        console.error("Background task error: Text cleaning process failed:", error);
      }
    };
    
    // Start background processing without waiting for completion
    // @ts-ignore - EdgeRuntime is available in Deno edge runtime but TypeScript doesn't know about it
    EdgeRuntime.waitUntil(backgroundTask());
    
    console.log(`Initiated background text cleaning for record: ${recordId}`);
    
    // Return immediate success response while processing continues in background
    return new Response(
      JSON.stringify({ 
        success: true, 
        recordId: recordId,
        message: "Text cleaning initiated and will continue in the background",
        status: "processing"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 202 }
    );
    
  } catch (error) {
    console.error("Text cleaning process failed:", error);
    return new Response(
      JSON.stringify({ error: "Text cleaning process failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to clean text using Gemini API
async function cleanTextWithGemini(content: string, apiKey: string): Promise<string> {
  console.log("Calling Gemini API for text cleaning...");
  
  if (!apiKey) {
    throw new Error("Gemini API key is missing");
  }
  
  if (!content || content.trim() === '') {
    throw new Error("No content provided for text cleaning");
  }
  
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
                text: `Act as a text cleaner. Process the following uncleaned text as follows:

1. REMOVE the entire <think>...text...</think> section at the beginning of the provided uncleaned text (delete it)
2. Scan the entire remaining text and remove all signs of leftover citations such as [4], or [12][3] for example. Remove all these citation number brackets from the entire text without altering or removing anything else.
3. Separate the remaining cleaned text into chunks of a minimal amount of 3 chunks and maximum amount of 8 chunks. Do not edit or alter the text, simply define where the chunks separations must happen based on reasonable semantic relevance

Here is the text to process:
${content}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
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
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log("Received response from Gemini API");
    console.log("Generated text length:", generatedText.length);
    console.log("Generated text (first 200 chars):", generatedText.substring(0, 200));
    
    return generatedText;
  } catch (error) {
    console.error("Error in Gemini API processing:", error);
    throw new Error(`Error processing with Gemini API: ${error.message}`);
  }
}

// Function to split text into chunks
function splitTextIntoChunks(text: string): string[] {
  // The Gemini model should have already separated the text into chunks
  // We'll identify chunk boundaries by looking for "Chunk X:" or similar patterns
  
  const chunkIdentifiers = [
    /Chunk \d+:/i,
    /CHUNK \d+:/i,
    /-- Chunk \d+ --/i,
    /\*\*Chunk \d+\*\*/i,
    /\n\n\d+\.\s/
  ];
  
  let chunks: string[] = [];
  let chunkBoundaries: number[] = [];
  
  // Try to find chunk boundaries using various patterns
  for (const pattern of chunkIdentifiers) {
    const matches = [...text.matchAll(new RegExp(pattern, 'g'))];
    if (matches.length >= 3) { // Minimum 3 chunks as specified
      matches.forEach(match => {
        if (match.index !== undefined) {
          chunkBoundaries.push(match.index);
        }
      });
      break;
    }
  }
  
  // If we found chunk boundaries
  if (chunkBoundaries.length >= 3) {
    for (let i = 0; i < chunkBoundaries.length; i++) {
      const start = chunkBoundaries[i];
      const end = i < chunkBoundaries.length - 1 ? chunkBoundaries[i + 1] : text.length;
      
      let chunkText = text.substring(start, end).trim();
      
      // Remove the chunk identifier from the beginning of the chunk
      for (const pattern of chunkIdentifiers) {
        chunkText = chunkText.replace(pattern, '').trim();
      }
      
      chunks.push(chunkText);
    }
  } else {
    // If no explicit chunk boundaries were found, split by paragraphs and then combine
    // to get between 3 and 8 chunks of roughly equal size
    const paragraphs = text.split(/\n\s*\n/);
    const targetChunkCount = Math.min(Math.max(3, Math.ceil(paragraphs.length / 5)), 8);
    const paragraphsPerChunk = Math.ceil(paragraphs.length / targetChunkCount);
    
    for (let i = 0; i < targetChunkCount; i++) {
      const startIdx = i * paragraphsPerChunk;
      const endIdx = Math.min(startIdx + paragraphsPerChunk, paragraphs.length);
      if (startIdx < paragraphs.length) {
        chunks.push(paragraphs.slice(startIdx, endIdx).join('\n\n'));
      }
    }
  }
  
  console.log(`Split text into ${chunks.length} chunks`);
  chunks.forEach((chunk, i) => {
    console.log(`Chunk ${i+1} length: ${chunk.length}`);
  });
  
  return chunks;
}

// Function to create embedding and store in vector database
async function createAndStoreEmbedding(
  text: string, 
  source: string, 
  apiKey: string, 
  vectorUrl: string, 
  vectorToken: string
): Promise<string> {
  console.log(`Creating embedding for text: ${text.substring(0, 50)}...`);
  
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
    throw new Error("Failed to generate embedding");
  }

  const embeddingData = await embeddingResponse.json();
  const embedding = embeddingData.data[0].embedding;
  
  // Generate unique ID
  const id = crypto.randomUUID();
  
  // Insert into Upstash Vector
  console.log("Inserting vector with ID:", id);
  const vectorResponse = await fetch(`${vectorUrl}/upsert`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${vectorToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      index: "firasgptknowledge",
      id,
      vector: embedding,
      metadata: {
        text,
        source,
        type: "sonar_cleaned",
        timestamp: new Date().toISOString()
      }
    }),
  });

  if (!vectorResponse.ok) {
    const error = await vectorResponse.text();
    console.error("Upstash Vector API error:", error);
    throw new Error("Failed to insert into vector database");
  }

  return id;
}

// Listen for shutdown event to log when the function is terminated
addEventListener('beforeunload', (event) => {
  console.log('Function is shutting down, reason:', event.detail?.reason);
});

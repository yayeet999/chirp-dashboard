
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
  const geminiApiKey = environmentVariables.GEMINI_API_KEY || '';
  const openAIApiKey = environmentVariables.OPENAI_API_KEY || '';
  const upstashVectorUrl = environmentVariables.UPSTASH_VECTOR_REST_URL || '';
  const upstashVectorToken = environmentVariables.UPSTASH_VECTOR_REST_TOKEN || '';
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting combined sonarfactchecker and gemsonarclean processing...");
    
    // Get the record ID from the request body
    const requestData = await req.json().catch(() => ({}));
    const recordId = requestData.recordId;
    
    if (!recordId) {
      throw new Error("Record ID is required");
    }
    
    console.log(`Processing record: ${recordId}`);
    
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
      throw new Error(`Record ${recordId} has no sonardeepresearch data to process`);
    }
    
    const researchContent = record.sonardeepresearch;
    console.log("Found research content. Starting processing...");
    console.log("Research content length:", researchContent.length);
    console.log("Research content (first 200 chars):", researchContent.substring(0, 200));
    
    // Use backgroundProcessing function for the entire workflow
    const backgroundTask = async () => {
      console.log(`Background task started for record: ${recordId}`);
      
      try {
        // STEP 1: Fact Check with Perplexity API
        console.log("Step 1: Fact checking with Perplexity API");
        const factCheckedContent = await callFactCheckResearch(researchContent, perplexityApiKey);
        
        if (!factCheckedContent) {
          console.error("Background task error: Fact checking returned empty content");
          return;
        }
        
        console.log("Fact checking complete. Saving results to database...");
        console.log("Fact checked content length:", factCheckedContent.length);
        console.log("Fact checked content (first 200 chars):", factCheckedContent.substring(0, 200));
        
        // Save the fact-checked content to the database
        const { error: updateFactCheckedError } = await supabase
          .from('tweetgenerationflow')
          .update({
            sonarfactchecked: factCheckedContent
          })
          .eq('id', recordId);
          
        if (updateFactCheckedError) {
          console.error("Background task error: Error updating record with fact-checked content:", updateFactCheckedError);
          throw new Error(`Failed to update sonarfactchecked: ${updateFactCheckedError.message}`);
        }
        
        console.log("Step 1 completed: Fact-checked content saved to database successfully");
        
        // STEP 2: Clean Text with Gemini API
        console.log("Step 2: Cleaning text with Gemini API");
        const cleanedText = await cleanTextWithGemini(factCheckedContent, geminiApiKey);
        
        if (!cleanedText) {
          console.error("Background task error: Text cleaning returned empty content");
          throw new Error("Text cleaning returned empty content");
        }
        
        console.log("Text cleaning complete. Saving results to database...");
        console.log("Cleaned text length:", cleanedText.length);
        console.log("Cleaned text (first 200 chars):", cleanedText.substring(0, 200));
        
        // Save the cleaned content to the database
        const { error: updateCleanedError } = await supabase
          .from('tweetgenerationflow')
          .update({
            cleanedsonar: cleanedText
          })
          .eq('id', recordId);
          
        if (updateCleanedError) {
          console.error("Background task error: Error updating record with cleaned text:", updateCleanedError);
          throw new Error(`Failed to update cleanedsonar: ${updateCleanedError.message}`);
        }
        
        console.log("Step 2 completed: Cleaned text saved to database successfully");
        
        // STEP 3: Split text into chunks and create embeddings
        console.log("Step 3: Splitting text and creating embeddings");
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
            // Continue with other chunks even if one fails
          }
        }
        
        console.log(`Background task completed: Full workflow completed successfully for record ${recordId}`);
      } catch (error) {
        console.error("Background task error: Processing failed:", error);
      }
    };
    
    // Start background processing without waiting for completion
    // @ts-ignore - EdgeRuntime is available in Deno edge runtime but TypeScript doesn't know about it
    EdgeRuntime.waitUntil(backgroundTask());
    
    console.log(`Initiated background processing for record: ${recordId}`);
    
    // Return immediate success response while processing continues in background
    return new Response(
      JSON.stringify({ 
        success: true, 
        recordId: recordId,
        message: "Processing initiated and will continue in the background",
        status: "processing"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 202 }
    );
    
  } catch (error) {
    console.error("Processing failed:", error);
    return new Response(
      JSON.stringify({ error: "Processing failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to fact check research using Perplexity API
async function callFactCheckResearch(reportContent: string, apiKey: string): Promise<string> {
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
                text: `Act as a text cleaner. You will be given a text input that you must properly clean. This involves only removing certain unwanted sections/text, ensuring you do NOT ADD, EDIT, OR ALTER THE REMAINING TEXT IN ANY WAY, YOU SIMPLY ONLY CLEAN WHAT YOU ARE INSTRUCTED TO CLEAN:

1. REMOVE the entire <think>...text...</think> section at the beginning of the provided uncleaned text. This can be confusing so to ensure this is done correctly you MUST DO THE FOLLOWING FOR THIS STEP: Find and locate the very first <think> in the text, and then find and locate where </think> is mentioned for the very last time in the text. Delete both the very first <think>, the very last </think>, and all the text in between.
2. Scan the entire remaining text and remove all signs of leftover citations such as [4], or [12][3] for example. Remove all these citation number brackets from the entire text without altering or removing anything else.
3. After you finish step 2, you now have a fully cleaned text. Do NOT add any text/edits/alterations at ALL. Do not add any extra statements or comments. The text is now correctly fully cleaned.
4. Separate the now cleaned text into chunks of a minimal amount of 3 chunks and maximum amount of 8 chunks. Do not edit or alter the text, simply define where the chunks separations must happen based on reasonable semantic relevance

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

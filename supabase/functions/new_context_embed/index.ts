
// New Context Embedding Function
// Processes unrefined context with Gemini and embeds chunks with OpenAI

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
const upstashVectorUrl = Deno.env.get('UPSTASH_VECTOR_REST_URL');
const upstashVectorToken = Deno.env.get('UPSTASH_VECTOR_REST_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const environmentVariables = Deno.env.toObject();
    const supabaseUrl = environmentVariables.SUPABASE_URL || '';
    const supabaseAnonKey = environmentVariables.SUPABASE_ANON_KEY || '';
    
    console.log("Starting new_context_embed processing...");
    
    // Create a Supabase client
    const supabase = {
      from: (table: string) => {
        return {
          select: (columns: string) => {
            return {
              order: (column: string, { ascending }: { ascending: boolean }) => {
                return {
                  limit: (limit: number) => {
                    // Construct the URL with query parameters
                    const orderDirection = ascending ? 'asc' : 'desc';
                    const url = `${supabaseUrl}/rest/v1/${table}?select=${columns}&order=${column}.${orderDirection}&limit=${limit}`;
                    
                    return fetch(url, {
                      headers: {
                        'apikey': supabaseAnonKey,
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                      },
                    }).then(res => res.json());
                  }
                };
              }
            };
          }
        };
      }
    };
    
    // Get the latest unrefined context
    const latestUnrefined = await supabase
      .from('unrefined')
      .select('id,shortterm_context2_unrefined,created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!latestUnrefined || latestUnrefined.length === 0 || !latestUnrefined[0].shortterm_context2_unrefined) {
      console.log("No unrefined context found or context is empty");
      return new Response(
        JSON.stringify({ message: "No unrefined context found or context is empty" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    const unrefined = latestUnrefined[0];
    console.log(`Processing unrefined context with ID: ${unrefined.id}`);
    
    // Process with Gemini API to get chunks
    const chunks = await processWithGemini(unrefined.shortterm_context2_unrefined, geminiApiKey);
    console.log(`Generated ${chunks.length} chunks from Gemini processing`);
    
    // Create embeddings and store them for each chunk
    const embeddingResults = [];
    for (const chunk of chunks) {
      try {
        const embeddingResult = await createAndStoreEmbedding(chunk.text, chunk.source, openAIApiKey, upstashVectorUrl, upstashVectorToken);
        embeddingResults.push({
          chunk: chunk,
          embedding: embeddingResult,
          success: true
        });
      } catch (error) {
        console.error(`Error processing chunk: ${error.message}`);
        embeddingResults.push({
          chunk: chunk,
          error: error.message,
          success: false
        });
      }
    }
    
    console.log(`Completed processing ${embeddingResults.length} chunks with ${embeddingResults.filter(r => r.success).length} successes`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Context processed and embedded",
        totalChunks: chunks.length,
        successfulEmbeddings: embeddingResults.filter(r => r.success).length,
        failedEmbeddings: embeddingResults.filter(r => !r.success).length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Error in new_context_embed function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Function to process text with Gemini API
async function processWithGemini(inputText: string, apiKey: string): Promise<Array<{text: string, source: string}>> {
  console.log("Calling Gemini API for text chunking...");
  
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
                text: `You are to prepare this text document for proper vector embedding while preserving context and ensuring relevance. Read and understand the text. It will often be the case that the text content is somewhat already in chunks of relevancy, however either way, ensure the text content is segmented into smaller chunks based on logical divisions of topics, content, details, etc. Aim for chunks of approximately 400-800 words each, ensuring each chunk is self-contained yet focused on a single key concept or idea. Adjust chunk size slightly if needed to preserve meaning. You'll often find that sometimes the text is already in a similar formatting, if that is that case, ensure it's properly formatted for embedding. There should be no visuals, no emojis, no bullet points or numbered lists in the embedding chunks.

The chunks should consist of:
- A single paragraph text string for the text input (approx 400-800 words)
- A publication year and month (if available): The year and month the document was published (e.g., "2023-05").

OUTPUT FORMAT: Present each chunk in the following structure:
   
   - Text: [Single string paragraph text of approximately 400-800 words]
   - Source: [YYYY-MM] (publication date if available)

FINAL INSTRUCTIONS: Follow the instructions given to you. Do not include extra comments or statements.

${inputText}`
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
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Parse the generated text to extract chunks
    const chunks = parseGeminiOutput(generatedText);
    console.log(`Parsed ${chunks.length} chunks from Gemini output`);
    
    return chunks;
  } catch (error) {
    console.error("Error in Gemini API processing:", error);
    throw new Error(`Error processing with Gemini API: ${error.message}`);
  }
}

// Function to parse Gemini output into chunks
function parseGeminiOutput(output: string): Array<{text: string, source: string}> {
  try {
    const chunks: Array<{text: string, source: string}> = [];
    
    // Split by chunks (look for "- Text:" markers)
    const chunkRegex = /- Text: ([\s\S]*?)(?=- Source:|$)/g;
    const sourceRegex = /- Source: (\d{4}-\d{2}|N\/A)/g;
    
    let chunkMatch;
    let sourceMatch;
    const chunkTexts: string[] = [];
    const sourceDates: string[] = [];
    
    // Extract all text chunks
    while ((chunkMatch = chunkRegex.exec(output)) !== null) {
      chunkTexts.push(chunkMatch[1].trim());
    }
    
    // Extract all source dates
    while ((sourceMatch = sourceRegex.exec(output)) !== null) {
      sourceDates.push(sourceMatch[1].trim());
    }
    
    // Combine text and source (using current date if source is missing)
    for (let i = 0; i < chunkTexts.length; i++) {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      
      chunks.push({
        text: chunkTexts[i],
        source: i < sourceDates.length ? sourceDates[i] : `${year}-${month}`
      });
    }
    
    return chunks;
  } catch (error) {
    console.error("Error parsing Gemini output:", error);
    return [];
  }
}

// Function to create embedding and store in vector database
async function createAndStoreEmbedding(text: string, source: string, apiKey: string, vectorUrl: string, vectorToken: string): Promise<string> {
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
        type: "newsletter_context",
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


import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
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
    const { text, metadata } = await req.json();
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate embedding from OpenAI
    console.log("Generating embedding for text:", text.substring(0, 50) + "...");
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
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
      return new Response(
        JSON.stringify({ error: "Failed to generate embedding" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;
    
    // Generate unique ID
    const id = crypto.randomUUID();
    
    // Insert into Upstash Vector
    console.log("Inserting vector with ID:", id);
    const vectorResponse = await fetch(`${upstashVectorUrl}/upsert`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${upstashVectorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        index: "firasgptknowledge",
        id,
        vector: embedding,
        metadata: {
          text,
          ...metadata,
          timestamp: new Date().toISOString()
        }
      }),
    });

    if (!vectorResponse.ok) {
      const error = await vectorResponse.text();
      console.error("Upstash Vector API error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to insert into vector database" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const vectorResult = await vectorResponse.json();
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        id, 
        message: "Successfully inserted into vector database" 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in vector-embeddings function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

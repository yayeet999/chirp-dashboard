
// Short-term Refiner 1
// Processes the unrefined Twitter context data using Google Gemini API

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const environmentVariables = Deno.env.toObject();
  const supabaseUrl = environmentVariables.SUPABASE_URL || '';
  const supabaseAnonKey = environmentVariables.SUPABASE_ANON_KEY || '';
  const geminiApiKey = environmentVariables.GEMINI_API_KEY || '';
  
  // Validate required environment variables
  if (!geminiApiKey) {
    console.error("Missing GEMINI_API_KEY environment variable");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting shortterm-refiner1 processing...");
    
    // Parse request body
    const { unrefined_id } = await req.json();
    
    if (!unrefined_id) {
      return new Response(
        JSON.stringify({ error: "Missing unrefined_id parameter" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Fetch the specified unrefined record
    const { data: unrefined, error: fetchError } = await supabase
      .from('unrefined')
      .select('shortterm_context1_unrefined')
      .eq('id', unrefined_id)
      .single();
      
    if (fetchError) {
      console.error("Error fetching unrefined record:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch unrefined record" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    if (!unrefined || !unrefined.shortterm_context1_unrefined) {
      console.log("No unrefined content found to process");
      return new Response(
        JSON.stringify({ message: "No unrefined content to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    // Process the unrefined content with Gemini API
    console.log("Processing unrefined content with Gemini API...");
    const refinedContext = await processWithGemini(unrefined.shortterm_context1_unrefined, geminiApiKey);
    
    // Always create a new row in memory_context
    const { data: insertData, error: insertError } = await supabase
      .from('memory_context')
      .insert([{ shortterm_context1: refinedContext }])
      .select('id');
      
    if (insertError) {
      console.error("Error creating memory context:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create memory context" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    const contextId = insertData?.[0]?.id;
    console.log(`Short-term refiner 1 processing completed and stored with ID: ${contextId}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Short-term refiner 1 processing completed",
        context_id: contextId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Short-term refiner 1 processing failed:", error);
    return new Response(
      JSON.stringify({ error: "Short-term refiner 1 processing failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to process data with Google Gemini API
async function processWithGemini(inputData: string, apiKey: string): Promise<string> {
  console.log("Calling Gemini API for refinement...");
  
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
                text: `You presented with a chronological list of individual tweets as well as the top 5 keywords/phrases, common sentiments and themes/discussions. You are to focus on the section of the top 5 keywords/phrases, common sentiments and themes/discussions.. You will expand on this section by adding specific context and brief explanations for each of key words, themes, and discussions based on further analysis of the list of tweets. Add context and details to present a clearer view of the context of the top 5 keywords/phrases, common sentiments and themes/discussions based on the list of tweets. Keep your output based on analysis of the tweets only. Do not hallucinate information. Do your best to add correct context if applicable. FINAL INSTRUCTIONS: Perform only the instructions assigned to you. Do not include extra side comments or statements.

${inputData}`
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
    console.log("Gemini API response received successfully");
    
    // Extract the generated content
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || 
                           "No content generated from Gemini API";
    
    return generatedText;
  } catch (error) {
    console.error("Error in Gemini API processing:", error);
    return `Error processing with Gemini API: ${error.message}`;
  }
}

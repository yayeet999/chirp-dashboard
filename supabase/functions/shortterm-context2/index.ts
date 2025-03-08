
// Short-term Context 2 Processor
// Processes recent newsletter data using Google Gemini API

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
    console.log("Starting short-term context 2 processing...");
    
    // Calculate date 3 days ago
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const formattedDate = threeDaysAgo.toISOString();
    
    console.log(`Fetching newsletters from ${formattedDate} and earlier`);
    
    // Fetch newsletters from 3 days ago and earlier
    const { data: newsletters, error: fetchError } = await supabase
      .from('newsletters')
      .select('content, newsletter_date, created_at')
      .lte('created_at', formattedDate)
      .order('created_at', { ascending: true });
      
    if (fetchError) {
      console.error("Error fetching newsletters:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch newsletters" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    if (!newsletters || newsletters.length === 0) {
      console.log("No newsletters found to process");
      return new Response(
        JSON.stringify({ message: "No newsletters to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    // Combine newsletter content in chronological order
    let combinedNewsletters = "";
    for (const newsletter of newsletters) {
      const date = newsletter.newsletter_date || newsletter.created_at;
      combinedNewsletters += `DATE: ${new Date(date).toLocaleDateString()}\n\n${newsletter.content}\n\n---\n\n`;
    }
    
    // Process the combined data with Google Gemini API
    console.log("Processing newsletter data with Gemini API...");
    const processedContext = await processWithGemini(combinedNewsletters, geminiApiKey);
    
    // Get the latest unrefined record to update
    const { data: latestUnrefined, error: getError } = await supabase
      .from('unrefined')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (getError) {
      console.error("Error fetching latest unrefined record:", getError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch latest unrefined record" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    let contextId;
    
    if (latestUnrefined && latestUnrefined.length > 0) {
      // Update the existing record with the newsletter context
      const { error: updateError } = await supabase
        .from('unrefined')
        .update({ shortterm_context2_unrefined: processedContext })
        .eq('id', latestUnrefined[0].id);
        
      if (updateError) {
        console.error("Error updating unrefined record:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update unrefined record" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      contextId = latestUnrefined[0].id;
    } else {
      // Create a new record if no recent one exists
      const { data: insertData, error: insertError } = await supabase
        .from('unrefined')
        .insert([{ shortterm_context2_unrefined: processedContext }])
        .select('id');
        
      if (insertError) {
        console.error("Error creating unrefined record:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create unrefined record" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      contextId = insertData?.[0]?.id;
    }
    
    console.log(`Short-term context 2 processing completed and stored with ID: ${contextId}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Short-term context 2 processing completed",
        context_id: contextId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Short-term context 2 processing failed:", error);
    return new Response(
      JSON.stringify({ error: "Short-term context 2 processing failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to process data with Google Gemini API
async function processWithGemini(inputData: string, apiKey: string): Promise<string> {
  console.log("Calling Gemini API...");
  
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
                text: `You are an AI assistant specialized in processing and summarizing newsletter data.
                
Please analyze and process the following data from AI-related newsletters.
Organize the information chronologically and extract the most relevant insights about new AI models, technologies, and trends.
Focus on factual information and key developments in the AI field.

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

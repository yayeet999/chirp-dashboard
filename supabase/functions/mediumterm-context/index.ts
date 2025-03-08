
// Medium-term Context Processor
// Processes recent short-term context entries using Google Gemini API

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
    console.log("Starting medium-term context processing...");
    
    // Fetch the 3 most recent entries from memory_context for both context types
    const { data: recentContext, error: fetchError } = await supabase
      .from('memory_context')
      .select('shortterm_context1, shortterm_context2, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
      
    if (fetchError) {
      console.error("Error fetching recent context:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch recent context" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    if (!recentContext || recentContext.length === 0) {
      console.log("No recent context found to process");
      return new Response(
        JSON.stringify({ message: "No context to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    // Sort by created_at in ascending order
    recentContext.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    // Extract both context types
    let shortTermContext1 = "";
    let shortTermContext2 = "";
    
    for (const context of recentContext) {
      if (context.shortterm_context1) {
        shortTermContext1 += context.shortterm_context1 + "\n\n---\n\n";
      }
      
      if (context.shortterm_context2) {
        shortTermContext2 += context.shortterm_context2 + "\n\n---\n\n";
      }
    }
    
    // Combine both contexts for processing
    const combinedData = `
TWEET ANALYSES (3 SEPARATE ANALYSES):
${shortTermContext1}

NEWSLETTER SUMMARIES (3 SEPARATE SUMMARIES):
${shortTermContext2}
`;
    
    // Process the combined data with Google Gemini API
    console.log("Processing medium-term context with Gemini API...");
    const processedContext = await processWithGemini(combinedData, geminiApiKey);
    
    // Store the processed data in the memory_context table
    const { data: insertData, error: insertError } = await supabase
      .from('memory_context')
      .insert([{ mediumterm_context: processedContext }])
      .select('id');
      
    if (insertError) {
      console.error("Error storing processed medium-term context:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store processed medium-term context" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    const contextId = insertData?.[0]?.id;
    console.log(`Medium-term context processing completed and stored with ID: ${contextId}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Medium-term context processing completed",
        context_id: contextId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Medium-term context processing failed:", error);
    return new Response(
      JSON.stringify({ error: "Medium-term context processing failed", details: error.message }),
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
                text: `You are presented with 6 total sources of text content. 3 of these are each an individual analysis of a large collection of individual tweets. Each tweet analysis consists of the top keywords/phrases, sentiments, and themes/discussions of their respective large collection of tweets, each analysis represents the major and important aspects of a chronological large, aggregated collection of tweets about topics related to AI, LLMs, models, AI news/updates, etc. The other 3 sources of text content are brief shortened summaries and key concepts of a collection of newsletters relating to topics of AI, LLMs, models, AI news/updates, etc. These are very detailed summaries highlighting the key points and important details of chronologically recent and relevant news, discussions and updates. YOUR TASK is to combine the two into a very compact and shortened summary that aggregates and synthesizes the information from all six sources. From the three tweet analyses, aggregate the top mentioned keywords/phrases, sentiments, and themes into a concise overview. From the three newsletter summaries, extract the key points and updates. Then, generate a compact summary structured as: 
 
-Keywords: List the five most frequent or impactful keywords/phrases from the tweet analyses. Be sure to avoid overly simple keywords/phrases such as 'AI', 'code', 'hard work', for example, but ensure you are accurate based on the sources you were given. Do not assume or hallucinate

-Sentiment and Themes: Briefly describe the dominant sentiment and the three primary themes from the tweets. Again ensure that these are not overly simple, while ensuring they are accurate based on the sources you were given.  

-Updates and Insights: Summarize and list the information from the newsletters, adding context or depth to the tweet findings where relevant. Keep the summary short, emphasizing the most critical and complementary information from both sources. 

FINAL INSTRUCTIONS: Perform only the instructions assigned to you. Do not include extra side comments or statements.

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

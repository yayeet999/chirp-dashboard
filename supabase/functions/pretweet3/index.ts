
// Pretweet3 Edge Function
// This function generates content categories for tweet themes

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
  
  try {
    console.log("Starting pretweet3 process to categorize content...");
    
    // Parse the request body if available
    let requestData = {};
    try {
      requestData = await req.json();
    } catch (e) {
      // If parsing fails, continue with empty object
      console.log("No request body or invalid JSON");
    }
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Get recordId from the request or fetch the latest record
    let recordId = requestData.recordId;
    let record;
    
    if (recordId) {
      console.log(`Using provided recordId: ${recordId}`);
      
      // Fetch the record with the provided ID
      const { data, error } = await supabase
        .from('tweetgenerationflow')
        .select('pretweet2, geminiobservation')
        .eq('id', recordId)
        .maybeSingle();
      
      if (error) {
        throw new Error(`Error fetching tweetgenerationflow record: ${error.message}`);
      }
      
      if (!data) {
        throw new Error(`No record found with ID: ${recordId}`);
      }
      
      record = data;
    } else {
      console.log("No recordId provided, fetching most recent record");
      
      // Get the most recent record from tweetgenerationflow
      const { data, error } = await supabase
        .from('tweetgenerationflow')
        .select('id, pretweet2, geminiobservation')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        throw new Error(`Error fetching most recent tweetgenerationflow record: ${error.message}`);
      }
      
      if (!data) {
        throw new Error("No tweetgenerationflow records found");
      }
      
      recordId = data.id;
      record = data;
      console.log(`Using most recent record with ID: ${recordId}`);
    }
    
    // Validate that we have the required data
    if (!record.pretweet2) {
      throw new Error(`Record ${recordId} is missing pretweet2 data`);
    }
    
    if (!record.geminiobservation) {
      throw new Error(`Record ${recordId} is missing geminiobservation data`);
    }
    
    console.log("Found pretweet2 and geminiobservation data, processing with Gemini API...");
    
    // Set up the prompt for Gemini API
    const systemPrompt = `As a senior AI researcher specializing in content optimization for social media, your task is to analyze the provided tweet angles and an observation data, then categorize the content to direct it to the correct group for final processing.

You will receive two pieces of information:
1. A list of potential tweet angles/ideas focusing on AI/ML topics
2. A specific observation about a trending topic or discussion point in the AI community

Based on this input, you need to determine which of our specialized tweet writing teams would be most suitable for crafting the final tweet. Each team has different expertise:

- **Technical Team**: Specializes in technical AI concepts, research papers, model architectures, and developer-focused content. Their tweets include technical details, code examples, benchmarks, and implementation insights.

- **News & Updates Team**: Focuses on breaking AI news, product launches, company announcements, and industry updates. Their tweets are timely, factual, and provide concise summaries of recent developments.

- **Analysis & Opinion Team**: Provides thoughtful perspectives on AI trends, ethical considerations, and broader implications. Their tweets offer nuanced takes, pose thought-provoking questions, and contextualize developments.

- **Educational Team**: Creates content that explains AI concepts, demystifies technical topics for non-experts, and shares learning resources. Their tweets make complex ideas accessible and often include analogies or simplified explanations.

YOUR TASK:
1. Analyze both the tweet angles and observation data
2. Determine which team's expertise would best align with this content
3. Provide a brief explanation of why this team is the best match
4. Identify 2-3 key elements from the input that the chosen team should emphasize in the final tweet

OUTPUT FORMAT:
Provide your analysis in the following JSON structure:
{
  "selected_team": "[Technical/News & Updates/Analysis & Opinion/Educational]",
  "rationale": "Brief explanation of why this team is best suited (2-3 sentences)",
  "key_elements": [
    "Element 1 to emphasize",
    "Element 2 to emphasize",
    "Element 3 to emphasize (if applicable)"
  ],
  "content_type": "[Technical deep dive/Breaking news/Industry update/Opinion piece/Educational content/Thought leadership]"
}

Important Guidelines:
- Make your assessment based SOLELY on the content provided, not on assumptions about what might perform well
- Be decisive - assign to the single MOST appropriate team
- The "content_type" should be specific and match the selected team's focus
- The "key_elements" should be specific phrases or concepts from the input that should be emphasized`;

    const userPrompt = `Please analyze the following content and determine the most appropriate team and content type:

<input_received>
<angles>
${record.pretweet2}
</angles>

<geminiobservation>
${record.geminiobservation}
</geminiobservation>
</input_received>

Based on the above information, which team should handle this content, and what elements should they emphasize?`;

    
    // Call Gemini API
    const generationResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: userPrompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });
    
    if (!generationResponse.ok) {
      const errorText = await generationResponse.text();
      throw new Error(`Gemini API error: ${generationResponse.status} - ${errorText}`);
    }
    
    const generationData = await generationResponse.json();
    const generatedText = generationData.candidates[0]?.content?.parts[0]?.text || "";
    
    console.log("Gemini API response received:", generatedText);
    
    // Extract the JSON from the response text
    let categorization;
    try {
      // Look for JSON in the text (it might be wrapped in markdown code blocks)
      const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/) || 
                       generatedText.match(/```\n([\s\S]*?)\n```/) || 
                       generatedText.match(/{[\s\S]*?}/);
      
      const jsonString = jsonMatch ? jsonMatch[0].replace(/```json\n|```\n|```/g, '') : generatedText;
      categorization = JSON.parse(jsonString);
      
      console.log("Extracted categorization:", categorization);
    } catch (error) {
      console.error("Error parsing JSON from Gemini response:", error);
      categorization = {
        selected_team: "Error parsing response",
        rationale: "Could not extract valid JSON from the API response",
        key_elements: ["Error in processing"],
        content_type: "Error"
      };
    }
    
    // Update the record with the categorization results
    const { data: updateData, error: updateError } = await supabase
      .from('tweetgenerationflow')
      .update({ pretweet3: JSON.stringify(categorization) })
      .eq('id', recordId)
      .select();
    
    if (updateError) {
      throw new Error(`Error updating tweetgenerationflow record: ${updateError.message}`);
    }
    
    console.log("Content categorization completed and saved to database");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        recordId, 
        categorization 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("pretweet3 error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

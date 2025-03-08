
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting Gemini analysis based on deepinitial observations...");
    
    // Get the record ID from the request body if provided
    const requestData = await req.json().catch(() => ({}));
    let recordId = requestData.recordId;
    
    // If no record ID is provided, fetch the most recent tweetgenerationflow entry
    if (!recordId) {
      const { data: latestRecord, error: fetchError } = await supabase
        .from('tweetgenerationflow')
        .select('id, deepinitial, created_at')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (fetchError) {
        console.error("Error fetching latest tweetgenerationflow record:", fetchError);
        throw new Error("Failed to fetch latest tweetgenerationflow record");
      }
      
      if (!latestRecord || latestRecord.length === 0) {
        throw new Error("No tweetgenerationflow records found");
      }
      
      recordId = latestRecord[0].id;
      
      // Ensure we have deepinitial data
      if (!latestRecord[0].deepinitial) {
        throw new Error("Latest record has no deepinitial analysis data");
      }
      
      console.log(`Using most recent tweetgenerationflow record: ${recordId}`);
    } else {
      console.log(`Using provided tweetgenerationflow record: ${recordId}`);
    }
    
    // Fetch the specific tweetgenerationflow record
    const { data: record, error: recordError } = await supabase
      .from('tweetgenerationflow')
      .select('deepinitial')
      .eq('id', recordId)
      .single();
    
    if (recordError) {
      console.error(`Error fetching tweetgenerationflow record ${recordId}:`, recordError);
      throw new Error(`Failed to fetch tweetgenerationflow record ${recordId}`);
    }
    
    if (!record || !record.deepinitial) {
      throw new Error(`Record ${recordId} has no deepinitial analysis data`);
    }
    
    console.log("Found deepinitial analysis. Preparing for Gemini API call...");
    
    // Placeholder for tweet history (will be implemented later)
    const recentTweetHistory = "[Placeholder: No recent tweet history available yet]";
    
    // Prepare the prompt for Gemini
    const systemPrompt = `Your goal is to narrow down to the top observation choice from a list of 5-8 candidates to guide tweet ideation for an AI news/content focused account. Follow these steps to prioritize strategic balance over raw scores:  

**1. Topic Repetition Filter**  
First, check the core topics of the recent tweet history (if any). If the recent history shares the same repetitive primary topic, automatically disqualify any observations matching that topic. This prevents three consecutive tweets on the same subject.  

**2. Score Each Observation**  
Assign points to the remaining observations using three criteria:  
- **Engagement Potential**:  
  Add points if the observation ties to an active debate, controversy, or highly shareable currently trending/commonly repeated content.  
  Add points if it poses a thought-provoking question or highlights an underexplored angle.  
- **Relevance**:  
  Add points if keywords/phrases are present in the observations and also commonly repeatedly in the context sources, sentiment, news, etc.
- **Style Bonus**:  
  Add points if the predicted tweet style and vibes of an observation differs from the styles of the last two tweets.

**3. Rank and Strategically Prioritize**  
Now internally calculate each observation's hypothetical score, then rank them from highest to lowest. Instead of selecting the top 2-3 outright, apply these refinements:  
- **Diversity Check**: If the top 2-3 observations share the same style or overlapping keywords, replace the lowest-scoring redundant entry with the next highest-scoring observation that introduces stylistic or topical variety.  
- **Impact vs. Timeliness**: If scores are tied, prioritize observations that either (a) address high-impact implications or (b) reference the freshest data (c) informative and useful  
- **Audience Resonance**: Bonus score if the keywords/phrases of the observations are commonly found in the included context sources.  

**4. Final Selection**  
Now focus on the top 2-3 observations after applying the above adjustments. Based on everything we've discussed, make a judgement call and select a single observation. This single observation will be your output. Do not alter or edit it.`;

    const userInput = `Recent Tweet History:
${recentTweetHistory}

Deep Initial Analysis Observations:
${record.deepinitial}

Based on the system prompt instructions, select the single best observation that would make the most strategic tweet topic.`;

    console.log("Calling Gemini API...");
    
    // Call Gemini API
    const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent";
    const url = `${geminiEndpoint}?key=${geminiApiKey}`;
    
    const geminiPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt + "\n\n" + userInput }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    };
    
    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(geminiPayload)
    });
    
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API returned ${geminiResponse.status}: ${errorText}`);
    }
    
    const geminiResult = await geminiResponse.json();
    console.log("Gemini API response received");
    
    // Extract the top observation from Gemini's response
    const topObservation = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || 
                        "No observation selected by Gemini API";
    
    // Update the tweetgenerationflow record with the Gemini result
    const { data: updateData, error: updateError } = await supabase
      .from('tweetgenerationflow')
      .update({ geminiobservation: topObservation })
      .eq('id', recordId)
      .select();
      
    if (updateError) {
      console.error("Error updating tweetgenerationflow with Gemini observation:", updateError);
      throw new Error("Failed to save Gemini observation to database");
    }
    
    console.log("Gemini observation saved to tweetgenerationflow table");
    
    // Return the top observation and recordId in the response
    return new Response(
      JSON.stringify({ 
        success: true, 
        topObservation: topObservation,
        recordId: recordId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return new Response(
      JSON.stringify({ error: "Gemini analysis failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});


import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const environmentVariables = Deno.env.toObject();
  const supabaseUrl = environmentVariables.SUPABASE_URL || '';
  const supabaseAnonKey = environmentVariables.SUPABASE_ANON_KEY || '';
  const geminiApiKey = environmentVariables.GEMINI_API_KEY || '';
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting Gemini analysis based on deepinitial observations...");
    
    const requestData = await req.json().catch(() => ({}));
    let recordId = requestData.recordId;
    
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
      
      if (!latestRecord[0].deepinitial) {
        throw new Error("Latest record has no deepinitial analysis data");
      }
      
      console.log(`Using most recent tweetgenerationflow record: ${recordId}`);
    } else {
      console.log(`Using provided tweetgenerationflow record: ${recordId}`);
    }
    
    // Implement retry logic for fetching the record
    let record = null;
    let recordError = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      const { data, error } = await supabase
        .from('tweetgenerationflow')
        .select('deepinitial')
        .eq('id', recordId)
        .maybeSingle();
      
      if (error) {
        console.error(`Error fetching tweetgenerationflow record ${recordId} (attempt ${retryCount + 1}):`, error);
        recordError = error;
        retryCount++;
        
        if (retryCount < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const backoffTime = Math.pow(2, retryCount) * 1000;
          console.log(`Retrying in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      } else if (!data || !data.deepinitial) {
        console.warn(`Record ${recordId} not found or has no deepinitial data (attempt ${retryCount + 1})`);
        retryCount++;
        
        if (retryCount < maxRetries) {
          // Exponential backoff but with a different message
          const backoffTime = Math.pow(2, retryCount) * 1000;
          console.log(`Record might still be committing to database. Retrying in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      } else {
        record = data;
        break; // Success, exit the retry loop
      }
    }
    
    // If we still don't have the record after all retries, throw an error
    if (!record || !record.deepinitial) {
      throw new Error(`Record ${recordId} not found or has no deepinitial analysis data after ${maxRetries} attempts. ${recordError ? `Last error: ${recordError.message}` : ''}`);
    }
    
    console.log("Found deepinitial analysis. Preparing for Gemini API call...");
    
    const recentTweetHistory = "[Placeholder: No recent tweet history available yet]";
    
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
Now focus on the top 2-3 observations after applying the above adjustments. Based on everything we've discussed, make a judgement call and select a single observation. This single observation will be your output.

**CRITICALLY IMPORTANT OUTPUT INSTRUCTIONS:**
- You MUST output ONLY the exact text of your chosen observation, with ABSOLUTELY NO modifications or additions
- Do NOT add any introduction, explanation, reasoning, or conclusion
- Do NOT add phrases like "I've selected" or "The best observation is"
- Do NOT add any additional thoughts or commentary
- Simply output the exact text of the chosen observation, preserving its original format (however remove the word Observation, and the Observation number, but preserve the Summary, and Why It's Relevant sections EXACTLY as is in your output)
- Your entire response should ONLY be the EXACT Summary and Why It's Relevant sections text of the selected observation, nothing more and nothing less`;

    const userInput = `Recent Tweet History:
${recentTweetHistory}

Deep Initial Analysis Observations:
${record.deepinitial}

Based on the system prompt instructions, select the single best observation that would make the most strategic tweet topic. OUTPUT ONLY THE EXACT TEXT OF THE CHOSEN OBSERVATION WITH NO MODIFICATIONS OR ADDITIONS.`;

    console.log("Calling Gemini API...");
    
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
    
    // Implement retry logic for the Gemini API call as well
    let geminiResult = null;
    let geminiError = null;
    retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const geminiResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(geminiPayload)
        });
        
        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error(`Gemini API error (attempt ${retryCount + 1}):`, errorText);
          geminiError = `Gemini API returned ${geminiResponse.status}: ${errorText}`;
          retryCount++;
          
          if (retryCount < maxRetries) {
            const backoffTime = Math.pow(2, retryCount) * 1000;
            console.log(`Retrying Gemini API call in ${backoffTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
          }
        } else {
          geminiResult = await geminiResponse.json();
          console.log("Gemini API response received");
          break; // Success, exit the retry loop
        }
      } catch (error) {
        console.error(`Gemini API network error (attempt ${retryCount + 1}):`, error);
        geminiError = error.message;
        retryCount++;
        
        if (retryCount < maxRetries) {
          const backoffTime = Math.pow(2, retryCount) * 1000;
          console.log(`Retrying Gemini API call in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    // If we still don't have a result after all retries, throw an error
    if (!geminiResult) {
      throw new Error(`Gemini API call failed after ${maxRetries} attempts. Last error: ${geminiError}`);
    }
    
    const topObservation = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || 
                        "No observation selected by Gemini API";
    
    // Implement retry logic for the database update as well
    let updateData = null;
    let updateError = null;
    retryCount = 0;
    
    while (retryCount < maxRetries) {
      const { data, error } = await supabase
        .from('tweetgenerationflow')
        .update({ geminiobservation: topObservation })
        .eq('id', recordId)
        .select();
        
      if (error) {
        console.error(`Error updating tweetgenerationflow with Gemini observation (attempt ${retryCount + 1}):`, error);
        updateError = error;
        retryCount++;
        
        if (retryCount < maxRetries) {
          const backoffTime = Math.pow(2, retryCount) * 1000;
          console.log(`Retrying database update in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      } else {
        updateData = data;
        break; // Success, exit the retry loop
      }
    }
    
    // If we still couldn't update after all retries, log the error but continue
    if (updateError) {
      console.error(`Failed to save Gemini observation to database after ${maxRetries} attempts:`, updateError);
    } else {
      console.log("Gemini observation saved to tweetgenerationflow table");
    }
    
    console.log("Automatically triggering pretweetcontext function...");
    try {
      // Use a more resilient approach to call the pretweetcontext function
      const pretweetResponse = await fetch(`${supabaseUrl}/functions/v1/pretweetcontext`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ recordId: recordId })
      }).catch(error => {
        console.error("Network error calling pretweetcontext:", error);
        return { ok: false, statusText: error.message };
      });
      
      if (!pretweetResponse.ok) {
        let errorText = "Unknown error";
        try {
          errorText = await pretweetResponse.text();
        } catch (e) {
          errorText = pretweetResponse.statusText || "Failed to get error details";
        }
        console.error("Error automatically triggering pretweetcontext:", errorText);
      } else {
        console.log("Pretweetcontext function automatically triggered successfully");
      }
    } catch (autoTriggerError) {
      console.error("Failed to automatically trigger pretweetcontext:", autoTriggerError);
    }
    
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


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
  
  console.log("[INIT] Starting deep initial analysis with configuration:", {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey
  });
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("[FETCH] Retrieving medium-term context entries...");
    // Fetch the 3 most recent medium-term context entries
    const { data: mediumTermData, error: mediumTermError } = await supabase
      .from('memory_context')
      .select('mediumterm_context, created_at')
      .not('mediumterm_context', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3);
      
    if (mediumTermError) {
      console.error("[ERROR] Failed to fetch medium-term context:", {
        error: mediumTermError,
        errorMessage: mediumTermError.message,
        details: mediumTermError.details,
        hint: mediumTermError.hint
      });
      throw new Error("Failed to fetch medium-term context");
    }
    
    console.log(`[FETCH] Retrieved ${mediumTermData?.length || 0} medium-term context entries`);
    
    console.log("[FETCH] Retrieving short-term context1 entries...");
    // Fetch the 6 most recent short-term context1 entries
    const { data: shortTerm1Data, error: shortTerm1Error } = await supabase
      .from('memory_context')
      .select('shortterm_context1, created_at')
      .not('shortterm_context1', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6);
      
    if (shortTerm1Error) {
      console.error("[ERROR] Failed to fetch short-term context1:", {
        error: shortTerm1Error,
        errorMessage: shortTerm1Error.message,
        details: shortTerm1Error.details,
        hint: shortTerm1Error.hint
      });
      throw new Error("Failed to fetch short-term context1");
    }
    
    console.log(`[FETCH] Retrieved ${shortTerm1Data?.length || 0} short-term context1 entries`);
    
    console.log("[FETCH] Retrieving short-term context2 entries...");
    // Fetch the 6 most recent short-term context2 entries
    const { data: shortTerm2Data, error: shortTerm2Error } = await supabase
      .from('memory_context')
      .select('shortterm_context2, created_at')
      .not('shortterm_context2', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6);
      
    if (shortTerm2Error) {
      console.error("[ERROR] Failed to fetch short-term context2:", {
        error: shortTerm2Error,
        errorMessage: shortTerm2Error.message,
        details: shortTerm2Error.details,
        hint: shortTerm2Error.hint
      });
      throw new Error("Failed to fetch short-term context2");
    }
    
    console.log(`[FETCH] Retrieved ${shortTerm2Data?.length || 0} short-term context2 entries`);
    
    // Format the medium-term trends
    let mediumTermTrends = "- Medium-term trends:\n";
    if (mediumTermData && mediumTermData.length > 0) {
      console.log("[FORMAT] Formatting medium-term trends with", mediumTermData.length, "entries");
      mediumTermData.forEach((entry, index) => {
        if (entry.mediumterm_context) {
          mediumTermTrends += `  - Entry ${index + 1} (${new Date(entry.created_at).toISOString().split('T')[0]}):\n    ${entry.mediumterm_context.replace(/\n/g, '\n    ')}\n\n`;
        }
      });
    } else {
      console.log("[FORMAT] No medium-term trends data available");
      mediumTermTrends += "  [No medium-term context available]\n\n";
    }
    
    // Format the short-term context1
    let shortTerm1Context = "- Short-term context (tweet analysis):\n";
    if (shortTerm1Data && shortTerm1Data.length > 0) {
      console.log("[FORMAT] Formatting short-term context1 with", shortTerm1Data.length, "entries");
      shortTerm1Data.forEach((entry, index) => {
        if (entry.shortterm_context1) {
          shortTerm1Context += `  - Entry ${index + 1} (${new Date(entry.created_at).toISOString().split('T')[0]}):\n    ${entry.shortterm_context1.replace(/\n/g, '\n    ')}\n\n`;
        }
      });
    } else {
      console.log("[FORMAT] No short-term context1 data available");
      shortTerm1Context += "  [No short-term context1 available]\n\n";
    }
    
    // Format the short-term context2
    let shortTerm2Highlights = "- Short-term news highlights:\n";
    if (shortTerm2Data && shortTerm2Data.length > 0) {
      console.log("[FORMAT] Formatting short-term context2 with", shortTerm2Data.length, "entries");
      shortTerm2Data.forEach((entry, index) => {
        if (entry.shortterm_context2) {
          shortTerm2Highlights += `  - Entry ${index + 1} (${new Date(entry.created_at).toISOString().split('T')[0]}):\n    ${entry.shortterm_context2.replace(/\n/g, '\n    ')}\n\n`;
        }
      });
    } else {
      console.log("[FORMAT] No short-term context2 data available");
      shortTerm2Highlights += "  [No short-term context2 available]\n\n";
    }
    
    // Prepare the full context section
    const contextSection = `**CONTEXT SECTION:**\n\n- Recent tweets history: [Empty]\n\n${mediumTermTrends}${shortTerm1Context}${shortTerm2Highlights}`;
    
    console.log("[CONTEXT] Full context section prepared, length:", contextSection.length, "characters");
    console.log("[CONTEXT] First 200 characters of context:", contextSection.substring(0, 200));
    
    // Call DeepSeek API
    const deepseekAPIEndpoint = "https://api.deepseek.com/v1/chat/completions";
    const deepseekAPIKey = Deno.env.get("DEEPSEEK_API_KEY");
    
    if (!deepseekAPIKey) {
      console.error("[ERROR] Missing DEEPSEEK_API_KEY environment variable");
      throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    }
    
    const systemPrompt = `You are tasked with starting the process of tweet idea generation for a Twitter posting account focused on AI related news and updates. Your task is to step-by-step and in detail, hyper analyze the provided CONTEXT SECTION and identify what's currently noteworthy to guide subsequent tweet idea development. Pause and think during your analysis for even deeper insights and advanced reasoning. Focus on:

- Emerging & Trending AI Topics: Identify any frequently repeating keywords, hashtags, or themes currently sparking significant discussion in the AI community.
- Core Sentiments & Opinions: Spot the prevailing sentiments: excitement, skepticism, worry, or controversy—around recent AI developments, noting any heated debates or strong viewpoints.
- Cross-Topic Connections: Look for intersections between the many different provided context sources (recent tweets, keywords, news updates, current sentiment/themes, etc). These crossovers can yield unique angles for discussion.
- Fresh, Underexplored Themes: Pinpoint noteworthy topics or angles that the history of recent tweets haven't covered yet. Focus on emerging ideas to keep content original and timely.
- Real-World Implications: Evaluate how the latest AI news or trends might influence industries, research, policy, or everyday life—think about tangible common impacts and consequences.
- Comparisons With Past Milestones: Draw parallels (or highlight contrasts) between current AI developments and historical trends or breakthroughs to showcase progress, recurring issues, or unexpected twists.
- Engagement-Driven Angles: Prioritize topics that naturally invite discussion or user interaction (e.g., polls, debates, open-ended questions), thus boosting engagement and visibility.
- Ethical & Philosophical Dimensions: Examine moral, legal, or societal considerations—such as AI fairness, regulatory efforts, or existential questions—encouraging deeper reflection.
- Future Outlook & Predictions: Speculate on near-future and long-term developments in AI, projecting how ongoing trends could evolve and spark new areas of conversation.
- Topics Ripe for In-Depth Exploration: Highlight complex or data-rich topics that could benefit from further research or expert input.
- Educational & Explanatory Topics: Identify AI concepts that are either complex or commonly misunderstood, offering opportunities for clarity, tutorials, or guided breakdowns.
- Wildcard Angles: Surface surprising or unconventional topics that could captivate followers.

**Instructions:**

- Deeply analyze all data in the Context Section, incorporating the "Focus on" guidelines.
- Identify 5–8 Observations that are most relevant, interesting, or timely.
- Do NOT generate any tweet text. ONLY outline key elements or angles.
- Remain concise, limit each observation to 70-100 words.

**Output Format:**

- **Observation 1**:  
  - **Summary**: [Explain what's noteworthy]  
  - **Why It's Relevant**: [Short explanation]  
- **Observation 2**:  
  - **Summary**: [Explain what's noteworthy]  
  - **Why It's Relevant**: [Short explanation]  
- **Observation 3**:  
  - **Summary**: [Explain what's noteworthy]  
  - **Why It's Relevant**: [Short explanation]  
[...]`;
    
    const payload = {
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: contextSection
        }
      ],
      model: "deepseek-reasoner",
      temperature: 0.7,
      max_tokens: 4000
    };
    
    console.log("[API] Calling DeepSeek API with payload length:", JSON.stringify(payload).length);
    console.log("[API] Using model:", payload.model);
    
    const response = await fetch(deepseekAPIEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepseekAPIKey}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ERROR] DeepSeek API error:", {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`DeepSeek API returned ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log("[API] DeepSeek API response received:", {
      hasChoices: !!result.choices,
      choicesLength: result.choices?.length,
      firstChoiceLength: result.choices?.[0]?.message?.content?.length
    });
    
    // Extract the analysis from the response
    const analysis = result.choices?.[0]?.message?.content || 
                    "No analysis generated from DeepSeek API";
    
    console.log("[DB] Storing analysis in tweetgenerationflow table...");
    // Store the analysis in the new tweetgenerationflow table
    const { data: insertData, error: insertError } = await supabase
      .from('tweetgenerationflow')
      .insert([{ deepinitial: analysis }])
      .select();
      
    if (insertError) {
      console.error("[ERROR] Failed to insert analysis into tweetgenerationflow:", {
        error: insertError,
        errorMessage: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      throw new Error("Failed to save analysis to database");
    }
    
    console.log("[DB] Analysis saved successfully, record:", insertData);
    
    // Get the record ID for the newly created entry
    const recordId = insertData?.[0]?.id;
    
    if (recordId) {
      console.log("[TRIGGER] Triggering geminiinitial2 function with record ID:", recordId);
      
      try {
        const geminiResponse = await fetch(`${supabaseUrl}/functions/v1/geminiinitial2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseAnonKey}`
          },
          body: JSON.stringify({ recordId: recordId })
        });
        
        if (!geminiResponse.ok) {
          const geminiErrorText = await geminiResponse.text();
          console.error("[ERROR] Failed to call geminiinitial2:", {
            status: geminiResponse.status,
            statusText: geminiResponse.statusText,
            errorBody: geminiErrorText,
            headers: Object.fromEntries(geminiResponse.headers.entries())
          });
          console.warn("[WARN] Continuing despite geminiinitial2 error");
        } else {
          const geminiResult = await geminiResponse.json();
          console.log("[TRIGGER] geminiinitial2 function completed successfully:", geminiResult);
        }
      } catch (geminiError) {
        console.error("[ERROR] Exception while calling geminiinitial2 function:", {
          error: geminiError,
          message: geminiError.message,
          stack: geminiError.stack
        });
        console.warn("[WARN] Continuing despite geminiinitial2 error");
      }
    }
    
    console.log("[SUCCESS] Deep initial analysis completed successfully");
    
    // Return the analysis and contextSection in the response
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: analysis,
        context: contextSection,
        recordId: recordId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("[ERROR] Deep initial analysis failed:", {
      error: error,
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    return new Response(
      JSON.stringify({ error: "Deep initial analysis failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});


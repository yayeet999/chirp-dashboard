
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
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting gem initial analysis...");
    
    // Fetch the 3 most recent medium-term context entries
    const { data: mediumTermData, error: mediumTermError } = await supabase
      .from('memory_context')
      .select('mediumterm_context, created_at')
      .not('mediumterm_context', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3);
      
    if (mediumTermError) {
      console.error("Error fetching medium-term context:", mediumTermError);
      throw new Error("Failed to fetch medium-term context");
    }
    
    // Fetch the 6 most recent short-term context1 entries
    const { data: shortTerm1Data, error: shortTerm1Error } = await supabase
      .from('memory_context')
      .select('shortterm_context1, created_at')
      .not('shortterm_context1', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6);
      
    if (shortTerm1Error) {
      console.error("Error fetching short-term context1:", shortTerm1Error);
      throw new Error("Failed to fetch short-term context1");
    }
    
    // Fetch the 6 most recent short-term context2 entries
    const { data: shortTerm2Data, error: shortTerm2Error } = await supabase
      .from('memory_context')
      .select('shortterm_context2, created_at')
      .not('shortterm_context2', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6);
      
    if (shortTerm2Error) {
      console.error("Error fetching short-term context2:", shortTerm2Error);
      throw new Error("Failed to fetch short-term context2");
    }
    
    // Format the medium-term trends
    let mediumTermTrends = "- Medium-term trends:\n";
    if (mediumTermData && mediumTermData.length > 0) {
      mediumTermData.forEach((entry, index) => {
        if (entry.mediumterm_context) {
          mediumTermTrends += `  - Entry ${index + 1} (${new Date(entry.created_at).toISOString().split('T')[0]}):\n    ${entry.mediumterm_context.replace(/\n/g, '\n    ')}\n\n`;
        }
      });
    } else {
      mediumTermTrends += "  [No medium-term context available]\n\n";
    }
    
    // Format the short-term context1
    let shortTerm1Context = "- Short-term context (tweet analysis):\n";
    if (shortTerm1Data && shortTerm1Data.length > 0) {
      shortTerm1Data.forEach((entry, index) => {
        if (entry.shortterm_context1) {
          shortTerm1Context += `  - Entry ${index + 1} (${new Date(entry.created_at).toISOString().split('T')[0]}):\n    ${entry.shortterm_context1.replace(/\n/g, '\n    ')}\n\n`;
        }
      });
    } else {
      shortTerm1Context += "  [No short-term context1 available]\n\n";
    }
    
    // Format the short-term context2
    let shortTerm2Highlights = "- Short-term news highlights:\n";
    if (shortTerm2Data && shortTerm2Data.length > 0) {
      shortTerm2Data.forEach((entry, index) => {
        if (entry.shortterm_context2) {
          shortTerm2Highlights += `  - Entry ${index + 1} (${new Date(entry.created_at).toISOString().split('T')[0]}):\n    ${entry.shortterm_context2.replace(/\n/g, '\n    ')}\n\n`;
        }
      });
    } else {
      shortTerm2Highlights += "  [No short-term context2 available]\n\n";
    }
    
    // Prepare the full context section
    const contextSection = `**CONTEXT SECTION:**\n\n- Recent tweets history: [Empty]\n\n${mediumTermTrends}${shortTerm1Context}${shortTerm2Highlights}`;
    
    console.log("Context section prepared:", contextSection);
    
    // Call Gemini API (replacing DeepSeek API)
    const geminiAPIEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";
    const geminiAPIKey = Deno.env.get("GEMINI_API_KEY");
    
    if (!geminiAPIKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable");
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

    console.log("Calling Gemini API...");
    
    // Log payload length for debugging
    const payloadLength = contextSection.length;
    console.log("[API] Calling Gemini API with payload length:", payloadLength);
    
    // Prepare Gemini API payload
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { text: contextSection }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 6000
      }
    };
    
    // Make the Gemini API request
    const response = await fetch(`${geminiAPIEndpoint}?key=${geminiAPIKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log("Gemini API response:", JSON.stringify(result, null, 2));
    
    // Extract the analysis from the response
    const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text || 
                    "No analysis generated from Gemini API";
    
    // Store the analysis in the new tweetgenerationflow table
    const { data: insertData, error: insertError } = await supabase
      .from('tweetgenerationflow')
      .insert([{ deepinitial: analysis }])
      .select();
      
    if (insertError) {
      console.error("Error inserting analysis into tweetgenerationflow:", insertError);
      throw new Error("Failed to save analysis to database");
    }
    
    console.log("Analysis saved to tweetgenerationflow table:", insertData);
    
    // Get the record ID for the newly created entry
    const recordId = insertData?.[0]?.id;
    
    // Add a delay before triggering geminiinitial2 to ensure the database commit is complete
    // This helps prevent the race condition
    if (recordId) {
      console.log(`Waiting 3 seconds before triggering geminiinitial2 function with record ID: ${recordId}`);
      
      // We're going to use a background task with EdgeRuntime.waitUntil 
      // so we can return a response immediately while processing continues
      const backgroundTask = async () => {
        try {
          // Wait 3 seconds to ensure the database has committed the record
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          console.log(`Now triggering geminiinitial2 function with record ID: ${recordId}`);
          
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
            console.error(`Error calling geminiinitial2 (status ${geminiResponse.status}):`, geminiErrorText);
            
            // If we get a 503 error, let's retry after a delay
            if (geminiResponse.status === 503) {
              console.log("Received 503 error, retrying geminiinitial2 after 5 seconds...");
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // Retry the request
              const retryResponse = await fetch(`${supabaseUrl}/functions/v1/geminiinitial2`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseAnonKey}`
                },
                body: JSON.stringify({ recordId: recordId })
              });
              
              if (!retryResponse.ok) {
                console.error("Retry also failed, giving up:", await retryResponse.text());
              } else {
                console.log("Retry of geminiinitial2 succeeded!");
              }
            }
          } else {
            const geminiResult = await geminiResponse.json();
            console.log("geminiinitial2 function completed successfully:", geminiResult);
          }
        } catch (geminiError) {
          console.error("Failed to call geminiinitial2 function:", geminiError);
        }
      };
      
      // Use waitUntil to run the background task without blocking response
      // @ts-ignore - EdgeRuntime is available in Deno Deploy but not in type definitions
      EdgeRuntime.waitUntil(backgroundTask());
    }
    
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
    console.error("Gem initial analysis failed:", error);
    return new Response(
      JSON.stringify({ error: "Gem initial analysis failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

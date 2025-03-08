
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
    console.log("Starting deep initial analysis...");
    
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
    
    // Call DeepSeek API
    const deepseekAPIEndpoint = "https://api.deepseek.com/v1/completions";
    const deepseekAPIKey = Deno.env.get("DEEPSEEK_API_KEY");
    
    if (!deepseekAPIKey) {
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
      max_tokens: 2500
    };
    
    console.log("Calling DeepSeek API...");
    
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
      console.error("DeepSeek API error:", errorText);
      throw new Error(`DeepSeek API returned ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log("DeepSeek API response:", JSON.stringify(result, null, 2));
    
    // Extract the analysis from the response
    const analysis = result.choices?.[0]?.message?.content || 
                    "No analysis generated from DeepSeek API";
    
    // Store the analysis in a new table or return it
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: analysis,
        context: contextSection
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Deep initial analysis failed:", error);
    return new Response(
      JSON.stringify({ error: "Deep initial analysis failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

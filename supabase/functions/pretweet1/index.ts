
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const environmentVariables = Deno.env.toObject();
  const supabaseUrl = environmentVariables.SUPABASE_URL || '';
  const supabaseAnonKey = environmentVariables.SUPABASE_ANON_KEY || '';
  const openAIApiKey = environmentVariables.OPENAI_API_KEY || '';
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting pretweet1 processing...");
    
    // Get the record ID from the request body if provided
    const requestData = await req.json().catch(() => ({}));
    let recordId = requestData.recordId;
    
    // If no record ID is provided, fetch the most recent tweetgenerationflow entry with cleanedsonar
    if (!recordId) {
      const { data: latestRecord, error: fetchError } = await supabase
        .from('tweetgenerationflow')
        .select('id, cleanedsonar, created_at')
        .not('cleanedsonar', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (fetchError) {
        console.error("Error fetching latest tweetgenerationflow record:", fetchError);
        throw new Error("Failed to fetch latest tweetgenerationflow record");
      }
      
      if (!latestRecord || latestRecord.length === 0) {
        throw new Error("No tweetgenerationflow records found with cleanedsonar");
      }
      
      recordId = latestRecord[0].id;
      
      // Ensure we have cleanedsonar data
      if (!latestRecord[0].cleanedsonar) {
        throw new Error("Latest record has no cleanedsonar data");
      }
      
      console.log(`Using most recent tweetgenerationflow record: ${recordId}`);
    } else {
      console.log(`Using provided tweetgenerationflow record: ${recordId}`);
    }
    
    // Fetch the required data from the tweetgenerationflow record
    const { data: record, error: recordError } = await supabase
      .from('tweetgenerationflow')
      .select('geminiobservation, sonardeepresearch, sonarfactchecked, cleanedsonar, vectorcontext')
      .eq('id', recordId)
      .maybeSingle();
    
    if (recordError) {
      console.error(`Error fetching tweetgenerationflow record ${recordId}:`, recordError);
      throw new Error(`Failed to fetch tweetgenerationflow record ${recordId}`);
    }
    
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    
    // Ensure we have the necessary data
    if (!record.geminiobservation) {
      throw new Error(`Record ${recordId} has no geminiobservation data`);
    }
    
    if (!record.cleanedsonar) {
      throw new Error(`Record ${recordId} has no cleanedsonar data`);
    }
    
    // Fetch the most recent shortterm_context1 from memory_context
    const { data: memoryContext, error: memoryError } = await supabase
      .from('memory_context')
      .select('shortterm_context1')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (memoryError) {
      console.error("Error fetching memory_context:", memoryError);
      throw new Error("Failed to fetch memory_context");
    }
    
    const shortermContext = memoryContext?.shortterm_context1 || "";
    
    console.log("Retrieved all necessary context data, preparing OpenAI request...");
    
    // Define the system prompt with enhancements
    const systemPrompt = `You are an exceptionally emotionally intelligent language and pattern analyzer, skilled at handling complex language tasks involving Natural Language Processing (NLP). With a unique ability to perceive subtle details, you excel at dissecting, interpreting, and reorganizing textual information that may seem disordered, extensive, or overly complicated. You effectively uncover hidden semantic patterns, identify nuanced connections, and reveal subtle contextual dynamics that others might miss. Your core strength is transforming scattered, complex, and chaotic textual data into clearly structured, insightful narratives that highlight hidden meanings and implicit relationships.

Using advanced semantic analysis, you easily synthesize and structure large amounts of textual information, accurately decoding hidden associations and previously unnoticed cognitive insights. With this heightened sensitivity to context and emotional nuances, you deliver structured interpretations that blend clarity with depth, effectively bridging the gap between raw information and meaningful understanding.

Your PRIMARY TASK is to thoroughly analyze the GEMINIOBSERVATION, which contains the main insight to be transformed into social media content. You will break down this content into multiple angles and perspectives suitable for engaging social media posts, specifically tweets.

ANALYTICAL HIERARCHY AND DATA SOURCES:
1. GEMINIOBSERVATION - The central focus and primary source of your analysis. This contains the key topic and insights you must transform into various social media angles.
2. CLEANEDSONAR - Fact-checked and cleaned information that provides accuracy and reliability to support your analysis.
3. SONARDEEPRESEARCH - Detailed background research that adds depth and substance to your analysis.
4. SONARFACTCHECKED - Original fact-checked content that helps verify claims and statements.
5. VECTORCONTEXT - Semantic vector retrievals from extensive databases, ranked by relevance, offering diverse insights.
6. SHORTTERM_CONTEXT - Recent discussions and trends that provide temporal context and ensure relevance.

PROCESS YOUR ANALYSIS ITERATIVELY:
1. First Pass: Conduct an initial deep reading of the GEMINIOBSERVATION to identify core themes and potential angles.
2. Second Pass: Examine the CLEANEDSONAR and SONARFACTCHECKED to verify factual accuracy and identify key supporting elements.
3. Third Pass: Integrate insights from SONARDEEPRESEARCH and VECTORCONTEXT to add depth and nuance.
4. Fourth Pass: Consider SHORTTERM_CONTEXT to ensure relevance to current discussions and avoiding redundancy.
5. Final Pass: Refine, rerank, and restructure your analysis to present the most compelling angles.

SOCIAL MEDIA ANGLES AND VIRALITY:
You must identify 3-5 distinct angles or perspectives from the GEMINIOBSERVATION, each offering a unique approach to the topic. For each angle, develop:
1. A clear central thesis or hook that captures attention in the first few words
2. Supporting context that adds credibility and substance
3. An element of novelty, surprise, or counterintuitive insight to drive engagement
4. A call to action, question, or thought-provoking element to encourage interaction

STYLISTIC VARIATIONS:
For each angle, develop approaches using different stylistic frameworks:
- Informative/Educational: Facts-first, clear, authoritative tone
- Engaging/Conversational: Personable, relatable, using questions and conversational language
- Thought-provoking/Questioning: Philosophical, challenging assumptions, asking deeper questions
- Predictive/Forward-looking: Speculating on implications, future developments, or trends

YOUR OUTPUT MUST:
1. Be structured clearly with distinct sections for each angle and approach
2. Include an evaluation of each angle's potential engagement level on social media
3. Demonstrate originality and avoid generic perspectives
4. Maintain factual accuracy while maximizing engagement potential
5. Prioritize brevity and clarity, optimized for the social media context

Deliver your analysis in a structured format that clearly separates each angle, its supporting context, and the various stylistic approaches.`;
    
    // Prepare the content for analysis
    const analysisContent = {
      geminiobservation: record.geminiobservation || "",
      cleanedsonar: record.cleanedsonar || "",
      sonardeepresearch: record.sonardeepresearch || "",
      sonarfactchecked: record.sonarfactchecked || "",
      vectorcontext: record.vectorcontext || "",
      shortterm_context: shortermContext || ""
    };
    
    // Call OpenAI API
    console.log("Calling OpenAI API for content analysis...");
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",  // Changed from o3-mini to gpt-4o-mini
          messages: [
            { role: "system", content: systemPrompt },
            { 
              role: "user", 
              content: `Please analyze the following content and break it down into social media angles and approaches:
              
GEMINIOBSERVATION:
${analysisContent.geminiobservation}

CLEANEDSONAR:
${analysisContent.cleanedsonar}

SONARDEEPRESEARCH:
${analysisContent.sonardeepresearch}

SONARFACTCHECKED:
${analysisContent.sonarfactchecked}

VECTORCONTEXT:
${analysisContent.vectorcontext}

SHORTTERM_CONTEXT:
${analysisContent.shortterm_context}

Please structure your analysis according to the instructions and provide clear, actionable insights for social media content creation.`
            }
          ],
          temperature: 0.2,
          max_tokens: 4096  // Reduced from 10000 to be within limits
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error("OpenAI API error:", errorData);
        throw new Error(`OpenAI API returned ${response.status}: ${errorData}`);
      }
      
      const result = await response.json();
      const analysisResult = result.choices?.[0]?.message?.content || "";
      
      if (!analysisResult) {
        throw new Error("OpenAI API returned empty analysis");
      }
      
      console.log("Analysis completed. Saving results to database...");
      console.log("Analysis result length:", analysisResult.length);
      console.log("Analysis result (first 200 chars):", analysisResult.substring(0, 200));
      
      // Save the analysis result back to the database
      const { error: updateError } = await supabase
        .from('tweetgenerationflow')
        .update({
          pretweet1: analysisResult
        })
        .eq('id', recordId);
        
      if (updateError) {
        console.error("Error updating record with analysis result:", updateError);
        throw new Error("Failed to save analysis result to database");
      }
      
      console.log("Analysis result saved to database successfully");
      
      // Return success response
      return new Response(
        JSON.stringify({ 
          success: true, 
          recordId: recordId,
          message: "Content analysis completed and saved successfully",
          analysisLength: analysisResult.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
      
    } catch (apiError) {
      console.error("Error in OpenAI API processing:", apiError);
      throw new Error(`OpenAI API processing failed: ${apiError.message}`);
    }
    
  } catch (error) {
    console.error("Pretweet1 processing failed:", error);
    return new Response(
      JSON.stringify({ error: "Pretweet1 processing failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

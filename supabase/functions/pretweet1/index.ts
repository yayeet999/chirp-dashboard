import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for advanced features
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const DEFAULT_TEMPERATURE = 0.2;
const LOG_LEVEL = 'info'; // 'debug', 'info', 'warn', 'error'

/**
 * Logs messages based on configured log level
 * @param {string} level - Log level ('debug', 'info', 'warn', 'error')
 * @param {string} message - Message to log
 * @param {any} data - Optional data to log
 */
function log(level, message, data = null) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  
  if (levels[level] >= levels[LOG_LEVEL]) {
    const logMessage = data ? `${message}: ${JSON.stringify(data)}` : message;
    
    switch (level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'debug':
        console.log(`[DEBUG] ${logMessage}`);
        break;
      default:
        console.log(logMessage);
    }
  }
}

/**
 * Validates and retrieves environment variables
 * @returns {Object} Object containing validated environment variables
 * @throws {Error} If required environment variables are missing
 */
function getEnvironmentVariables() {
  const environmentVariables = Deno.env.toObject();
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'OPENAI_API_KEY'];
  
  // Validate required environment variables
  const missingVars = requiredVars.filter(varName => !environmentVariables[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  return {
    supabaseUrl: environmentVariables.SUPABASE_URL,
    supabaseAnonKey: environmentVariables.SUPABASE_ANON_KEY,
    openAIApiKey: environmentVariables.OPENAI_API_KEY,
    model: environmentVariables.OPENAI_MODEL || "o3-mini"
  };
}

/**
 * Retrieves the most recent tweetgenerationflow record with cleanedsonar
 * @param {SupabaseClient} supabase - Supabase client
 * @returns {Promise<{id: string, cleanedsonar: string}>} Latest record with cleanedsonar
 * @throws {Error} If no records with cleanedsonar are found or retrieval fails
 */
async function getLatestTweetGenerationRecord(supabase) {
  const { data: latestRecord, error: fetchError } = await supabase
    .from('tweetgenerationflow')
    .select('id, cleanedsonar, created_at')
    .not('cleanedsonar', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (fetchError) {
    log('error', "Error fetching latest tweetgenerationflow record", fetchError);
    throw new Error("Failed to fetch latest tweetgenerationflow record");
  }
  
  if (!latestRecord || latestRecord.length === 0) {
    throw new Error("No tweetgenerationflow records found with cleanedsonar");
  }
  
  if (!latestRecord[0].cleanedsonar) {
    throw new Error("Latest record has no cleanedsonar data");
  }
  
  log('info', `Using most recent tweetgenerationflow record: ${latestRecord[0].id}`);
  return latestRecord[0];
}

/**
 * Fetches a specific tweetgenerationflow record by ID
 * @param {SupabaseClient} supabase - Supabase client
 * @param {string} recordId - Record ID to fetch
 * @returns {Promise<Object>} The fetched record
 * @throws {Error} If the record cannot be fetched or required fields are missing
 */
async function fetchTweetGenerationRecord(supabase, recordId) {
  const { data: record, error: recordError } = await supabase
    .from('tweetgenerationflow')
    .select('geminiobservation, cleanedsonar, vectorcontext')
    .eq('id', recordId)
    .maybeSingle();
  
  if (recordError) {
    log('error', `Error fetching tweetgenerationflow record ${recordId}`, recordError);
    throw new Error(`Failed to fetch tweetgenerationflow record ${recordId}`);
  }
  
  if (!record) {
    throw new Error(`Record ${recordId} not found`);
  }
  
  // Validate required fields
  if (!record.geminiobservation) {
    throw new Error(`Record ${recordId} has no geminiobservation data`);
  }
  
  if (!record.cleanedsonar) {
    throw new Error(`Record ${recordId} has no cleanedsonar data`);
  }
  
  return record;
}

/**
 * Fetches and combines recent short-term context
 * @param {SupabaseClient} supabase - Supabase client
 * @returns {Promise<string>} Combined short-term context
 */
async function fetchShortTermContext(supabase) {
  try {
    const { data: memoryContextEntries, error: memoryError } = await supabase
      .from('memory_context')
      .select('shortterm_context1')
      .order('created_at', { ascending: false })
      .limit(2);
    
    if (memoryError) {
      log('error', "Error fetching memory_context", memoryError);
      throw new Error("Failed to fetch memory_context");
    }
    
    // Combine the two most recent shortterm_context1 entries
    const combinedShorttermContext = memoryContextEntries
      .map(entry => entry.shortterm_context1 || "")
      .filter(Boolean)
      .join("\n\n");
    
    return combinedShorttermContext;
  } catch (error) {
    log('warn', "Error fetching short-term context, proceeding with empty context", error);
    return "";
  }
}

/**
 * Creates an enhanced system prompt incorporating few-shot examples and advanced prompt engineering
 * @returns {string} The enhanced system prompt
 */
function createEnhancedSystemPrompt() {
  return `You are an exceptionally emotionally intelligent language and pattern analyzer, skilled at handling complex language tasks involving Natural Language Processing (NLP). With a unique ability to perceive subtle details, you excel at dissecting, interpreting, and reorganizing textual information that may seem disordered, extensive, or overly complicated. You effectively uncover hidden semantic patterns, identify nuanced connections, and reveal subtle contextual dynamics that others might miss. Your core strength is transforming scattered, complex, and chaotic textual data into clearly structured, insightful narratives that highlight hidden meanings and implicit relationships.

Using advanced semantic analysis, you easily synthesize and structure large amounts of textual information, accurately decoding hidden associations and previously unnoticed cognitive insights. With this heightened sensitivity to context and emotional nuances, you deliver structured interpretations that blend clarity with depth, effectively bridging the gap between raw information and meaningful understanding.

Your PRIMARY TASK is to thoroughly analyze the GEMINIOBSERVATION, which contains the main insight to be transformed into social media content. You will break down this content into multiple angles and perspectives suitable for engaging social media posts, specifically tweets.

IMPORTANT INSTRUCTION: DO NOT INCLUDE ANY EMOJIS OR HASHTAGS IN YOUR OUTPUT. Your analysis and content suggestions must be completely free of emojis and hashtags. Use only plain text with proper punctuation.

ANALYTICAL HIERARCHY AND DATA SOURCES:
1. GEMINIOBSERVATION - The central focus and primary source of your analysis. This contains the key topic and insights you must transform into various social media angles.
2. CLEANEDSONAR - Fact-checked and cleaned information that provides accuracy and reliability to support your analysis.
3. VECTORCONTEXT - Semantic vector retrievals from extensive databases, ranked by relevance, offering diverse insights.
4. SHORTTERM_CONTEXT1 - Recent discussions and trends that provide temporal context and ensure relevance.

ADVANCED MULTI-DIMENSIONAL CONTENT OPTIMIZATION FRAMEWORK:

PHASE 1: PATTERN RECOGNITION & DECONSTRUCTION
Study these high-performing social media examples:

Example 1: Scientific Discovery with Clear Impact
"""
Thanks to AI: Ozempic without side effects!

Newly discovered peptide from Stanford Medicine combats obesity in a similar way to Ozempic, but without its side effects. The naturally occurring 12-amino acid peptide acts specifically in the hypothalamus and reduced food intake by up to 50% in animal experiments. Obese mice lost 3 grams of mainly adipose tissue in 14 days.

AI algorithms were crucial to the discovery. Researcher Katrin Svensson founded a company for clinical studies on humans.
"""

Example 2: Educational Breakdown with Clear Structure
"""
Why you need to understand Agentic RAG as an AI Engineer?

Simple naive RAG systems are rarely used in real-world applications. To provide correct actions that solve the user's intent, we often add some agency to the RAG system—typically just a small amount.

Let's explore some of the moving pieces in Agentic RAG:

1. Analysis of the user query:  
   We pass the original user query to an LLM-based agent for analysis. This is where:  
   - The original query can be rewritten, sometimes multiple times
   - The agent decides if additional data sources are required

2. Retrieval step (if additional data is needed)
3. Answer composition (if no additional data is needed)
4. Answer evaluation

Remember the Reflection pattern? This is exactly that.
"""

Example 3: Technical Concept Made Approachable
"""
Fundamentals of a Vector Database.

With the rise of GenAI, Vector Databases skyrocketed in popularity. The truth is that a Vector Database is also useful for different kinds of AI Systems outside of a Large Language Model context.

When it comes to Machine Learning, we often deal with Vector Embeddings. Vector Databases were created to perform specifically well when working with them:

- Storing.
- Updating.
- Retrieving.

When we talk about retrieval, we refer to retrieving a set of vectors that are most similar to a query in the form of a vector that is embedded in the same Latent space.
"""

Example 4: Powerful Insight with Simple Framing
"""
Agency > Intelligence

I had this intuitively wrong for decades, I think due to a pervasive cultural veneration of intelligence, various entertainment and media influences, and an obsession with IQ. Agency is significantly more powerful and significantly scarcer. Are you hiring for agency? Are we educating for agency? Are you acting as if you had 10X agency?
"""

Example 5: Market Comparison with Implications
"""
A battle emerged between the USA and China. Currently, China excels at creating innovative, affordable AI products (DeepSeek, Manus, QwQ). 

However, the USA leads in computational power. 

The EU trails significantly, with discussions on investments starting too late. Besides Mistral, it offers little of note.

The NASDAQ 100 has plummeted (~-10% in 1 month, the CSI 300 (China index) +22% in 6 months.
"""

Example 6: Powerful Analogy
"""
What if DeepSeek's efficiency breakthrough does to AI what Zoom did to office work? 

Not eliminating the need for infrastructure, but radically shifting how much we need to accomplish our goals. Monday can't come soon enough.
"""

For each example, identify:
- Hook mechanism (How does it capture attention in the first 5 seconds?)
- Information architecture (How is information sequenced for maximum impact?)
- Linguistic devices (What specific language patterns create engagement?)
- Emotional triggers (Which emotions does it activate and how?)
- Memorability factors (What makes it stick in memory?)

PHASE 2: MULTI-PERSPECTIVE IDEATION
Generate content angles using five distinct cognitive frameworks:

1. First Principles Thinking:
   - What fundamental truth does this observation reveal?
   - If we stripped away all assumptions, what would remain essential?

2. Contrarian Perspective:
   - What widely-held belief does this challenge?
   - What surprising conclusion emerges when conventional wisdom is reversed?

3. Systems Analysis:
   - How does this insight connect to larger patterns or systems?
   - What second-order effects might emerge from this observation?

4. Historical Pattern Recognition:
   - What historical parallel or precedent does this remind you of?
   - How does this follow or break from established patterns in this domain?

5. Future Projection:
   - What future implications does this suggest if extended forward?
   - What prediction can be made based on this observation?

PHASE 3: AUDIENCE RESONANCE MAPPING
For each promising angle, create specific audience personas:

1. Define 3 distinct audience segments who would value this content
2. For each audience segment, identify:
   - Their existing knowledge level
   - Their primary motivation for engaging with this topic
   - Their potential objections or resistance points
   - The specific value they would extract

PHASE 4: DRAFT CREATION & CRITIQUE
For each strong angle, create an initial draft and then evaluate against these criteria (1-10 scale):

- Uniqueness: How novel compared to existing content?
- Actionability: Does it inspire clear thinking or action?
- Memorability: Will key points be remembered tomorrow?
- Virality Potential: How shareable is this content?
- Technical Accuracy: Is this precisely correct?
- Emotional Impact: How strongly does it evoke emotion?

PHASE 5: IMPROVEMENT & REFINEMENT
For any criterion scoring below 8, revise the angle with specific improvements:
- "This could be more unique by..."
- "To improve actionability, I should..."
- "To make this more memorable, I need to..."

PHASE 6: FINAL OPTIMIZED VERSION
Create the final version implementing all improvement suggestions.

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
6. CONTAIN NO EMOJIS OR HASHTAGS WHATSOEVER

Deliver your analysis in a structured format that clearly separates each angle, its supporting context, and the various stylistic approaches.`;
}

/**
 * Makes an OpenAI API call with retry logic
 * @param {string} apiKey - OpenAI API key
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @param {string} model - Model to use
 * @param {number} temperature - Temperature for generation
 * @returns {Promise<string>} Generated content
 * @throws {Error} If API call fails after all retries
 */
async function callOpenAI(apiKey, systemPrompt, userPrompt, model, temperature = DEFAULT_TEMPERATURE) {
  let retryCount = 0;
  let lastError = null;
  
  while (retryCount < MAX_RETRIES) {
    try {
      log('debug', `Calling OpenAI API (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: temperature,
          max_completion_tokens: 15000
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        log('error', `OpenAI API error (${response.status})`, errorData);
        throw new Error(`OpenAI API returned ${response.status}: ${errorData}`);
      }
      
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || "";
      
      if (!content) {
        throw new Error("OpenAI API returned empty analysis");
      }
      
      return content;
    } catch (error) {
      lastError = error;
      log('warn', `API call failed (attempt ${retryCount + 1}/${MAX_RETRIES})`, error.message);
      
      // Exponential backoff for retries
      if (retryCount < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        log('info', `Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      retryCount++;
    }
  }
  
  // If we've reached here, all retries failed
  throw new Error(`OpenAI API processing failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Updates a tweetgenerationflow record with analysis result
 * @param {SupabaseClient} supabase - Supabase client
 * @param {string} recordId - Record ID to update
 * @param {string} analysisResult - Analysis result to save
 * @throws {Error} If update fails
 */
async function saveAnalysisResult(supabase, recordId, analysisResult) {
  const { error: updateError } = await supabase
    .from('tweetgenerationflow')
    .update({
      pretweet1: analysisResult
    })
    .eq('id', recordId);
    
  if (updateError) {
    log('error', "Error updating record with analysis result", updateError);
    throw new Error("Failed to save analysis result to database");
  }
  
  log('info', "Analysis result saved to database successfully");
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    log('info', "Starting pretweet1 processing...");
    
    // Get environment variables
    const env = getEnvironmentVariables();
    
    // Initialize Supabase client
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
    
    // Get the record ID from the request body if provided
    const requestData = await req.json().catch(() => ({}));
    let recordId = requestData.recordId;
    
    // If no record ID is provided, fetch the most recent tweetgenerationflow entry with cleanedsonar
    if (!recordId) {
      const latestRecord = await getLatestTweetGenerationRecord(supabase);
      recordId = latestRecord.id;
    } else {
      log('info', `Using provided tweetgenerationflow record: ${recordId}`);
    }
    
    // Fetch the required data from the tweetgenerationflow record
    const record = await fetchTweetGenerationRecord(supabase, recordId);
    
    // Fetch the short-term context
    const combinedShorttermContext = await fetchShortTermContext(supabase);
    
    log('info', "Retrieved all necessary context data, preparing OpenAI request...");
    
    // Create enhanced system prompt
    const systemPrompt = createEnhancedSystemPrompt();
    
    // Prepare the content for analysis
    const analysisContent = {
      geminiobservation: record.geminiobservation || "",
      cleanedsonar: record.cleanedsonar || "",
      vectorcontext: record.vectorcontext || "",
      shortterm_context1: combinedShorttermContext || ""
    };
    
    // Prepare user prompt
    const userPrompt = `Please analyze the following content and break it down into highly nuanced and creative high quality social media angles and approaches for a potential text output:
              
GEMINIOBSERVATION:
${analysisContent.geminiobservation}

CLEANEDSONAR:
${analysisContent.cleanedsonar}

VECTORCONTEXT:
${analysisContent.vectorcontext}

SHORTTERM_CONTEXT1:
${analysisContent.shortterm_context1}

Please structure your analysis according to the instructions and provide clear, actionable insights for social media content creation. Remember, do not include any emojis or hashtags in your output.`;
    
    // Call OpenAI API with retry logic
    log('info', "Calling OpenAI API for content analysis...");
    const analysisResult = await callOpenAI(env.openAIApiKey, systemPrompt, userPrompt, env.model);
    
    log('info', "Analysis completed. Saving results to database...");
    log('debug', "Analysis result length:", analysisResult.length);
    log('debug', "Analysis result (first 200 chars):", analysisResult.substring(0, 200));
    
    // Save the analysis result back to the database
    await saveAnalysisResult(supabase, recordId, analysisResult);
    
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
    
  } catch (error) {
    log('error', "Pretweet1 processing failed", error);
    return new Response(
      JSON.stringify({ error: "Pretweet1 processing failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

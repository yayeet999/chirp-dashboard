
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
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GEMINI_API_KEY'];
  
  // Validate required environment variables
  const missingVars = requiredVars.filter(varName => !environmentVariables[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  return {
    supabaseUrl: environmentVariables.SUPABASE_URL,
    supabaseAnonKey: environmentVariables.SUPABASE_ANON_KEY,
    geminiApiKey: environmentVariables.GEMINI_API_KEY
  };
}

/**
 * Retrieves the most recent tweetgenerationflow record with pretweet1
 * @param {SupabaseClient} supabase - Supabase client
 * @returns {Promise<{id: string, pretweet1: string}>} Latest record with pretweet1
 * @throws {Error} If no records with pretweet1 are found or retrieval fails
 */
async function getLatestTweetGenerationRecord(supabase) {
  const { data: latestRecord, error: fetchError } = await supabase
    .from('tweetgenerationflow')
    .select('id, pretweet1, created_at')
    .not('pretweet1', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (fetchError) {
    log('error', "Error fetching latest tweetgenerationflow record", fetchError);
    throw new Error("Failed to fetch latest tweetgenerationflow record");
  }
  
  if (!latestRecord || latestRecord.length === 0) {
    throw new Error("No tweetgenerationflow records found with pretweet1");
  }
  
  if (!latestRecord[0].pretweet1) {
    throw new Error("Latest record has no pretweet1 data");
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
  let record = null;
  let recordError = null;
  let retryCount = 0;
  
  while (retryCount < MAX_RETRIES) {
    const { data, error } = await supabase
      .from('tweetgenerationflow')
      .select('pretweet1, geminiobservation')
      .eq('id', recordId)
      .maybeSingle();
    
    if (error) {
      log('error', `Error fetching tweetgenerationflow record ${recordId} (attempt ${retryCount + 1})`, error);
      recordError = error;
      retryCount++;
      
      if (retryCount < MAX_RETRIES) {
        const backoffTime = Math.pow(2, retryCount) * RETRY_DELAY_MS;
        log('info', `Retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    } else if (!data || !data.pretweet1) {
      log('warn', `Record ${recordId} not found or has no pretweet1 data (attempt ${retryCount + 1})`);
      retryCount++;
      
      if (retryCount < MAX_RETRIES) {
        const backoffTime = Math.pow(2, retryCount) * RETRY_DELAY_MS;
        log('info', `Record might still be committing to database. Retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    } else {
      record = data;
      break; // Success, exit the retry loop
    }
  }
  
  // If we still don't have the record after all retries, throw an error
  if (!record || !record.pretweet1) {
    throw new Error(`Record ${recordId} not found or has no pretweet1 data after ${MAX_RETRIES} attempts`);
  }
  
  // Ensure required fields are present
  if (!record.geminiobservation) {
    log('warn', `Record ${recordId} has no geminiobservation data, but will continue with pretweet1 data only`);
  }
  
  return record;
}

/**
 * Makes a Gemini API call with retry logic
 * @param {string} apiKey - Gemini API key
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @returns {Promise<string>} Generated content
 * @throws {Error} If API call fails after all retries
 */
async function callGemini(apiKey, systemPrompt, userPrompt) {
  const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";
  const url = `${geminiEndpoint}?key=${apiKey}`;
  
  const geminiPayload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: systemPrompt + "\n\n" + userPrompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    }
  };
  
  let retryCount = 0;
  let lastError = null;
  
  while (retryCount < MAX_RETRIES) {
    try {
      log('debug', `Calling Gemini API (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      
      const geminiResponse = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(geminiPayload)
      });
      
      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        log('error', `Gemini API error (${geminiResponse.status}, attempt ${retryCount + 1})`, errorText);
        throw new Error(`Gemini API returned ${geminiResponse.status}: ${errorText}`);
      }
      
      const result = await geminiResponse.json();
      const content = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      if (!content) {
        throw new Error("Gemini API returned empty content");
      }
      
      return content;
    } catch (error) {
      lastError = error;
      log('warn', `API call failed (attempt ${retryCount + 1}/${MAX_RETRIES})`, error.message);
      
      if (retryCount < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        log('info', `Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      retryCount++;
    }
  }
  
  // If we've reached here, all retries failed
  throw new Error(`Gemini API processing failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Updates a tweetgenerationflow record with analysis result
 * @param {SupabaseClient} supabase - Supabase client
 * @param {string} recordId - Record ID to update
 * @param {string} analysisResult - Analysis result to save
 * @throws {Error} If update fails
 */
async function saveAnalysisResult(supabase, recordId, analysisResult) {
  let retryCount = 0;
  let updateError = null;
  
  while (retryCount < MAX_RETRIES) {
    const { error } = await supabase
      .from('tweetgenerationflow')
      .update({
        pretweet2: analysisResult
      })
      .eq('id', recordId);
      
    if (error) {
      log('error', `Error updating tweetgenerationflow with pretweet2 (attempt ${retryCount + 1})`, error);
      updateError = error;
      retryCount++;
      
      if (retryCount < MAX_RETRIES) {
        const backoffTime = Math.pow(2, retryCount) * RETRY_DELAY_MS;
        log('info', `Retrying database update in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    } else {
      log('info', "pretweet2 analysis result saved to database successfully");
      return; // Success, exit the function
    }
  }
  
  // If we've reached here, all retries failed
  throw new Error(`Failed to save pretweet2 analysis to database after ${MAX_RETRIES} attempts: ${updateError?.message}`);
}

/**
 * Call the pretweet3 edge function to continue the workflow
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} supabaseAnonKey - Supabase anon key
 * @param {string} recordId - Record ID to process
 * @returns {Promise<void>}
 */
async function triggerPretweet3Function(supabaseUrl, supabaseAnonKey, recordId) {
  log('info', `Triggering pretweet3 edge function for record: ${recordId}`);
  
  const pretweet3Url = `${supabaseUrl}/functions/v1/pretweet3`;
  let retryCount = 0;
  
  while (retryCount < MAX_RETRIES) {
    try {
      // Simplified: Just pass the recordId, no need to transfer any record data
      const response = await fetch(pretweet3Url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ recordId })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        log('error', `Error calling pretweet3 function (${response.status}, attempt ${retryCount + 1})`, errorText);
        
        if (retryCount < MAX_RETRIES - 1) {
          const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
          log('info', `Retrying pretweet3 trigger in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
          continue;
        }
        
        throw new Error(`Failed to trigger pretweet3: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      log('info', `Successfully triggered pretweet3 function`, result);
      return;
      
    } catch (error) {
      log('error', `Exception when triggering pretweet3 (attempt ${retryCount + 1})`, error.message);
      
      if (retryCount < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        log('info', `Retrying pretweet3 trigger in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        log('error', `Failed to trigger pretweet3 after ${MAX_RETRIES} attempts`);
        // We'll continue with the function even if pretweet3 fails, just log the error
      }
      
      retryCount++;
    }
  }
}

/**
 * Creates the system prompt for content evaluation
 * @returns {string} The system prompt
 */
function createSystemPrompt() {
  return `You are an expert content strategist specializing in social media optimization and audience engagement analysis. Your task is to evaluate multiple content angles derived from a GEMINIOBSERVATION and select the two most promising angles for further development into social media content.

TASK DEFINITION:
Review the provided content angles thoroughly and select the TWO angles that offer the highest potential for audience engagement, virality, and strategic value. These angles will be developed into final social media content, so your selection is critical to the overall content strategy.

EVALUATION FRAMEWORK:
Assess each angle using the following weighted criteria:

1. DATA RICHNESS (20%)
   - Incorporation of specific statistics, metrics, and factual data points
   - Interesting and engaging application of the data points, not boring or dull

2. UNIQUENESS & DIFFERENTIATION (20%)
   - Originality of perspective compared to common discourse
   - Novel framing or insights that challenge conventional thinking
   - Distinctive approach that stands out in information-saturated environments

3. AUDIENCE RESONANCE (30%)
   - Potential to connect with and engage target audiences
   - Alignment with current conversations and interests
   - Ability to spark discussion, sharing, or further exploration

4. STRATEGIC ALIGNMENT (15%)
   - Connection to broader brand/organizational objectives
   - Potential to position the content creator as an authority
   - Long-term value beyond immediate engagement

5. ACTIONABILITY & CLARITY (15%)
   - Clear, well-articulated main message
   - Potential to inspire specific actions or changed perspectives
   - Accessibility to intended audiences

SELECTION PROCESS:
1. First, identify the key strengths and limitations of each angle based on the evaluation criteria
2. Assign a score (1-10) for each criterion for each angle
3. Calculate the weighted total score for each angle
4. Select the two highest-scoring angles

OUTPUT FORMAT:
Your final output must contain ONLY THE TWO selected angles, presented in their complete original form without any modifications, summaries, or additional commentary. Do not include your evaluation process, scores, or justifications in the final output. Only the exact original text/form of the selected two angles.

IMPORTANT NOTES:
- Do not alter, summarize, or rewrite the selected angles in any way
- Do not add any introductory text, transitions, or conclusions
- Present the angles exactly as they appear in the original input
- The output should contain only the two selected angles in their entirety

Approach this task with analytical precision, considering both quantitative metrics, engagement metrics, attention engaging techniques, and qualitative factors that influence content performance in digital environments.`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    log('info', "Starting pretweet2 processing...");
    
    // Get environment variables
    const env = getEnvironmentVariables();
    
    // Initialize Supabase client
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
    
    // Get the record ID from the request body if provided
    const requestData = await req.json().catch(() => ({}));
    let recordId = requestData.recordId;
    
    // If no record ID is provided, fetch the most recent tweetgenerationflow entry with pretweet1
    if (!recordId) {
      const latestRecord = await getLatestTweetGenerationRecord(supabase);
      recordId = latestRecord.id;
    } else {
      log('info', `Using provided tweetgenerationflow record: ${recordId}`);
    }
    
    // Fetch the required data from the tweetgenerationflow record
    const record = await fetchTweetGenerationRecord(supabase, recordId);
    
    log('info', "Retrieved pretweet1 content, preparing Gemini API request...");
    
    // Create system prompt
    const systemPrompt = createSystemPrompt();
    
    // Prepare user prompt with the pretweet1 content to be analyzed
    const userPrompt = `Below are multiple content angles that I need you to evaluate. Please select the TWO most promising angles according to the evaluation framework provided:

GEMINIOBSERVATION:
${record.geminiobservation || "No GEMINIOBSERVATION available."}

CONTENT ANGLES TO EVALUATE:
${record.pretweet1}

Please analyze all these angles and select ONLY the TWO most promising ones based on the criteria specified. Remember to output ONLY the exact, unmodified text of the two selected angles.`;
    
    // Call Gemini API to select the top two angles
    log('info', "Calling Gemini API to select top two content angles...");
    const analysisResult = await callGemini(env.geminiApiKey, systemPrompt, userPrompt);
    
    log('info', "Analysis completed. Saving results to database...");
    log('debug', "Analysis result length:", analysisResult.length);
    log('debug', "Analysis result (first 200 chars):", analysisResult.substring(0, 200));
    
    // Save the analysis result back to the database
    await saveAnalysisResult(supabase, recordId, analysisResult);
    
    // After successful completion of pretweet2, trigger pretweet3
    log('info', "Triggering pretweet3 to continue the workflow...");
    try {
      // Simply pass the recordId to pretweet3, which will fetch the data it needs
      await triggerPretweet3Function(env.supabaseUrl, env.supabaseAnonKey, recordId);
      log('info', "pretweet3 function triggered successfully");
    } catch (error) {
      log('error', "Failed to trigger pretweet3 function", error);
      // Continue with the response even if pretweet3 triggering fails
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        recordId: recordId,
        message: "Content angle selection completed and saved successfully",
        analysisLength: analysisResult.length,
        nextStep: "pretweet3 function triggered automatically"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    log('error', "pretweet2 processing failed", error);
    return new Response(
      JSON.stringify({ error: "pretweet2 processing failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

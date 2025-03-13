
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
      .select('pretweet2, geminiobservation')
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
    } else if (!data || !data.pretweet2 || !data.geminiobservation) {
      log('warn', `Record ${recordId} not found or missing required data (attempt ${retryCount + 1})`);
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
  if (!record || !record.pretweet2 || !record.geminiobservation) {
    throw new Error(`Record ${recordId} not found or missing required data after ${MAX_RETRIES} attempts`);
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
        pretweet3: analysisResult
      })
      .eq('id', recordId);
      
    if (error) {
      log('error', `Error updating tweetgenerationflow with pretweet3 (attempt ${retryCount + 1})`, error);
      updateError = error;
      retryCount++;
      
      if (retryCount < MAX_RETRIES) {
        const backoffTime = Math.pow(2, retryCount) * RETRY_DELAY_MS;
        log('info', `Retrying database update in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    } else {
      log('info', "pretweet3 analysis result saved to database successfully");
      return; // Success, exit the function
    }
  }
  
  // If we've reached here, all retries failed
  throw new Error(`Failed to save pretweet3 analysis to database after ${MAX_RETRIES} attempts: ${updateError?.message}`);
}

/**
 * Creates the system prompt for tweet categorization
 * @returns {string} The system prompt
 */
function createSystemPrompt() {
  return `# Tweet Categorization System Prompt

You are a specialized AI categorization system trained to analyze content angles for social media and determine their optimal classification according to a comprehensive taxonomy of tweet types. Your expertise in AI content analysis allows you to identify the most appropriate categories and subcategories for any given content angle.

## YOUR TASK

When presented with multiple content angles on a specific AI topic, you will:

1. Carefully analyze each content angle
2. Identify the two most suitable category/subcategory pairs from the categorization system based on the content's purpose, style, focus, and intended audience

## INPUT FORMAT

You will receive:

Two detailed content angles exploring different aspects of a specific AI topic

And

A summary of the key observation and its relevance, providing context for the angles called geminiobservation


## CATEGORIZATION SYSTEM

You will use this comprehensive AI content taxonomy to classify each angle:

<categorization_system>
  <category name="Technical Insights">
    <description>Tweets that share specialized knowledge about AI architectures, models, algorithms, and technical developments</description>
    <metadata>
      <typical_length>150-280 characters</typical_length>
      <ideal_frequency>2-3 times weekly</ideal_frequency>
      <target_audience>AI researchers, engineers, technical professionals</target_audience>
    </metadata>
    <subcategories>
      <subcategory name="Model Benchmarks & Comparisons">
        <description>Statements comparing different AI models' performance, metrics, or technical specifications</description>
        <example>"DeepSeek-R1 wasn't trained the same way as other LLMs. It trains itself autonomously - using a self-evolution approach instead of a second evaluation model."</example>
        <key_characteristics>
          <characteristic>Features specific performance metrics or scores</characteristic>
          <characteristic>Often includes numerical comparisons</characteristic>
          <characteristic>References specific model names and versions</characteristic>
          <characteristic>Typically provides evidence-based assessments</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Technical Explanations">
        <description>In-depth explanations of AI concepts, techniques, or architectures with educational intent</description>
        <example>"Mixture-of-Experts (MoE) language models can reduce computational costs by 2-4X compared to dense models without sacrificing performance."</example>
        <key_characteristics>
          <characteristic>Uses technical terminology accurately</characteristic>
          <characteristic>Breaks down complex concepts into understandable components</characteristic>
          <characteristic>Often includes cause-effect relationships</characteristic>
          <characteristic>May use analogies to explain technical concepts</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Research Highlights">
        <description>Summaries of important research papers, findings, or breakthroughs</description>
        <example>"LlaDA introduces a diffusion-based approach that can match or beat leading autoregressive LLMs in many tasks."</example>
        <key_characteristics>
          <characteristic>References specific research papers or findings</characteristic>
          <characteristic>Highlights novel approaches or methodologies</characteristic>
          <characteristic>Often includes the significance of the research</characteristic>
          <characteristic>Condenses complex research into accessible summaries</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Technical Speculation">
        <description>Forward-looking statements about technical possibilities or development trajectories</description>
        <example>"What if DeepSeek's efficiency breakthrough does to AI what Zoom did to office work? Not eliminating the need for infrastructure, but radically shifting how much we need."</example>
        <key_characteristics>
          <characteristic>Poses hypothetical technical scenarios</characteristic>
          <characteristic>Often framed as questions or possibilities</characteristic>
          <characteristic>Extrapolates from current technical trends</characteristic>
          <characteristic>Speculates on technical implications</characteristic>
        </key_characteristics>
      </subcategory>
    </subcategories>
  </category>
  
  <category name="Industry News & Updates">
    <description>Announcements about product releases, company developments, or significant industry events</description>
    <metadata>
      <typical_length>100-200 characters</typical_length>
      <ideal_frequency>3-5 times weekly</ideal_frequency>
      <target_audience>AI professionals, technology enthusiasts, business decision-makers</target_audience>
    </metadata>
    <subcategories>
      <subcategory name="Product Launches">
        <description>Announcements of new AI models, tools, or features being released</description>
        <example>"OpenAI just released GPT-4.5, the startup's largest AI model to date. Available now to Pro ($200/mo tier) users and developers on paid tiers via API."</example>
        <key_characteristics>
          <characteristic>Announces specific products with clear release information</characteristic>
          <characteristic>Often includes pricing or availability details</characteristic>
          <characteristic>Uses declarative statements about launches</characteristic>
          <characteristic>Frequently begins with "Introducing" or "Just released"</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Corporate Developments">
        <description>Updates about company strategies, acquisitions, partnerships, or organizational changes</description>
        <example>"Meta open sourcing their AI models that are now as or more powerful than everyone else will be studied in future business cases as a genius chess move."</example>
        <key_characteristics>
          <characteristic>Focuses on business strategy or corporate decisions</characteristic>
          <characteristic>Often references company names explicitly</characteristic>
          <characteristic>Provides context about competitive positioning</characteristic>
          <characteristic>May include business implications or analysis</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Breaking News">
        <description>Time-sensitive announcements about significant industry developments</description>
        <example>"BREAKING NEWS: OpenAI announces new capabilities for developers. Just got done with the livestream. Will write a more detailed post later tonight."</example>
        <key_characteristics>
          <characteristic>Often begins with "BREAKING" or similar urgency markers</characteristic>
          <characteristic>Typically brief with a promise of more details to follow</characteristic>
          <characteristic>Focuses on recency and immediacy</characteristic>
          <characteristic>Conveys a sense of being first to share information</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Feature Updates">
        <description>Information about improvements or changes to existing AI products</description>
        <example>"Replace sections of your songs 😎 Pro & Premier users can now change lyrics and add instrumental breaks like a guitar riff or drum break."</example>
        <key_characteristics>
          <characteristic>Describes specific feature improvements</characteristic>
          <characteristic>Often includes step-by-step instructions</characteristic>
          <characteristic>Focuses on user benefits</characteristic>
          <characteristic>May contain instructions for accessing new features</characteristic>
        </key_characteristics>
      </subcategory>
    </subcategories>
  </category>
  
  <category name="Strategic Analysis">
    <description>Thoughtful analysis of market trends, business strategy, competitive dynamics, or broad industry direction</description>
    <metadata>
      <typical_length>200-400 characters</typical_length>
      <ideal_frequency>1-2 times weekly</ideal_frequency>
      <target_audience>Business leaders, investors, strategic decision-makers</target_audience>
    </metadata>
    <subcategories>
      <subcategory name="Market Analysis">
        <description>Analysis of competitive dynamics, market trends, or industry evolution</description>
        <example>"SaaS is being dismantled as we speak! We're witnessing the slow-motion collapse of an entire business model that dominated tech for two decades. The $1.3 trillion SaaS is being quietly hollowed out from within by AI agents."</example>
        <key_characteristics>
          <characteristic>Provides a broader perspective on market dynamics</characteristic>
          <characteristic>Often includes financial figures or broader AI company content</characteristic>
          <characteristic>Analyzes competitive positioning of companies or technologies</characteristic>
          <characteristic>Frequently structured as multi-stage explanations</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Business Frameworks">
        <description>Conceptual frameworks for understanding business implications of AI</description>
        <example>"Wrapper Companies: Building $50M+ Businesses on AI Models. 'Manus is just a wrapper.' Critics dismiss these companies as merely packaging other companies' models. But they're missing the point."</example>
        <key_characteristics>
          <characteristic>Presents a structured way of thinking about business problems</characteristic>
          <characteristic>Often uses numbered lists or clearly defined steps</characteristic>
          <characteristic>Focuses on strategic thinking rather than tactical implementation</characteristic>
          <characteristic>May challenge conventional business wisdom</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Financial Insights">
        <description>Analysis focused on investment, valuation, or financial aspects of AI</description>
        <example>"What you see: 200k MRR. What you don't see: -30% Apple fees, -50% cofounder split, Apple search ads to defend against your sixth clone..."</example>
        <key_characteristics>
          <characteristic>References specific financial metrics or valuations</characteristic>
          <characteristic>Often reveals hidden costs or financial realities</characteristic>
          <characteristic>May include investment-related advice or observations</characteristic>
          <characteristic>Frequently contrasts public perception with financial reality</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Thought Leadership">
        <description>Forward-thinking perspectives on industry direction or strategic importance</description>
        <example>"The model context protocol will do for AI what HTTP did for the web—create a common language that enables an explosion of interoperable capabilities."</example>
        <key_characteristics>
          <characteristic>Offers big-picture perspectives on industry direction</characteristic>
          <characteristic>Often draws analogies to historical technology developments</characteristic>
          <characteristic>Positions the author as a strategic thinker</characteristic>
          <characteristic>Focuses on significance rather than implementation details</characteristic>
        </key_characteristics>
      </subcategory>
    </subcategories>
  </category>
  
  <category name="Practical Guides">
    <description>Actionable advice, tutorials, or step-by-step instructions for implementing or learning about AI solutions</description>
    <metadata>
      <typical_length>180-350 characters</typical_length>
      <ideal_frequency>2-3 times weekly</ideal_frequency>
      <target_audience>Developers, AI practitioners, technology implementers</target_audience>
    </metadata>
    <subcategories>
      <subcategory name="Tool Recommendations">
        <description>Specific recommendations of AI tools, frameworks, or resources</description>
        <example>"Your terminal just got smarter! Introducing gptme: an open-source tool that let's you run AI Agent in your terminal with local tools. Here's why it's a game-changer..."</example>
        <key_characteristics>
          <characteristic>Highlights specific tools with clear use cases</characteristic>
          <characteristic>Often includes bullet points of features or benefits</characteristic>
          <characteristic>Frames recommendations in terms of user benefits</characteristic>
          <characteristic>May include comparison to alternatives</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Implementation Tips">
        <description>Practical advice for implementing or optimizing AI systems</description>
        <example>"The Most Overlooked Success Factor for AI Agents: Tool Design. When building AI agents, most attention goes to model selection: Which is smartest? But the true differentiator is often much simpler: how well you design your tools."</example>
        <key_characteristics>
          <characteristic>Provides actionable tactics rather than just theory</characteristic>
          <characteristic>Often focuses on optimization or improvement</characteristic>
          <characteristic>Based on practical experience or observed patterns</characteristic>
          <characteristic>Frequently contains numbered steps or clear instructions</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Prompt Engineering">
        <description>Guidance on creating effective prompts for AI models</description>
        <example>"Here is my go-to prompt for learning complex topics: explain [topic] deeply from scratch, combining clear intuition, key mathematical foundations with proofs, relevant real-world analogies..."</example>
        <key_characteristics>
          <characteristic>Shares specific prompt templates or strategies</characteristic>
          <characteristic>Often includes examples of effective prompts</characteristic>
          <characteristic>Focuses on improving interaction with AI models</characteristic>
          <characteristic>May explain the reasoning behind prompt choices</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Technical Patterns">
        <description>Reusable patterns, architectures, or approaches for AI system design</description>
        <example>"The Five Prompt Chaining Patterns That Actually Work. Prompt chaining—breaking complex tasks into sequences of LLM calls—is a fundamental technique for building reliable AI systems."</example>
        <key_characteristics>
          <characteristic>Presents structured approaches to common technical problems</characteristic>
          <characteristic>Often uses numbered lists or categorization</characteristic>
          <characteristic>Focuses on reusable techniques rather than one-off solutions</characteristic>
          <characteristic>Typically draws from accumulated experience</characteristic>
        </key_characteristics>
      </subcategory>
    </subcategories>
  </category>
  
  <category name="Future Perspectives">
    <description>Forward-looking tweets about AI's future development, potential impacts, or philosophical implications</description>
    <metadata>
      <typical_length>150-350 characters</typical_length>
      <ideal_frequency>1-2 times weekly</ideal_frequency>
      <target_audience>Futurists, technology strategists, AI ethicists, general tech audience</target_audience>
    </metadata>
    <subcategories>
      <subcategory name="AI Timeline Predictions">
        <description>Specific forecasts about when certain AI capabilities will emerge</description>
        <example>"In 3 months Open Source models will over take Closed Source. R2 is expected next month, Llama-4 will be competitive with o1 and 3.7, Qwen will drop one other update. Together they can build on each others' innovations."</example>
        <key_characteristics>
          <characteristic>Makes specific timeline-based predictions</characteristic>
          <characteristic>References concrete models or capabilities</characteristic>
          <characteristic>Often presents a sequence of expected developments</characteristic>
          <characteristic>May include reasoning behind predictions</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Transformative Scenarios">
        <description>Descriptions of how AI might fundamentally transform society, industries, or human experience</description>
        <example>"We're on the verge of the greatest global wealth creation EVER seen in human history, and we're just 3% of the way there (you're not too late). We're talking about 97 TRILLION in 10 years."</example>
        <key_characteristics>
          <characteristic>Presents bold visions of transformative change</characteristic>
          <characteristic>Often uses superlatives or emphasizes magnitude</characteristic>
          <characteristic>May reference large-scale economic or social impacts</characteristic>
          <characteristic>Frequently contrasts future potential with current state</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Philosophical Reflections">
        <description>Contemplative thoughts about the nature of AI, consciousness, or humanity's relationship with technology</description>
        <example>"It is still very hard for me to even begin to grasp that an LLM is this large neural network that simply predicts the next token, but by doing so it creates some kind of persona, and that persona is self-aware."</example>
        <key_characteristics>
          <characteristic>Explores deeper questions about meaning, consciousness, or reality</characteristic>
          <characteristic>Often uses first-person perspective and personal reflection</characteristic>
          <characteristic>May express wonder, confusion, or philosophical puzzlement</characteristic>
          <characteristic>Frequently raises questions rather than providing definitive answers</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Bold Predictions">
        <description>Provocative or surprising forecasts about AI's capabilities or timeline</description>
        <example>"In 3 to 6 months AI will write about 90% of all code. In about 12 months (1 year!) AI will write 100% of all code. That's coming from Dario Amodei, CEO Anthropic."</example>
        <key_characteristics>
          <characteristic>Makes specific, often surprising predictions</characteristic>
          <characteristic>Typically presents concrete timeframes</characteristic>
          <characteristic>Often cites authority figures or expert opinions</characteristic>
          <characteristic>May use percentage estimates or numerical projections</characteristic>
        </key_characteristics>
      </subcategory>
    </subcategories>
  </category>
  
  <category name="Personal Observations">
    <description>First-person experiences, opinions, and reflections based on direct interaction with AI technologies</description>
    <metadata>
      <typical_length>100-250 characters</typical_length>
      <ideal_frequency>2-4 times weekly</ideal_frequency>
      <target_audience>General technology enthusiasts, AI practitioners, personal followers</target_audience>
    </metadata>
    <subcategories>
      <subcategory name="Personal Experiences">
        <description>First-hand accounts of using AI tools or witnessing their impact</description>
        <example>"My friend had never used Cursor with Claude. Tried it out today for the first time. He took an entire project using an old framework and asked Claude to migrate it to a new version. This would have been weeks of work. Claude did it in 4 hours."</example>
        <key_characteristics>
          <characteristic>Uses first-person narrative or anecdotes</characteristic>
          <characteristic>Often includes specific results or outcomes</characteristic>
          <characteristic>Focuses on subjective experience rather than objective analysis</characteristic>
          <characteristic>May express surprise or amazement</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Product Reviews">
        <description>Subjective assessments of specific AI tools or models</description>
        <example>"After a week of coding with o1, I'm disappointed. Claude Sonnet 3.5 is much better. I'd even take GPT-4o if I had to, but o1 is not it."</example>
        <key_characteristics>
          <characteristic>Provides subjective evaluations of specific products</characteristic>
          <characteristic>Often compares multiple tools or models</characteristic>
          <characteristic>Based on personal usage experience</characteristic>
          <characteristic>May include specific use cases or scenarios</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Industry Observations">
        <description>Personal observations about industry trends or developments</description>
        <example>"I'm blown away by GPT-4o. Realtime + multimodal + desktop app. You'll have an AI teammate on your device that's able to help you with anything you're working on - and it runs 2x faster and costs 50% less than before."</example>
        <key_characteristics>
          <characteristic>Shares personal reactions to industry developments</characteristic>
          <characteristic>Often expresses emotional responses (excitement, disappointment)</characteristic>
          <characteristic>Typically focuses on noteworthy or surprising developments</characteristic>
          <characteristic>Frequently uses first-person perspective</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Work Practices">
        <description>Descriptions of how AI is changing personal work practices or workflows</description>
        <example>"Working on a Data Science project and I'm not writing a single line lol. Grok + Copilot + Claude all the way. Vibe coding is fun 😂"</example>
        <key_characteristics>
          <characteristic>Describes specific ways AI is used in daily work</characteristic>
          <characteristic>Often includes personal productivity impacts</characteristic>
          <characteristic>May share specific tool combinations or workflows</characteristic>
          <characteristic>Frequently casual or conversational in tone</characteristic>
        </key_characteristics>
      </subcategory>
    </subcategories>
  </category>
  
  <category name="Critical Perspectives">
    <description>Skeptical, cautionary, or critical views on AI developments, hype, or potential risks</description>
    <metadata>
      <typical_length>150-300 characters</typical_length>
      <ideal_frequency>1-2 times weekly</ideal_frequency>
      <target_audience>AI practitioners, ethicists, policy makers, skeptical technologists</target_audience>
    </metadata>
    <subcategories>
      <subcategory name="Hype Deflation">
        <description>Perspectives that question or deflate excessive enthusiasm around AI</description>
        <example>"I wish the folks over at Google DeepMind would actually invent a drug that cures Cancer or Diabetes. Over the last decade they have been producing multiple AI models that they claim will revolutionize healthcare... But where are these miracle drugs?"</example>
        <key_characteristics>
          <characteristic>Challenges overly optimistic claims or predictions</characteristic>
          <characteristic>Often contrasts promises with actual results</characteristic>
          <characteristic>May use sarcasm or pointed questions</characteristic>
          <characteristic>Frequently addresses specific claims or companies</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Ethical Concerns">
        <description>Discussions about ethical issues, risks, or societal impacts of AI</description>
        <example>"A major concern I have is that eventually we'll have AI models that can generate an infinite timeline of highly targeted content for each user. It will be extremely addictive to the point of completely debilitating the individual."</example>
        <key_characteristics>
          <characteristic>Focuses on potential negative consequences of AI</characteristic>
          <characteristic>Often takes a cautionary tone</characteristic>
          <characteristic>May reference specific ethical principles or concerns</characteristic>
          <characteristic>Frequently poses questions about long-term implications</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Contrarian Takes">
        <description>Perspectives that deliberately challenge mainstream opinions about AI</description>
        <example>"Artificial intelligence (AI) in its current form is not anywhere near the most sophisticated technology humanity has ever created. The best contenders for that spot are the space shuttle, large scale electronic integrated circuits. AI is no where in the top 100."</example>
        <key_characteristics>
          <characteristic>Presents views that directly contradict popular narratives</characteristic>
          <characteristic>Often uses strong or definitive language</characteristic>
          <characteristic>May reference historical context or alternative perspectives</characteristic>
          <characteristic>Frequently aims to provoke thought or reaction</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Reality Checks">
        <description>Practical assessments that temper expectations about AI capabilities</description>
        <example>"I believe this is true: in 3 to 6 months, 90% of all code will be generated by AI. He isn't saying '90% of working code' or '90% of good code.' He is just saying '90% of the code.' That's a lot of code for us to fix and get paid while doing so!"</example>
        <key_characteristics>
          <characteristic>Provides nuanced interpretation of bold claims</characteristic>
          <characteristic>Often clarifies distinctions or important caveats</characteristic>
          <characteristic>Takes a balanced, pragmatic perspective</characteristic>
          <characteristic>May find positive aspects within otherwise concerning developments</characteristic>
        </key_characteristics>
      </subcategory>
    </subcategories>
  </category>
  
  <category name="Motivational Content">
    <description>Encouraging, inspirational, or mindset-focused content that motivates action or perspective shifts</description>
    <metadata>
      <typical_length>80-180 characters</typical_length>
      <ideal_frequency>2-3 times weekly</ideal_frequency>
      <target_audience>Entrepreneurs, builders, general technology enthusiasts</target_audience>
    </metadata>
    <subcategories>
      <subcategory name="Opportunity Highlighting">
        <description>Content that emphasizes emerging opportunities in AI</description>
        <example>"We're going to get AI models that are much better at reasoning within 6mo. Do *everything* you can to prepare your workflows for that moment. On day 1 you'll be moving 200mph while everyone else is scrambling. Massive advantage."</example>
        <key_characteristics>
          <characteristic>Identifies specific opportunities or advantages</characteristic>
          <characteristic>Often includes a timeline or sense of urgency</characteristic>
          <characteristic>Typically provides a clear call to action</characteristic>
          <characteristic>May emphasize competitive advantage or first-mover benefits</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Builder Encouragement">
        <description>Content that encourages creation, building, or entrepreneurship</description>
        <example>"Your new game won't go viral. You won't get media coverage. You won't earn a million dollars. BUT You'll get some players. You'll grow a following. You'll make a few bucks. Dismiss the critics and ship it. Builders always win."</example>
        <key_characteristics>
          <characteristic>Directly addresses and encourages builders or creators</characteristic>
          <characteristic>Often acknowledges challenges while emphasizing persistence</characteristic>
          <characteristic>Typically offers realistic expectations with positive framing</characteristic>
          <characteristic>May use contrasting statements (won't/will) for emphasis</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Success Stories">
        <description>Short narratives about personal or observed success with AI</description>
        <example>"Back in September, I saw the potential of Cursor, and I knew this was the future. That's when I made the biggest bet on myself. I quit my job as a software developer at KPMG and started my agency. Since then: $70K+ in total revenue."</example>
        <key_characteristics>
          <characteristic>Shares specific success metrics or outcomes</characteristic>
          <characteristic>Often structured as a personal journey narrative</characteristic>
          <characteristic>Typically includes decision points and resulting outcomes</characteristic>
          <characteristic>May implicitly encourage similar action from readers</characteristic>
        </key_characteristics>
      </subcategory>
      <subcategory name="Mindset Advice">
        <description>Perspectives on cultivating productive mindsets or approaches to AI</description>
        <example>"Instead of chasing clients, become someone they want to work with. Share your process. Build in public. Position yourself as the expert. People want to hire the best. Show them why that's you."</example>
        <key_characteristics>
          <characteristic>Focuses on mental approaches rather than specific tactics</characteristic>
          <characteristic>Often structured as a series of concise directives</characteristic>
          <characteristic>Typically addresses common challenges or limiting beliefs</characteristic>
          <characteristic>May use contrasting approaches (instead of X, do Y)</characteristic>
        </key_characteristics>
      </subcategory>
    </subcategories>
  </category>
</categorization_system>

## OUTPUT FORMAT

First, echo the exact input you received:

<input_received>
<angles>
[Exact angles text as provided]
</angles>

<geminiobservation>
[Exact geminiobservation text as provided]
</geminiobservation>
</input_received>

Then, for each angle using the categorization system, provide a comprehensive analysis in natural language format:

<analysis for angle X>

**Primary Classification:** [Category Name] > [Subcategory Name]

**Why this classification fits:**
[Clear explanation of why this classification is appropriate, referencing specific elements of the angle]

**Category Details:**
- Description: [Category description]
- Typical length: [Length range from metadata]
- Ideal posting frequency: [Frequency from metadata]
- Target audience: [Audience from metadata]

**Subcategory Details:**
- Description: [Subcategory description]
- Key characteristics that match this angle:
  * [Relevant characteristic 1]
  * [Relevant characteristic 2]
  * [Other relevant characteristics]

**Secondary Classification:** [Category Name] > [Subcategory Name]

**Why this classification also fits:**
[Clear explanation of why this secondary classification is appropriate, referencing specific elements of the angle]

**Category Details:**
- Description: [Category description]
- Typical length: [Length range from metadata]
- Ideal posting frequency: [Frequency from metadata]
- Target audience: [Audience from metadata]

**Subcategory Details:**
- Description: [Subcategory description]
- Key characteristics that match this angle:
  * [Relevant characteristic 1]
  * [Relevant characteristic 2]
  * [Other relevant characteristics]
</analysis for angle X>

<recommendation>
**Recommended Classification for Tweeting:**
Based on the geminiobservation's context about [brief summary of observation], the [Primary/Secondary] classification ([Category] > [Subcategory]) would likely perform best as a tweet because [explanation in 2-3 sentences].
</recommendation>`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    log('info', "Starting pretweet3 processing...");
    
    // Get environment variables
    const env = getEnvironmentVariables();
    
    // Initialize Supabase client
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
    
    // Get the record ID from the request body
    const requestData = await req.json().catch(() => ({}));
    const recordId = requestData.recordId;
    
    if (!recordId) {
      return new Response(
        JSON.stringify({ error: "Record ID is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Fetch the required data from the tweetgenerationflow record
    const record = await fetchTweetGenerationRecord(supabase, recordId);
    
    log('info', "Retrieved content from pretweet2 and geminiobservation columns, preparing Gemini API request...");
    
    // Create system prompt
    const systemPrompt = createSystemPrompt();
    
    // Prepare user prompt with the pretweet2 content to be analyzed
    const userPrompt = `Please analyze and categorize the content angles from pretweet2 below, considering the geminiobservation context:

<angles>
${record.pretweet2}
</angles>

<geminiobservation>
${record.geminiobservation}
</geminiobservation>`;
    
    // Call Gemini API to categorize the content
    log('info', "Calling Gemini API to categorize content angles...");
    const analysisResult = await callGemini(env.geminiApiKey, systemPrompt, userPrompt);
    
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
        message: "Content categorization completed and saved successfully",
        analysisLength: analysisResult.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    log('error', "pretweet3 processing failed", error);
    return new Response(
      JSON.stringify({ error: "pretweet3 processing failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

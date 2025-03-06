
// Data Collection Service
// This edge function collects AI-related content from Perplexity Sonar API

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle CORS preflight requests
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const environmentVariables = Deno.env.toObject();
  const supabaseUrl = environmentVariables.SUPABASE_URL || '';
  const supabaseAnonKey = environmentVariables.SUPABASE_ANON_KEY || '';
  const perplexityApiKey = environmentVariables.PERPLEXITY_API_KEY || '';
  
  // Validate required environment variables
  if (!perplexityApiKey) {
    console.error("Missing PERPLEXITY_API_KEY environment variable");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Starting data collection process...");
    
    // Add a random delay between 1-30 minutes (in ms)
    const delayMinutes = Math.floor(Math.random() * 30) + 1;
    const delayMs = delayMinutes * 60 * 1000;
    
    console.log(`Adding a random delay of ${delayMinutes} minutes before collection...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    // Collect data from Perplexity Sonar Pro API
    const aiContent = await fetchFromPerplexity(perplexityApiKey);
    
    // Process and standardize the collected data
    const processedContent = {
      source: 'perplexity',
      content_type: 'article',
      title: 'AI Daily Update',
      summary: aiContent,
      published_date: new Date().toISOString(),
      topics: extractTopics(aiContent),
      relevance_score: calculateRelevanceScore(aiContent),
      created_at: new Date().toISOString()
    };
    
    // Store collected data in Supabase
    const { data, error } = await supabase
      .from('collected_content')
      .insert([processedContent]);
      
    if (error) {
      console.error("Error storing data in Supabase:", error);
      return new Response(
        JSON.stringify({ error: "Failed to store collected data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    console.log("Data collection completed successfully");
    return new Response(
      JSON.stringify({ success: true, message: "Data collection completed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Data collection failed:", error);
    return new Response(
      JSON.stringify({ error: "Data collection failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to fetch data from Perplexity Sonar Pro API
async function fetchFromPerplexity(apiKey: string): Promise<string> {
  console.log("Fetching data from Perplexity Sonar Pro API...");
  
  const requestBody = {
    model: "sonar-pro",
    messages: [
      {
        role: "user",
        content: "Provide an in-depth, highly detailed report on the major news, significant announcements, and the biggest updates from the past 4 days, strictly from March 3, 2025, to March 6, 2025, including today, related to artificial intelligence. Focus on large language models, groundbreaking new AI tools, revolutionary AI models, major programming or coding advancements tied to AI, and the most important AI conversations or developments. Categorize the updates by day, starting with March 6, 2025, and going back to March 3, 2025, using only the exact publication dates from the sources. If a date is unclear or unavailable, note it as 'date uncertain.' Include extensive examples, thorough descriptions of what makes each update significant, the potential impact on the AI field, and any notable details about how these developments came about. I want a lengthy and comprehensive output with as much information as possible.",
      },
    ],
    max_tokens: 8192,
    search_recency_filter: "day",
    return_citations: false,
  };

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", errorText);
      throw new Error(`Perplexity API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error fetching from Perplexity:", error);
    throw error;
  }
}

// Function to extract topics from the AI content
function extractTopics(content: string): string[] {
  // Simple keyword-based topic extraction
  const topicKeywords = [
    "LLM", "GPT", "AI model", "machine learning", "deep learning",
    "neural network", "transformer", "generative AI", "diffusion model",
    "reinforcement learning", "AI research", "large language model",
    "OpenAI", "Anthropic", "Google AI", "Meta AI", "Microsoft AI",
    "AI ethics", "AI safety", "prompt engineering", "fine-tuning",
    "AI application", "computer vision", "NLP", "natural language processing"
  ];
  
  const topics = new Set<string>();
  
  for (const keyword of topicKeywords) {
    if (content.toLowerCase().includes(keyword.toLowerCase())) {
      topics.add(keyword);
    }
  }
  
  // Limit to top 10 topics
  return Array.from(topics).slice(0, 10);
}

// Function to calculate relevance score based on AI keywords
function calculateRelevanceScore(content: string): number {
  const aiKeywords = [
    "large language model", "LLM", "artificial intelligence", "AI", "machine learning",
    "deep learning", "neural network", "GPT", "transformer", "generative AI",
    "diffusion model", "reinforcement learning", "computer vision", "NLP"
  ];
  
  // Count keyword occurrences
  let keywordCount = 0;
  for (const keyword of aiKeywords) {
    const regex = new RegExp(keyword, 'gi');
    const matches = content.match(regex);
    if (matches) {
      keywordCount += matches.length;
    }
  }
  
  // Normalize score to 0-100 range
  // Assume a good article has at least 30 keyword mentions
  const score = Math.min(100, (keywordCount / 30) * 100);
  return Math.round(score);
}

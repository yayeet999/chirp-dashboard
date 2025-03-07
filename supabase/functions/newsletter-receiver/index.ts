
// Newsletter Receiver Edge Function
// This edge function receives newsletter data from Zapier and stores it in the database

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
    console.log("Received newsletter data from Zapier");
    
    // Check if the request method is POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 405 
        }
      );
    }
    
    // Parse the request body
    let requestData;
    try {
      requestData = await req.json();
      console.log("Received data:", JSON.stringify(requestData));
    } catch (error) {
      console.error("Error parsing request body:", error);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 400 
        }
      );
    }
    
    // Validate the required fields
    const { content, newsletter_date } = requestData;
    
    if (!content) {
      console.error("Missing required field: content");
      return new Response(
        JSON.stringify({ error: "Missing required field: content" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 400 
        }
      );
    }
    
    // Prepare data for insertion
    const newsletterData = {
      content,
      newsletter_date: newsletter_date || new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    // Insert the data into the newsletters table
    const { data, error } = await supabase
      .from('newsletters')
      .insert([newsletterData]);
      
    if (error) {
      console.error("Error storing newsletter data in Supabase:", error);
      return new Response(
        JSON.stringify({ error: "Failed to store newsletter data" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 500 
        }
      );
    }
    
    console.log("Newsletter data stored successfully");
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Newsletter data received and stored" 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      }
    );
    
  } catch (error) {
    console.error("Newsletter receiver failed:", error);
    return new Response(
      JSON.stringify({ error: "Newsletter processing failed", details: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 500 
      }
    );
  }
});

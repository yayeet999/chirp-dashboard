
// Data Collection Scheduler
// This edge function is triggered by a cron job to schedule data collection for both user IDs and keywords

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
    console.log("Scheduler triggered, calling both data collection functions in parallel...");
    
    // Call both data collection functions in parallel
    const [usersResponse, keywordsResponse] = await Promise.all([
      supabase.functions.invoke('data-collection-users', {
        method: 'POST',
        body: {}
      }),
      supabase.functions.invoke('data-collection-keywords', {
        method: 'POST',
        body: {}
      })
    ]);
    
    // Check for errors in either function call
    if (usersResponse.error) {
      console.error("Error calling user data collection function:", usersResponse.error);
    } else {
      console.log("User data collection function called successfully:", usersResponse.data);
    }
    
    if (keywordsResponse.error) {
      console.error("Error calling keyword data collection function:", keywordsResponse.error);
    } else {
      console.log("Keyword data collection function called successfully:", keywordsResponse.data);
    }
    
    // Return success if at least one function completed successfully
    if (!usersResponse.error || !keywordsResponse.error) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Data collection scheduled",
          users: usersResponse.error ? "failed" : "success",
          keywords: keywordsResponse.error ? "failed" : "success"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      // Both functions failed
      return new Response(
        JSON.stringify({ error: "Both data collection functions failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
  } catch (error) {
    console.error("Scheduler error:", error);
    return new Response(
      JSON.stringify({ error: "Scheduler failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

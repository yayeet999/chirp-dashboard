
// Data Collection Scheduler
// This edge function is triggered by a cron job to schedule data collection

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
    console.log("Scheduler triggered, calling data collection function...");
    
    // Call the data-collection function
    const functionResponse = await supabase.functions.invoke('data-collection', {
      method: 'POST',
      body: {}
    });
    
    if (!functionResponse.error) {
      console.log("Data collection function called successfully:", functionResponse.data);
      return new Response(
        JSON.stringify({ success: true, message: "Data collection scheduled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      console.error("Error calling data collection function:", functionResponse.error);
      return new Response(
        JSON.stringify({ error: "Failed to schedule data collection", details: functionResponse.error }),
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

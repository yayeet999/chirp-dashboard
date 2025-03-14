
// Short-term Context Refiner Scheduler
// This edge function checks if both unrefined contexts are ready, then triggers the refiners

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
    console.log("Starting refiner scheduler check...");
    
    // Get the latest unrefined record to check if both contexts are available
    const { data: latestUnrefined, error: getError } = await supabase
      .from('unrefined')
      .select('id, shortterm_context1_unrefined, shortterm_context2_unrefined')
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (getError) {
      console.error("Error fetching latest unrefined record:", getError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch latest unrefined record" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    // Check if we have both contexts ready
    if (!latestUnrefined || latestUnrefined.length === 0) {
      console.log("No unrefined records found");
      return new Response(
        JSON.stringify({ message: "No unrefined records found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    const unrefined = latestUnrefined[0];
    
    // Check if both contexts are available
    if (!unrefined.shortterm_context1_unrefined || !unrefined.shortterm_context2_unrefined) {
      console.log("Both contexts are not ready yet:", {
        context1: !!unrefined.shortterm_context1_unrefined,
        context2: !!unrefined.shortterm_context2_unrefined
      });
      
      return new Response(
        JSON.stringify({ 
          message: "Both contexts are not ready yet",
          context1_ready: !!unrefined.shortterm_context1_unrefined,
          context2_ready: !!unrefined.shortterm_context2_unrefined
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    console.log("Both contexts are ready, triggering refiner functions in parallel...");
    
    // Call both refiner functions in parallel
    const [refiner1Response, refiner2Response] = await Promise.all([
      supabase.functions.invoke('shortterm-refiner1', {
        method: 'POST',
        body: { unrefined_id: unrefined.id }
      }),
      supabase.functions.invoke('shortterm-refiner2', {
        method: 'POST',
        body: { unrefined_id: unrefined.id }
      })
    ]);
    
    // Check for errors in either function call
    let status = { refiner1: "success", refiner2: "success" };
    
    if (refiner1Response.error) {
      console.error("Error calling shortterm-refiner1 function:", refiner1Response.error);
      status.refiner1 = "failed";
    } else {
      console.log("shortterm-refiner1 function called successfully:", refiner1Response.data);
    }
    
    if (refiner2Response.error) {
      console.error("Error calling shortterm-refiner2 function:", refiner2Response.error);
      status.refiner2 = "failed";
    } else {
      console.log("shortterm-refiner2 function called successfully:", refiner2Response.data);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Refiner functions triggered",
        refiner1_status: status.refiner1,
        refiner2_status: status.refiner2
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Refiner scheduler error:", error);
    return new Response(
      JSON.stringify({ error: "Refiner scheduler failed", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

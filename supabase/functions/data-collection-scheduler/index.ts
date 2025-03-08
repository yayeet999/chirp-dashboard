
// Data Collection Scheduler
// This edge function is triggered by a cron job to schedule data collection for user IDs

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
  const upstashRedisUrl = environmentVariables.UPSTASH_REDIS_REST_URL || '';
  const upstashRedisToken = environmentVariables.UPSTASH_REDIS_REST_TOKEN || '';
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log("Scheduler triggered, calling data collection function...");
    
    // Call the data collection function for users
    const usersResponse = await supabase.functions.invoke('data-collection-users', {
      method: 'POST',
      body: {}
    });
    
    // Check for errors in the function call
    if (usersResponse.error) {
      console.error("Error calling user data collection function:", usersResponse.error);
    } else {
      console.log("User data collection function called successfully:", usersResponse.data);
    }
    
    // Increment the Redis counter for context updates
    let dataCollectionCounter = 1;
    let triggerContextUpdate = false;
    
    try {
      if (upstashRedisUrl && upstashRedisToken) {
        // Increment counter using Upstash Redis REST API
        const incrementResponse = await fetch(`${upstashRedisUrl}/incr/data_collection_counter`, {
          headers: {
            Authorization: `Bearer ${upstashRedisToken}`
          }
        });
        
        if (!incrementResponse.ok) {
          throw new Error(`Redis increment failed: ${incrementResponse.statusText}`);
        }
        
        const incrementResult = await incrementResponse.json();
        dataCollectionCounter = incrementResult.result;
        console.log(`Data collection counter incremented to: ${dataCollectionCounter}`);
        
        // Check if we need to update context (after 12 cycles as specified)
        if (dataCollectionCounter >= 12) {
          console.log("Triggering context update after 12 cycles...");
          triggerContextUpdate = true;
          
          // Reset counter in Redis
          const resetResponse = await fetch(`${upstashRedisUrl}/set/data_collection_counter/0`, {
            headers: {
              Authorization: `Bearer ${upstashRedisToken}`
            }
          });
          
          if (!resetResponse.ok) {
            throw new Error(`Redis reset failed: ${resetResponse.statusText}`);
          }
          
          console.log("Data collection counter reset to 0");
        }
      } else {
        console.log("Upstash Redis configuration not found, skipping counter management");
      }
    } catch (redisError) {
      console.error("Error managing Redis counter:", redisError);
      // Continue execution - counter errors shouldn't stop the main flow
    }
    
    // If we've reached 12 cycles, trigger the context update functions
    if (triggerContextUpdate) {
      console.log("Trigger condition met, calling context processing functions in parallel...");
      
      // Call both context processing functions in parallel
      const [context1Response, context2Response] = await Promise.all([
        supabase.functions.invoke('shortterm-context1', {
          method: 'POST',
          body: {}
        }),
        supabase.functions.invoke('shortterm-context2', {
          method: 'POST',
          body: {}
        })
      ]);
      
      // Check for errors in either function call
      if (context1Response.error) {
        console.error("Error calling shortterm-context1 function:", context1Response.error);
      } else {
        console.log("shortterm-context1 function called successfully:", context1Response.data);
      }
      
      if (context2Response.error) {
        console.error("Error calling shortterm-context2 function:", context2Response.error);
      } else {
        console.log("shortterm-context2 function called successfully:", context2Response.data);
      }
    }
    
    // Return success if users function completed successfully
    if (!usersResponse.error) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Data collection scheduled",
          users: usersResponse.error ? "failed" : "success",
          cycle_count: dataCollectionCounter,
          context_update_triggered: triggerContextUpdate
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      // Function failed
      return new Response(
        JSON.stringify({ error: "Data collection function failed" }),
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

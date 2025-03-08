
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
    let mediumTermCounter = 0;
    let triggerContextUpdate = false;
    let triggerMediumTermUpdate = false;
    
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
          
          // Increment medium term counter when data collection counter resets
          const mediumTermIncrementResponse = await fetch(`${upstashRedisUrl}/incr/medium_term_counter`, {
            headers: {
              Authorization: `Bearer ${upstashRedisToken}`
            }
          });
          
          if (!mediumTermIncrementResponse.ok) {
            throw new Error(`Medium term counter increment failed: ${mediumTermIncrementResponse.statusText}`);
          }
          
          const mediumTermResult = await mediumTermIncrementResponse.json();
          mediumTermCounter = mediumTermResult.result;
          console.log(`Medium term counter incremented to: ${mediumTermCounter}`);
          
          // Check if we need to trigger medium term context update (after 3 cycles)
          if (mediumTermCounter >= 3) {
            console.log("Triggering medium term context update after 3 cycles...");
            triggerMediumTermUpdate = true;
            
            // Reset medium term counter
            const resetMediumTermResponse = await fetch(`${upstashRedisUrl}/set/medium_term_counter/0`, {
              headers: {
                Authorization: `Bearer ${upstashRedisToken}`
              }
            });
            
            if (!resetMediumTermResponse.ok) {
              throw new Error(`Medium term counter reset failed: ${resetMediumTermResponse.statusText}`);
            }
            
            console.log("Medium term counter reset to 0");
          }
        } else {
          // Get current medium term counter value
          const getMediumTermResponse = await fetch(`${upstashRedisUrl}/get/medium_term_counter`, {
            headers: {
              Authorization: `Bearer ${upstashRedisToken}`
            }
          });
          
          if (getMediumTermResponse.ok) {
            const getMediumTermResult = await getMediumTermResponse.json();
            mediumTermCounter = getMediumTermResult.result || 0;
            console.log(`Current medium term counter: ${mediumTermCounter}`);
          }
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
      
      // Wait a short time to ensure the unrefined data has been updated
      // before triggering the refiner scheduler
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Call the refiner scheduler function
      const refinerResponse = await supabase.functions.invoke('shortterm-context-refiner-scheduler', {
        method: 'POST',
        body: {}
      });
      
      if (refinerResponse.error) {
        console.error("Error calling refiner scheduler function:", refinerResponse.error);
      } else {
        console.log("Refiner scheduler function called successfully:", refinerResponse.data);
      }
    }
    
    // If we've reached 3 medium term cycles, trigger the medium term context function
    if (triggerMediumTermUpdate) {
      console.log("Medium term trigger condition met, calling medium term context processing function...");
      
      // Wait to ensure short-term context processing is complete
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Call the medium term context function
      const mediumTermResponse = await supabase.functions.invoke('mediumterm-context', {
        method: 'POST',
        body: {}
      });
      
      if (mediumTermResponse.error) {
        console.error("Error calling mediumterm-context function:", mediumTermResponse.error);
      } else {
        console.log("mediumterm-context function called successfully:", mediumTermResponse.data);
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
          medium_term_count: mediumTermCounter,
          context_update_triggered: triggerContextUpdate,
          medium_term_update_triggered: triggerMediumTermUpdate
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

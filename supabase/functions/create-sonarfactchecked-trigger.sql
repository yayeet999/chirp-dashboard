
-- First, create the pg_net extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the gemsonarclean edge function when sonarfactchecked is updated
CREATE OR REPLACE FUNCTION public.trigger_gemsonarclean()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT := 'https://exqqpgsbpveeffpbxmdq.supabase.co/functions/v1/gemsonarclean';
  supabase_anon_key TEXT := (SELECT value FROM secrets.secrets WHERE name = 'SUPABASE_ANON_KEY');
  status INTEGER;
  retry_count INTEGER := 0;
  max_retries INTEGER := 3;
  retry_delay INTEGER := 2; -- seconds
BEGIN
  -- Only trigger if sonarfactchecked was updated and is not null
  IF (TG_OP = 'UPDATE' AND NEW.sonarfactchecked IS NOT NULL AND 
      (OLD.sonarfactchecked IS NULL OR OLD.sonarfactchecked <> NEW.sonarfactchecked)) THEN
    
    -- Implement retry logic for more resilience
    WHILE retry_count < max_retries LOOP
      BEGIN
        -- Make HTTP POST request to gemsonarclean edge function
        SELECT status FROM pg_net.http_post(
          url := edge_function_url,
          body := json_build_object('recordId', NEW.id)::text,
          headers := json_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || supabase_anon_key
          )
        ) INTO status;
        
        -- Log the call
        INSERT INTO public.fn_edge_logs (table_name, operation, record_id, edge_function, status_code, retry_count)
        VALUES ('tweetgenerationflow', TG_OP, NEW.id, 'gemsonarclean', status, retry_count);
        
        -- If the call was successful (status 2xx), break out of the retry loop
        IF status >= 200 AND status < 300 THEN
          EXIT;
        END IF;
        
        -- Otherwise, increment retry count and sleep before trying again
        retry_count := retry_count + 1;
        
        -- Log the retry attempt
        INSERT INTO public.fn_edge_logs (table_name, operation, record_id, edge_function, status_code, retry_count, notes)
        VALUES ('tweetgenerationflow', TG_OP, NEW.id, 'gemsonarclean_retry', status, retry_count, 
                'Retrying after failure. Attempt ' || retry_count || ' of ' || max_retries);
        
        -- Sleep before retry (only if we haven't reached max retries)
        IF retry_count < max_retries THEN
          PERFORM pg_sleep(retry_delay * retry_count); -- Exponential backoff
        END IF;
        
      EXCEPTION WHEN OTHERS THEN
        -- Log any exceptions during the HTTP call
        INSERT INTO public.fn_edge_logs (table_name, operation, record_id, edge_function, status_code, retry_count, notes)
        VALUES ('tweetgenerationflow', TG_OP, NEW.id, 'gemsonarclean_error', NULL, retry_count, 
                'Error: ' || SQLERRM);
        
        -- Increment retry count
        retry_count := retry_count + 1;
        
        -- Sleep before retry (only if we haven't reached max retries)
        IF retry_count < max_retries THEN
          PERFORM pg_sleep(retry_delay * retry_count); -- Exponential backoff
        END IF;
      END;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- If the logs table doesn't exist, create it with additional columns for retry tracking
CREATE TABLE IF NOT EXISTS public.fn_edge_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id UUID NOT NULL,
  edge_function TEXT NOT NULL,
  status_code INTEGER,
  retry_count INTEGER DEFAULT 0,
  notes TEXT
);

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS trigger_gemsonarclean ON public.tweetgenerationflow;

-- Create the trigger to call gemsonarclean on update of sonarfactchecked column
CREATE TRIGGER trigger_gemsonarclean
AFTER UPDATE ON public.tweetgenerationflow
FOR EACH ROW
EXECUTE FUNCTION public.trigger_gemsonarclean();

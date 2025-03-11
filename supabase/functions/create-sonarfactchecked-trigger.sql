
-- First, create the pg_net extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the gemsonarclean edge function when sonarfactchecked is updated
CREATE OR REPLACE FUNCTION public.trigger_gemsonarclean()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT := 'https://exqqpgsbpveeffpbxmdq.supabase.co/functions/v1/gemsonarclean';
  supabase_anon_key TEXT := (SELECT value FROM secrets.secrets WHERE name = 'SUPABASE_ANON_KEY');
  status INTEGER;
BEGIN
  -- Only trigger if sonarfactchecked was updated and is not null
  IF (TG_OP = 'UPDATE' AND NEW.sonarfactchecked IS NOT NULL AND 
      (OLD.sonarfactchecked IS NULL OR OLD.sonarfactchecked <> NEW.sonarfactchecked)) THEN
    
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
    INSERT INTO public.fn_edge_logs (table_name, operation, record_id, edge_function, status_code)
    VALUES ('tweetgenerationflow', TG_OP, NEW.id, 'gemsonarclean', status);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- If the logs table doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.fn_edge_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id UUID NOT NULL,
  edge_function TEXT NOT NULL,
  status_code INTEGER
);

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS trigger_gemsonarclean ON public.tweetgenerationflow;

-- Create the trigger to call gemsonarclean on update of sonarfactchecked column
CREATE TRIGGER trigger_gemsonarclean
AFTER UPDATE ON public.tweetgenerationflow
FOR EACH ROW
EXECUTE FUNCTION public.trigger_gemsonarclean();

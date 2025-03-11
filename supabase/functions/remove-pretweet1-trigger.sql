
-- Drop the trigger and function if they exist
DROP TRIGGER IF EXISTS trigger_pretweet1 ON public.tweetgenerationflow;
DROP FUNCTION IF EXISTS public.trigger_pretweet1 CASCADE;

-- Log the removal of the trigger in the fn_edge_logs table
INSERT INTO public.fn_edge_logs (table_name, operation, record_id, edge_function, notes)
VALUES ('tweetgenerationflow', 'REMOVE_TRIGGER', '00000000-0000-0000-0000-000000000000', 'pretweet1_trigger_removal', 
        'Trigger and function removed at ' || now());

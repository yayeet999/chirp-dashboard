
-- Enable the required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a job that runs at specific times: 6am, 11am, 4pm, and 9pm Central Time (UTC-6)
SELECT cron.schedule(
  'data-collection-at-specific-times',
  '0 6,11,16,21 * * *', -- At 6am, 11am, 4pm, and 9pm
  $$
  SELECT net.http_post(
    url:='https://exqqpgsbpveeffpbxmdq.supabase.co/functions/v1/data-collection-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cXFwZ3NicHZlZWZmcGJ4bWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyOTc4MzAsImV4cCI6MjA1Njg3MzgzMH0.U47uFPhOhruPZWCA_jPdm-VbWgVeF-I7N4U-DF2kyjw"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Drop the old job if it exists
SELECT cron.unschedule('data-collection-every-2-hours');

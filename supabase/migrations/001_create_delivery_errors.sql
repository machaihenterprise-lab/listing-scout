-- Migration: create delivery_errors table
-- Run this in your Supabase SQL editor or migration runner.
CREATE TABLE IF NOT EXISTS delivery_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text,
  to_phone text,
  provider text,
  status_code integer,
  error_text text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

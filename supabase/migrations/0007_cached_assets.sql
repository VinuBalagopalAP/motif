-- Run this in your Supabase SQL Editor to create the cached_assets table

CREATE TABLE public.cached_assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  query text NOT NULL,
  asset_type text NOT NULL, -- e.g., 'gif', 'background', 'audio'
  data jsonb NOT NULL, -- Array of URLs fetched for this query
  usage_count integer DEFAULT 0,
  last_fetched_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cached_assets ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access (since the pipeline runs server-side, it uses anon key for queries)
CREATE POLICY "Allow anonymous select on cached_assets"
  ON public.cached_assets
  FOR SELECT
  USING (true);

-- Allow anonymous insert access
CREATE POLICY "Allow anonymous insert on cached_assets"
  ON public.cached_assets
  FOR INSERT
  WITH CHECK (true);

-- Allow anonymous update access
CREATE POLICY "Allow anonymous update on cached_assets"
  ON public.cached_assets
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Automatically provision the "fonts" storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fonts', 
  'fonts', 
  true, 
  5242880, -- 5MB limit
  ARRAY['font/ttf', 'font/otf', 'application/x-font-ttf', 'font/woff', 'font/woff2']::text[]
)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow public read access
CREATE POLICY "Allow public read fonts"
ON storage.objects FOR SELECT
USING (bucket_id = 'fonts');

-- Allow anonymous inserts (uploads)
CREATE POLICY "Allow anonymous insert fonts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'fonts');

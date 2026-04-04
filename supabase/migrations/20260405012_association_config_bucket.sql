INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'association-config',
  'association-config',
  false,
  262144,
  ARRAY['application/json']
)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';

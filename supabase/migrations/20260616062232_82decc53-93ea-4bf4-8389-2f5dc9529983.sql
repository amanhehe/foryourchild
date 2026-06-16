CREATE TABLE public.word_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word text NOT NULL UNIQUE,
  image_data text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.word_images TO authenticated;
GRANT ALL ON public.word_images TO service_role;

ALTER TABLE public.word_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read word images"
ON public.word_images FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can add word images"
ON public.word_images FOR INSERT TO authenticated
WITH CHECK (true);
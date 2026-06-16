DROP POLICY "Authenticated can add word images" ON public.word_images;
REVOKE INSERT ON public.word_images FROM authenticated;
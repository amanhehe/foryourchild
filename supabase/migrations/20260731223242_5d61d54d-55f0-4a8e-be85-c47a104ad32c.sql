CREATE TABLE public.learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_context text NOT NULL,
  component text NOT NULL,
  event_name text NOT NULL,
  description text NOT NULL,
  origin text NOT NULL DEFAULT 'web',
  target text,
  action text,
  route text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX learning_events_user_time_idx ON public.learning_events (user_id, occurred_at DESC);
CREATE INDEX learning_events_child_idx ON public.learning_events (child_id, occurred_at DESC);

GRANT SELECT, INSERT ON public.learning_events TO authenticated;
GRANT ALL ON public.learning_events TO service_role;

ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own events" ON public.learning_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own events" ON public.learning_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Teachers read events for their pupils" ON public.learning_events
  FOR SELECT TO authenticated USING (child_id IS NOT NULL AND public.teacher_can_read_child(child_id));

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children(id) ON DELETE CASCADE,
  quiz_id text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own quiz attempts" ON public.quiz_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own quiz attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Teachers read pupil quiz attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (child_id IS NOT NULL AND public.teacher_can_read_child(child_id));
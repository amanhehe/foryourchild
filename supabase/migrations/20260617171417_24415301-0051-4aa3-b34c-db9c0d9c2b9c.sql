CREATE OR REPLACE FUNCTION public.teacher_can_read_child(_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classroom_children cc
    JOIN public.classrooms c ON c.id = cc.classroom_id
    WHERE cc.child_id = _child_id
      AND c.teacher_id = auth.uid()
  )
$$;

CREATE POLICY "Teachers read children in their classrooms"
ON public.children
FOR SELECT
TO authenticated
USING (public.teacher_can_read_child(id));
REVOKE EXECUTE ON FUNCTION public.teacher_can_read_child(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_can_read_child(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_can_read_child(uuid) TO authenticated;
-- Restore EXECUTE on SECURITY DEFINER functions that are referenced inside RLS policies.
-- These must be executable by the authenticated role because policy expressions
-- are evaluated as the calling user. Revoking EXECUTE broke SELECTs on children.
GRANT EXECUTE ON FUNCTION public.teacher_can_read_child(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

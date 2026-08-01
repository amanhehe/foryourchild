import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The raw clickstream log used to be a "My Activity" page visible to every
 * signed-in parent/teacher. Per product decision, raw clickstream data is
 * private to admin/research accounts only — see /admin, which is properly
 * gated server-side (has_role check + RLS), not just link-hidden.
 *
 * This route is kept only so old links/bookmarks don't 404; it just forwards
 * to the real admin console, which will show its own "restricted" message
 * to anyone without the admin role.
 */
export const Route = createFileRoute("/_authenticated/activity")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});

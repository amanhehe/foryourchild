import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads from local storage (instant) instead of a network
    // round-trip on every protected navigation — keeps page changes snappy.
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      const guest =
        typeof window !== "undefined" && window.localStorage.getItem("buddy_guest") === "1";
      if (guest) return { user: null };
      throw redirect({ to: "/auth" });
    }
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});

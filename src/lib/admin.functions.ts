import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminEvent = {
  id: string;
  occurred_at: string;
  session_id: string;
  user_id: string | null;
  child_id: string | null;
  event_context: string;
  component: string;
  event_name: string;
  description: string;
  origin: string;
  target: string | null;
  action: string | null;
  route: string | null;
  meta: Record<string, string | number | boolean | null>;
};

/**
 * Private research feed: only accounts with the `admin` role can read the
 * full clickstream of every learner. Everyone else gets a hard 403.
 */
export const listAllEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw roleErr;
    if (!isAdmin) throw new Error("Forbidden: admin access only");

    const { data, error } = await context.supabase
      .from("learning_events")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    const { data: quizzes } = await context.supabase
      .from("quiz_attempts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);

    return {
      events: (data ?? []) as unknown as AdminEvent[],
      quizAttempts: quizzes ?? [],
    };
  });

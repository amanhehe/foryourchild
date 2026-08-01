import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_child_progress",
  title: "Get child progress",
  description:
    "Get one child's full reading progress: level, XP, coins, streak, literacy score and recent quiz attempts.",
  inputSchema: { child_id: z.string().uuid().describe("The child's id from list_children.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ child_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data: child, error } = await supabase
      .from("children")
      .select("id, name, age, reading_level, level, xp, coins, streak, literacy_score, pet_type, pet_level")
      .eq("id", child_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!child) return { content: [{ type: "text", text: "Child not found" }], isError: true };

    const { data: quizzes } = await supabase
      .from("quiz_attempts")
      .select("quiz_id, score, total, duration_ms, created_at")
      .eq("child_id", child_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const payload = { child, recentQuizAttempts: quizzes ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_activity",
  title: "List learning activity",
  description:
    "List recent clickstream learning events (page views, clicks, quiz and practice events) for the signed-in account, newest first.",
  inputSchema: {
    child_id: z.string().uuid().nullable().describe("Optional child id to filter by; null for all."),
    limit: z.number().int().nullable().describe("How many events to return (default 50, max 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ child_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const take = Math.min(Math.max(limit ?? 50, 1), 200);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("learning_events")
      .select("occurred_at, event_context, component, event_name, description, target, action, route, child_id")
      .order("occurred_at", { ascending: false })
      .limit(take);
    if (child_id) query = query.eq("child_id", child_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { events: data ?? [] },
    };
  },
});

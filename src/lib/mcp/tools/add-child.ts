import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_child",
  title: "Add a child profile",
  description: "Create a new child profile on the signed-in parent's account.",
  inputSchema: {
    name: z.string().trim().min(1).describe("The child's first name."),
    age: z.number().int().nullable().describe("The child's age in years, or null."),
    reading_level: z
      .string()
      .nullable()
      .describe("Reading level such as 'beginner', 'early reader' or 'confident'. Null for default."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, age, reading_level }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("children")
      .insert({
        parent_id: ctx.getUserId(),
        name,
        ...(age === null ? {} : { age }),
        ...(reading_level === null ? {} : { reading_level }),
      })
      .select("id, name, age, reading_level, level, xp")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { child: data },
    };
  },
});

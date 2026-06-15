import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText } from "ai";

const MODEL = "google/gemini-3-flash-preview";

function provider() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

function parseJson(text: string): any {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Generate a short decodable story personalised to the child.
export const generateStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ childId: z.string().uuid(), theme: z.string().max(60).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: child, error } = await context.supabase
      .from("children")
      .select("name, age, reading_level")
      .eq("id", data.childId)
      .single();
    if (error || !child) throw new Error("Child not found");

    const gateway = provider();
    const { text } = await generateText({
      model: gateway(MODEL),
      prompt: `Write a tiny phonics story for ${child.name}, age ${child.age ?? 5}, reading level "${child.reading_level}".
${data.theme ? `Theme the child chose: "${data.theme}".` : ""}
Make ${child.name} the hero. Use simple, decodable words appropriate for the level. 5-7 short sentences.
Respond with ONLY valid JSON in exactly this shape (no markdown, no extra text):
{"title":"Sam and the Cat","emoji":"🐱","paragraphs":["Sentence one.","Sentence two."]}
Provide 5 to 7 sentences across the paragraphs array.`,
    });
    const out = parseJson(text);
    return {
      title: String(out.title ?? "A Little Story"),
      emoji: String(out.emoji ?? "📖"),
      paragraphs: (out.paragraphs ?? []).map((p: any) => String(p)),
    };
  });

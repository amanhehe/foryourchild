import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normalize(word: string) {
  return word.trim().toLowerCase();
}

async function generateIllustration(word: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [
        {
          role: "user",
          content: `A cute, friendly, colorful cartoon illustration of "${word}" for a young child learning to read. Simple flat style, bold outlines, plain soft pastel background, single clear subject centered, no text or letters.`,
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Image generation failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned");
  return `data:image/png;base64,${b64}`;
}

// Return a cached or freshly generated illustration for a word.
export const getWordImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ word: z.string().min(1).max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const word = normalize(data.word);

    const { data: cached } = await context.supabase
      .from("word_images")
      .select("image_data")
      .eq("word", word)
      .maybeSingle();

    if (cached?.image_data) {
      return { dataUrl: cached.image_data as string };
    }

    const dataUrl = await generateIllustration(word);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("word_images")
        .upsert({ word, image_data: dataUrl }, { onConflict: "word" });
    } catch {
      /* caching is best-effort */
    }

    return { dataUrl };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText, Output } from "ai";

const MODEL = "google/gemini-3-flash-preview";

function provider() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

// Generate an adaptive list of practice words for a child.
export const getLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ childId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: child, error } = await context.supabase
      .from("children")
      .select("id, name, age, reading_level")
      .eq("id", data.childId)
      .single();
    if (error || !child) throw new Error("Child not found");

    const gateway = provider();
    const { output } = await generateText({
      model: gateway(MODEL),
      output: Output.object({
        schema: z.object({
          focusSound: z.string(),
          words: z
            .array(
              z.object({
                word: z.string(),
                phonemes: z.string(),
                hint: z.string(),
              }),
            )
            .min(5)
            .max(5),
        }),
      }),
      prompt: `You are a phonics tutor for ${child.name}, age ${child.age ?? 5}, reading level "${child.reading_level}".
Create a short practice set of exactly 5 simple, age-appropriate words that all share one focus phoneme/sound.
For each word give: the word (lowercase), its phonemes split with hyphens (e.g. "c-a-t"), and a one-line kid-friendly hint.
Pick a focusSound like "short a", "sh digraph", etc. Keep words decodable for this level.`,
    });
    return { focusSound: output.focusSound, words: output.words, childName: child.name };
  });

// Score a child's spoken attempt against the target word.
export const scorePronunciation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        childId: z.string().uuid(),
        targetWord: z.string().min(1),
        heard: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const gateway = provider();
    const { output } = await generateText({
      model: gateway(MODEL),
      output: Output.object({
        schema: z.object({
          correct: z.boolean(),
          score: z.number().min(0).max(100),
          feedback: z.string(),
        }),
      }),
      prompt: `A young child was asked to say the word "${data.targetWord}".
A speech recogniser transcribed what they said as: "${data.heard || "(nothing clear)"}".
Decide if they pronounced it correctly (allow for recogniser noise and close matches).
Give a score 0-100 and a single short, warm, encouraging sentence of feedback a 5-year-old would love.
If wrong, gently model the correct sounds.`,
    });
    return output;
  });

// Persist XP/coins earned in a session.
export const awardProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        childId: z.string().uuid(),
        xp: z.number().int().min(0).max(1000),
        coins: z.number().int().min(0).max(1000),
        correct: z.number().int().min(0),
        total: z.number().int().min(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: child, error } = await context.supabase
      .from("children")
      .select("xp, coins, level, literacy_score")
      .eq("id", data.childId)
      .single();
    if (error || !child) throw new Error("Child not found");

    const newXp = (child.xp ?? 0) + data.xp;
    const newLevel = Math.max(1, Math.floor(newXp / 100) + 1);
    const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    const newScore = Math.round(((child.literacy_score ?? 0) * 3 + accuracy) / 4);

    const { error: upErr } = await context.supabase
      .from("children")
      .update({
        xp: newXp,
        coins: (child.coins ?? 0) + data.coins,
        level: newLevel,
        literacy_score: newScore,
      })
      .eq("id", data.childId);
    if (upErr) throw upErr;
    return { xp: newXp, level: newLevel, literacyScore: newScore };
  });

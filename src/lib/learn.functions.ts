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

const optionalSpeechWords = new Set(["a", "an", "the", "um", "uh", "please"]);

function speechTokens(text: string, keepArticles = false) {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return keepArticles ? tokens : tokens.filter((token) => !optionalSpeechWords.has(token));
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[a.length][b.length];
}

function closeToken(a: string, b: string) {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && levenshtein(a, b) <= 1) return true;
  return false;
}

function locallyCorrect(target: string, heard: string) {
  const isSentence = /\s/.test(target.trim());
  const targetWords = speechTokens(target, !isSentence);
  const heardWords = speechTokens(heard, !isSentence);
  if (!targetWords.length || !heardWords.length) return false;

  if (!isSentence) {
    const targetWord = targetWords[targetWords.length - 1];
    return heardWords.some((word) => closeToken(targetWord, word));
  }

  const targetPhrase = targetWords.join(" ");
  const heardPhrase = heardWords.join(" ");
  if (targetPhrase === heardPhrase || heardPhrase.includes(targetPhrase)) return true;

  let heardIndex = 0;
  let matches = 0;
  for (const targetWord of targetWords) {
    while (heardIndex < heardWords.length) {
      if (closeToken(targetWord, heardWords[heardIndex])) {
        matches += 1;
        heardIndex += 1;
        break;
      }
      heardIndex += 1;
    }
  }

  return matches === targetWords.length;
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
    const { text } = await generateText({
      model: gateway(MODEL),
      prompt: `You are a phonics tutor for ${child.name}, age ${child.age ?? 5}, reading level "${child.reading_level}".
Create a short practice set of exactly 5 simple, age-appropriate words that all share one focus phoneme/sound.
Pick a focusSound like "short a", "sh digraph", etc. Keep words decodable for this level.
Also write exactly 3 very short, decodable sentences (3-6 words each) that a beginner can read aloud. Each sentence should use at least one of the practice words. End each sentence with proper punctuation.
Respond with ONLY valid JSON in exactly this shape (no markdown, no extra text):
{"focusSound":"short a","words":[{"word":"cat","phonemes":"c-a-t","hint":"a furry pet"}],"sentences":["The cat sat on a mat.","A fat cat ran fast."]}
The "words" array must contain exactly 5 items. Each word lowercase, phonemes split with hyphens, hint one short kid-friendly line. The "sentences" array must contain exactly 3 items.`,
    });
    const out = parseJson(text);
    return {
      focusSound: String(out.focusSound ?? "phonics"),
      words: (out.words ?? []).slice(0, 5).map((w: any) => ({
        word: String(w.word ?? ""),
        phonemes: String(w.phonemes ?? ""),
        hint: String(w.hint ?? ""),
      })),
      sentences: (out.sentences ?? [])
        .slice(0, 3)
        .map((s: any) => String(s ?? ""))
        .filter((s: string) => s.length > 0),
      childName: child.name,
    };
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
    if (locallyCorrect(data.targetWord, data.heard)) {
      return {
        correct: true,
        score: 95,
        feedback: "Awesome — you said it perfectly!",
      };
    }

    const gateway = provider();
    const { text } = await generateText({
      model: gateway(MODEL),
      prompt: `A young child was asked to say the word or short sentence "${data.targetWord}".
A speech recogniser transcribed what they said as: "${data.heard || "(nothing clear)"}".
Decide if they pronounced it correctly. Be forgiving of recogniser noise, missing starter words like "a" or "the", and close matches where the important phonics words are present in order.
Respond with ONLY valid JSON in exactly this shape (no markdown, no extra text):
{"correct":true,"score":90,"feedback":"Great job!"}
"feedback" is a single short, warm, encouraging sentence a 5-year-old would love. If wrong, gently model the correct sounds.`,
    });
    const out = parseJson(text);
    return {
      correct: Boolean(out.correct),
      score: Number(out.score ?? 0),
      feedback: String(out.feedback ?? "Nice try!"),
    };
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

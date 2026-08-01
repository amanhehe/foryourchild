import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/clickstream";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lessons/$childId")({
  head: () => ({
    meta: [
      { title: "Fun Phonics Lessons & Picture Quizzes — AI Phonics Buddy" },
      {
        name: "description",
        content:
          "Playful phonics lessons for ages 4-8: big pictures, tap-to-hear sounds and simple picture quizzes.",
      },
      { property: "og:title", content: "Fun Phonics Lessons & Picture Quizzes — AI Phonics Buddy" },
      {
        property: "og:description",
        content: "Tap, listen and play: short /a/, sh and magic e made easy for little readers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LessonsPage,
});

type Module = {
  id: string;
  title: string;
  emoji: string;
  say: string;
  video: { src: string; poster?: string; caption: string };
  steps: { emoji: string; line: string; speak: string }[];
  words: { word: string; emoji: string }[];
  quiz: { q: string; options: { label: string; emoji: string }[]; answer: number }[];
};

const MODULES: Module[] = [
  {
    id: "short-a",
    title: "The 'a' sound",
    emoji: "🍎",
    say: "a says ah, like in cat",
    video: {
      src: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      caption: "Watch: the short 'a' sound in cat, hat and bat",
    },
    steps: [
      { emoji: "🅰️", line: "a says “ah”.", speak: "a says ah" },
      { emoji: "🐱", line: "c – a – t makes cat!", speak: "c a t. cat!" },
      { emoji: "🧢", line: "Say them with me: cat, hat, bat.", speak: "cat. hat. bat." },
    ],
    words: [
      { word: "cat", emoji: "🐱" },
      { word: "hat", emoji: "🎩" },
      { word: "bat", emoji: "🦇" },
      { word: "map", emoji: "🗺️" },
    ],
    quiz: [
      {
        q: "Which one says “ah”?",
        options: [
          { label: "cake", emoji: "🎂" },
          { label: "cat", emoji: "🐱" },
        ],
        answer: 1,
      },
      {
        q: "h – a – t makes…",
        options: [
          { label: "hat", emoji: "🎩" },
          { label: "hot", emoji: "🔥" },
        ],
        answer: 0,
      },
      {
        q: "Tap the “ah” word",
        options: [
          { label: "rain", emoji: "🌧️" },
          { label: "bat", emoji: "🦇" },
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "digraph-sh",
    title: "The 'sh' sound",
    emoji: "🤫",
    say: "sh says shhh, like a quiet sound",
    video: {
      src: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
      caption: "Watch: the 'sh' sound in ship, shell and fish",
    },
    steps: [
      { emoji: "🤫", line: "s and h say “shhh”.", speak: "s h says shhh" },
      { emoji: "🚢", line: "Shhh… ship!", speak: "sh ip. ship!" },
      { emoji: "🐟", line: "Fish ends with shhh.", speak: "fi sh. fish!" },
    ],
    words: [
      { word: "ship", emoji: "🚢" },
      { word: "shell", emoji: "🐚" },
      { word: "fish", emoji: "🐟" },
      { word: "brush", emoji: "🪥" },
    ],
    quiz: [
      {
        q: "Which one starts with “shhh”?",
        options: [
          { label: "sun", emoji: "☀️" },
          { label: "ship", emoji: "🚢" },
        ],
        answer: 1,
      },
      {
        q: "Which one ends with “shhh”?",
        options: [
          { label: "fish", emoji: "🐟" },
          { label: "fan", emoji: "🌀" },
        ],
        answer: 0,
      },
      {
        q: "Tap the “shhh” word",
        options: [
          { label: "shell", emoji: "🐚" },
          { label: "bell", emoji: "🔔" },
        ],
        answer: 0,
      },
    ],
  },
  {
    id: "magic-e",
    title: "Magic e",
    emoji: "✨",
    say: "magic e makes the vowel say its name",
    video: {
      src: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
      caption: "Watch: how magic e turns kit into kite",
    },
    steps: [
      { emoji: "✨", line: "A quiet e at the end is magic.", speak: "a quiet e at the end is magic" },
      { emoji: "🪁", line: "kit → kite. The i says its name!", speak: "kit. kite!" },
      { emoji: "🧢", line: "cap → cape. Magic!", speak: "cap. cape!" },
    ],
    words: [
      { word: "kite", emoji: "🪁" },
      { word: "cape", emoji: "🦸" },
      { word: "bike", emoji: "🚲" },
      { word: "cake", emoji: "🎂" },
    ],
    quiz: [
      {
        q: "cap + magic e = ?",
        options: [
          { label: "cape", emoji: "🦸" },
          { label: "cup", emoji: "🥤" },
        ],
        answer: 0,
      },
      {
        q: "Which one has magic e?",
        options: [
          { label: "kit", emoji: "🧰" },
          { label: "kite", emoji: "🪁" },
        ],
        answer: 1,
      },
      {
        q: "Tap the magic e word",
        options: [
          { label: "cake", emoji: "🎂" },
          { label: "cat", emoji: "🐱" },
        ],
        answer: 0,
      },
    ],
  },
];

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.8;
  u.pitch = 1.2;
  window.speechSynthesis.speak(u);
}

function LessonsPage() {
  const { childId } = Route.useParams();
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const startedAt = useRef<number>(Date.now());

  const module = MODULES[active]!;
  const context = `Course: Phonics Buddy — ${module.title}`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const seenMilestones = useRef<Set<number>>(new Set());
  const lastRate = useRef<number>(1);

  useEffect(() => {
    track({
      context,
      component: "System",
      event: "Course module viewed",
      target: module.id,
      childId,
      meta: { module: module.id },
    });
    setAnswers([]);
    setSubmitted(false);
    startedAt.current = Date.now();
    seenMilestones.current = new Set();
    lastRate.current = 1;
  }, [active, childId, context, module.id]);

  function videoPosition() {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return { position: 0, percent: 0 };
    return { position: v.currentTime, percent: Math.round((v.currentTime / v.duration) * 100) };
  }

  function onVideoPlay() {
    track({
      context,
      component: "Video",
      event: "Video played",
      target: module.id,
      action: "play",
      childId,
      meta: videoPosition(),
    });
  }

  function onVideoPause() {
    const v = videoRef.current;
    if (v && v.ended) return; // "completed" event covers this
    track({
      context,
      component: "Video",
      event: "Video paused",
      target: module.id,
      action: "pause",
      childId,
      meta: videoPosition(),
    });
  }

  function onVideoSeeked() {
    track({
      context,
      component: "Video",
      event: "Video seeked",
      target: module.id,
      action: "seek",
      childId,
      meta: videoPosition(),
    });
  }

  function onVideoRateChange() {
    const v = videoRef.current;
    if (!v || v.playbackRate === lastRate.current) return;
    lastRate.current = v.playbackRate;
    track({
      context,
      component: "Video",
      event: "Video speed changed",
      target: module.id,
      action: "rate-change",
      childId,
      meta: { ...videoPosition(), playbackRate: v.playbackRate },
    });
  }

  function onVideoTimeUpdate() {
    const { percent, position } = videoPosition();
    for (const milestone of [25, 50, 75]) {
      if (percent >= milestone && !seenMilestones.current.has(milestone)) {
        seenMilestones.current.add(milestone);
        track({
          context,
          component: "Video",
          event: `Video ${milestone}% reached`,
          target: module.id,
          action: "progress",
          childId,
          meta: { position, percent: milestone },
        });
      }
    }
  }

  function onVideoEnded() {
    track({
      context,
      component: "Video",
      event: "Video completed",
      target: module.id,
      action: "complete",
      childId,
      meta: videoPosition(),
    });
  }

  function sayIt(text: string, target: string, event = "Audio played") {
    speak(text);
    track({ context, component: "Audio", event, target, action: "listen", childId });
  }

  function choose(qIndex: number, optIndex: number) {
    if (submitted) return;
    const next = [...answers];
    next[qIndex] = optIndex;
    setAnswers(next);
    speak(module.quiz[qIndex]!.options[optIndex]!.label);
    track({
      context,
      component: "Quiz",
      event: "Quiz answer selected",
      target: `${module.id}-q${qIndex + 1}`,
      action: "answer",
      childId,
      meta: {
        question: module.quiz[qIndex]!.q,
        choice: module.quiz[qIndex]!.options[optIndex]!.label,
      },
    });
  }

  async function submit() {
    const score = module.quiz.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0);
    const duration = Date.now() - startedAt.current;
    const perQuestion = module.quiz.map((q, i) => ({
      question: q.q,
      chosen: answers[i] !== undefined ? q.options[answers[i]!]!.label : null,
      correct: answers[i] === q.answer,
    }));
    setSubmitted(true);

    await track({
      context,
      component: "Quiz",
      event: "Quiz attempt submitted",
      target: module.id,
      action: "submit",
      childId,
      meta: { score, total: module.quiz.length, duration_ms: duration, answers: perQuestion },
    });

    // Also record a row in quiz_attempts so teacher/admin progress views
    // (which read this table, not the clickstream) actually see results.
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (user && childId && !childId.startsWith("guest-")) {
        await supabase.from("quiz_attempts").insert({
          user_id: user.id,
          child_id: childId,
          quiz_id: module.id,
          score,
          total: module.quiz.length,
          duration_ms: duration,
          answers: perQuestion,
        });
      }
    } catch {
      /* quiz_attempts logging must never block the UI */
    }

    speak(score === module.quiz.length ? "Wow! All correct!" : "Good try! Let's play again.");
    toast.success(`You got ${score} / ${module.quiz.length}! 🎉`);
  }

  const score = module.quiz.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0);

  return (
    <div className="min-h-screen bg-gradient-hero pb-16">
      <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-primary-foreground">
        <Link to="/dashboard" className="font-bold underline-offset-4 hover:underline">
          ← Dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-5">
        <div className="mb-5 flex flex-wrap gap-2">
          {MODULES.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setActive(i);
                track({
                  context: `Course: Phonics Buddy — ${m.title}`,
                  component: "Navigation",
                  event: "Module selected",
                  target: m.id,
                  childId,
                });
              }}
              className={`rounded-full px-5 py-3 text-lg font-bold transition-transform hover:scale-105 ${
                i === active
                  ? "bg-card text-foreground shadow-pop"
                  : "bg-card/25 text-primary-foreground backdrop-blur"
              }`}
            >
              {m.emoji} {m.title}
            </button>
          ))}
        </div>

        <section className="rounded-[2rem] bg-card p-6 shadow-pop md:p-8">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-6xl">{module.emoji}</span>
            <h1 className="text-4xl font-bold">{module.title}</h1>
            <button
              type="button"
              onClick={() => sayIt(module.say, module.id, "Lesson audio played")}
              className="rounded-full bg-primary px-6 py-3 text-lg font-bold text-primary-foreground shadow-pop transition-transform hover:scale-105"
            >
              🔊 Listen
            </button>
          </div>

          {/* TEACHING VIDEO */}
          <div className="mt-6">
            <video
              key={module.id}
              ref={videoRef}
              src={module.video.src}
              poster={module.video.poster}
              controls
              playsInline
              className="w-full rounded-2xl bg-black shadow-pop"
              onPlay={onVideoPlay}
              onPause={onVideoPause}
              onSeeked={onVideoSeeked}
              onRateChange={onVideoRateChange}
              onTimeUpdate={onVideoTimeUpdate}
              onEnded={onVideoEnded}
            />
            <p className="mt-2 text-center text-lg font-bold text-muted-foreground">
              {module.video.caption}
            </p>
          </div>

          {/* SIMPLE STEPS */}
          <div className="mt-6 space-y-3">
            {module.steps.map((s) => (
              <button
                key={s.line}
                type="button"
                onClick={() => sayIt(s.speak, s.line)}
                className="flex w-full items-center gap-4 rounded-2xl bg-secondary/50 p-4 text-left transition-transform hover:scale-[1.01]"
              >
                <span className="text-4xl">{s.emoji}</span>
                <span className="text-2xl font-bold leading-snug">{s.line}</span>
                <span className="ml-auto text-2xl">🔊</span>
              </button>
            ))}
          </div>

          {/* PICTURE WORDS */}
          <h2 className="mt-8 text-2xl font-bold">👀 Tap a picture to hear it</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {module.words.map((w) => (
              <button
                key={w.word}
                type="button"
                onClick={() => sayIt(w.word, w.word, "Word audio played")}
                className="rounded-3xl border-4 border-border bg-card p-5 text-center transition-transform hover:scale-105"
              >
                <div className="text-6xl">{w.emoji}</div>
                <div className="mt-2 text-2xl font-bold">{w.word}</div>
              </button>
            ))}
          </div>

          {/* PICTURE QUIZ */}
          <h2 className="mt-8 text-2xl font-bold">🎯 Let&apos;s play!</h2>
          <div className="mt-3 space-y-5">
            {module.quiz.map((q, qi) => (
              <div key={q.q} className="rounded-3xl border-4 border-border p-4">
                <p className="flex items-center gap-3 text-2xl font-bold">
                  {q.q}
                  <button
                    type="button"
                    onClick={() => sayIt(q.q, q.q, "Question audio played")}
                    className="rounded-full bg-secondary px-3 py-1 text-lg"
                    aria-label="Hear the question"
                  >
                    🔊
                  </button>
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {q.options.map((opt, oi) => {
                    const chosen = answers[qi] === oi;
                    const state = submitted
                      ? oi === q.answer
                        ? "border-primary bg-primary/15"
                        : chosen
                          ? "border-destructive bg-destructive/10"
                          : "border-border"
                      : chosen
                        ? "border-primary bg-primary/10"
                        : "border-border";
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => choose(qi, oi)}
                        className={`min-w-[8rem] rounded-3xl border-4 px-6 py-4 text-center transition-transform hover:scale-105 ${state}`}
                      >
                        <span className="block text-5xl">{opt.emoji}</span>
                        <span className="mt-1 block text-xl font-bold">{opt.label}</span>
                        {submitted && oi === q.answer && <span className="text-2xl">✅</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {submitted ? (
            <div className="mt-6 rounded-3xl bg-secondary/60 p-5 text-center">
              <p className="text-3xl font-bold">
                {score} / {module.quiz.length} {score === module.quiz.length ? "🌟🌟🌟" : "💪"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAnswers([]);
                  setSubmitted(false);
                  startedAt.current = Date.now();
                  track({ context, component: "Quiz", event: "Quiz retried", target: module.id, childId });
                }}
                className="mt-4 rounded-full bg-gradient-warm px-8 py-4 text-xl font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
              >
                🔁 Play again
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={answers.filter((a) => a !== undefined).length < module.quiz.length}
              className="mt-6 w-full rounded-full bg-primary px-10 py-5 text-2xl font-bold text-primary-foreground shadow-pop transition-transform hover:scale-105 disabled:opacity-60"
            >
              ✅ Check my answers
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

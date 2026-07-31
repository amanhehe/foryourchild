import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/clickstream";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lessons/$childId")({
  component: LessonsPage,
});

type Module = {
  id: string;
  title: string;
  emoji: string;
  text: string[];
  video: { title: string; src: string; poster?: string };
  quiz: { q: string; options: string[]; answer: number }[];
};

const MODULES: Module[] = [
  {
    id: "short-a",
    title: "The short /a/ sound",
    emoji: "🅰️",
    text: [
      "The letter a can make a short sound: /a/ — like the a in cat.",
      "Blend it slowly: c – a – t → cat. Try mat, hat, bat and map.",
      "When you see a single a between two consonants, it is usually the short /a/ sound.",
    ],
    video: {
      title: "Watch: blending short /a/ words",
      src: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      poster: "",
    },
    quiz: [
      { q: "Which word has the short /a/ sound?", options: ["cake", "cat", "cot"], answer: 1 },
      { q: "Blend it: h – a – t makes…", options: ["hot", "hit", "hat"], answer: 2 },
      { q: "Which one is NOT a short /a/ word?", options: ["map", "rain", "bat"], answer: 1 },
    ],
  },
  {
    id: "digraph-sh",
    title: "The digraph 'sh'",
    emoji: "🤫",
    text: [
      "Two letters, one sound: s + h = /sh/, the quiet sound.",
      "You hear it in ship, shell, fish and brush.",
      "The /sh/ sound can come at the start or the end of a word.",
    ],
    video: {
      title: "Watch: finding /sh/ in words",
      src: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    },
    quiz: [
      { q: "Which word starts with /sh/?", options: ["sun", "ship", "chip"], answer: 1 },
      { q: "Which word ends with /sh/?", options: ["fish", "fin", "fit"], answer: 0 },
      { q: "How many sounds are in 'shop'?", options: ["2", "3", "4"], answer: 1 },
    ],
  },
  {
    id: "magic-e",
    title: "Magic e",
    emoji: "✨",
    text: [
      "A silent e at the end of a word makes the vowel say its own name.",
      "cap → cape, kit → kite, hop → hope, tub → tube.",
      "The e is silent — it just does the magic!",
    ],
    video: {
      title: "Watch: magic e in action",
      src: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    },
    quiz: [
      { q: "cap + magic e = ?", options: ["cop", "cape", "cup"], answer: 1 },
      { q: "Which word has a magic e?", options: ["kite", "kit", "kick"], answer: 0 },
      { q: "In 'hope', the e is…", options: ["loud", "silent", "a vowel sound"], answer: 1 },
    ],
  },
];

function LessonsPage() {
  const { childId } = Route.useParams();
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startedAt = useRef<number>(Date.now());
  const lastQuarter = useRef(0);

  const module = MODULES[active]!;
  const context = `Course: Phonics Buddy — ${module.title}`;

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
    lastQuarter.current = 0;
    startedAt.current = Date.now();
  }, [active, childId, context, module.id]);

  const videoEvent = useCallback(
    (event: string, meta: Record<string, unknown> = {}) => {
      const v = videoRef.current;
      track({
        context,
        component: "Video",
        event,
        target: module.video.title,
        action: "video",
        childId,
        meta: { ...meta, position: v ? Math.round(v.currentTime) : 0, module: module.id },
      });
    },
    [childId, context, module.id, module.video.title],
  );

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const quarter = Math.floor((v.currentTime / v.duration) * 4);
    if (quarter > lastQuarter.current && quarter < 4) {
      lastQuarter.current = quarter;
      videoEvent("Video progress", { percent: quarter * 25 });
    }
  }

  function choose(qIndex: number, optIndex: number) {
    if (submitted) return;
    const next = [...answers];
    next[qIndex] = optIndex;
    setAnswers(next);
    track({
      context,
      component: "Quiz",
      event: "Quiz answer selected",
      target: `${module.id}-q${qIndex + 1}`,
      action: "answer",
      childId,
      meta: { question: module.quiz[qIndex]!.q, choice: module.quiz[qIndex]!.options[optIndex] },
    });
  }

  async function submit() {
    const score = module.quiz.reduce(
      (acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0),
      0,
    );
    const duration = Date.now() - startedAt.current;
    setSubmitted(true);
    await track({
      context,
      component: "Quiz",
      event: "Quiz attempt submitted",
      target: module.id,
      action: "submit",
      childId,
      meta: {
        score,
        total: module.quiz.length,
        duration_ms: duration,
        answers: module.quiz.map((q, i) => ({
          question: q.q,
          chosen: answers[i] !== undefined ? q.options[answers[i]!] : null,
          correct: answers[i] === q.answer,
        })),
      },
    });
    toast.success(`You scored ${score} / ${module.quiz.length}! 🎉`);
  }

  const score = module.quiz.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0);

  return (
    <div className="min-h-screen bg-gradient-hero pb-16">
      <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-primary-foreground">
        <Link to="/dashboard" className="font-bold underline-offset-4 hover:underline">
          ← Dashboard
        </Link>
        <Link
          to="/activity"
          onClick={() =>
            track({ context, component: "Navigation", event: "Link clicked", target: "Activity", childId })
          }
          className="rounded-full bg-card/20 px-4 py-1 font-bold backdrop-blur"
        >
          📊 My activity
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
              className={`rounded-full px-4 py-2 text-sm font-bold transition-transform hover:scale-105 ${
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
          <h1 className="text-3xl font-bold">
            {module.emoji} {module.title}
          </h1>

          {/* TEXT */}
          <div className="mt-4 space-y-2">
            {module.text.map((line) => (
              <p key={line} className="text-lg leading-relaxed text-muted-foreground">
                {line}
              </p>
            ))}
          </div>

          {/* VIDEO */}
          <h2 className="mt-8 text-xl font-bold">🎬 {module.video.title}</h2>
          <video
            ref={videoRef}
            src={module.video.src}
            controls
            playsInline
            preload="metadata"
            className="mt-3 w-full rounded-2xl bg-black"
            onPlay={() => videoEvent("Video played")}
            onPause={() => videoEvent("Video paused")}
            onSeeked={() => videoEvent("Video seeked")}
            onEnded={() => videoEvent("Video completed", { percent: 100 })}
            onRateChange={() => videoEvent("Video speed changed", { rate: videoRef.current?.playbackRate })}
            onTimeUpdate={onTimeUpdate}
          />

          {/* QUIZ */}
          <h2 className="mt-8 text-xl font-bold">📝 Quick quiz</h2>
          <div className="mt-3 space-y-5">
            {module.quiz.map((q, qi) => (
              <div key={q.q} className="rounded-2xl border-2 border-border p-4">
                <p className="font-bold">
                  {qi + 1}. {q.q}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
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
                        key={opt}
                        type="button"
                        onClick={() => choose(qi, oi)}
                        className={`rounded-full border-2 px-5 py-2 font-bold transition-transform hover:scale-105 ${state}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {submitted ? (
            <div className="mt-6 rounded-2xl bg-secondary/60 p-5 text-center">
              <p className="text-2xl font-bold">
                {score} / {module.quiz.length} correct {score === module.quiz.length ? "🌟" : "💪"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAnswers([]);
                  setSubmitted(false);
                  startedAt.current = Date.now();
                  track({ context, component: "Quiz", event: "Quiz retried", target: module.id, childId });
                }}
                className="mt-4 rounded-full bg-gradient-warm px-8 py-3 font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
              >
                Try again
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={answers.filter((a) => a !== undefined).length < module.quiz.length}
              className="mt-6 rounded-full bg-primary px-10 py-4 text-lg font-bold text-primary-foreground shadow-pop transition-transform hover:scale-105 disabled:opacity-60"
            >
              Submit answers
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

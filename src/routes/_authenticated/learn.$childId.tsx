import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLesson, scorePronunciation, awardProgress } from "@/lib/learn.functions";
import { toast } from "sonner";
import buddyOwl from "@/assets/buddy-owl.png";

export const Route = createFileRoute("/_authenticated/learn/$childId")({
  component: LearnPage,
});

type Word = { word: string; phonemes: string; hint: string };
type Phase = "loading" | "ready" | "listening" | "checking" | "result" | "done";

function speak(text: string, rate = 0.85) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.pitch = 1.15;
  window.speechSynthesis.speak(u);
}

function getRecognition(): any {
  if (typeof window === "undefined") return null;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = "en-US";
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

function LearnPage() {
  const { childId } = Route.useParams();
  const navigate = useNavigate();
  const fetchLesson = useServerFn(getLesson);
  const score = useServerFn(scorePronunciation);
  const award = useServerFn(awardProgress);

  const [phase, setPhase] = useState<Phase>("loading");
  const [focusSound, setFocusSound] = useState("");
  const [childName, setChildName] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [lastCorrect, setLastCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [coins, setCoins] = useState(0);
  const recRef = useRef<any>(null);
  const speechSupported = typeof window !== "undefined" && !!getRecognition();

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetchLesson({ data: { childId } });
      setFocusSound(res.focusSound);
      setChildName(res.childName);
      setWords(res.words);
      setPhase("ready");
    } catch {
      toast.error("Couldn't start the lesson. Try again!");
    }
  }, [childId, fetchLesson]);

  useEffect(() => {
    load();
  }, [load]);

  const current = words[idx];

  function listen() {
    const rec = getRecognition();
    if (!rec) {
      toast.error("Speech isn't supported in this browser. Try Chrome!");
      return;
    }
    recRef.current = rec;
    setFeedback("");
    setPhase("listening");
    rec.onresult = async (e: any) => {
      const heard = e.results[0]?.[0]?.transcript ?? "";
      await check(heard);
    };
    rec.onerror = () => {
      setPhase("ready");
      toast.error("I didn't catch that — try again!");
    };
    rec.onend = () => {
      setPhase((p) => (p === "listening" ? "ready" : p));
    };
    rec.start();
  }

  async function check(heard: string) {
    setPhase("checking");
    try {
      const r = await score({ data: { childId, targetWord: current.word, heard } });
      setLastCorrect(r.correct);
      setFeedback(r.feedback);
      if (r.correct) {
        setCorrectCount((c) => c + 1);
        setCoins((c) => c + 5);
      }
      speak(r.feedback);
      setPhase("result");
    } catch {
      setPhase("ready");
      toast.error("Buddy got confused — try again!");
    }
  }

  async function next() {
    if (idx + 1 >= words.length) {
      const xp = correctCount * 20 + words.length * 5;
      try {
        await award({
          data: { childId, xp, coins, correct: correctCount, total: words.length },
        });
      } catch { /* non-blocking */ }
      setPhase("done");
      speak(`Amazing work ${childName}! You earned ${coins} coins!`);
      return;
    }
    setIdx((i) => i + 1);
    setFeedback("");
    setPhase("ready");
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 text-primary-foreground">
        <Link to="/dashboard" className="font-bold underline-offset-4 hover:underline">← Exit</Link>
        <span className="rounded-full bg-card/20 px-4 py-1 font-bold backdrop-blur">🪙 {coins}</span>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-16">
        <div className="rounded-[2rem] bg-card p-8 text-center shadow-pop">
          {phase === "loading" && (
            <div className="py-16">
              <img src={buddyOwl} alt="Buddy" className="mx-auto h-24 w-24 animate-wiggle" />
              <p className="mt-4 font-bold">Buddy is picking your words…</p>
            </div>
          )}

          {phase !== "loading" && phase !== "done" && current && (
            <>
              <span className="inline-block rounded-full bg-secondary px-4 py-1 text-sm font-bold text-secondary-foreground">
                Today's sound: {focusSound}
              </span>
              <p className="mt-4 text-sm text-muted-foreground">
                Word {idx + 1} of {words.length}
              </p>

              <button
                onClick={() => speak(current.word, 0.7)}
                className="mx-auto mt-4 block text-6xl font-bold tracking-wide text-primary transition-transform hover:scale-105 md:text-7xl"
                title="Tap to hear"
              >
                {current.word}
              </button>
              <p className="mt-2 text-2xl text-muted-foreground">{current.phonemes}</p>
              <p className="mt-2 text-sm text-muted-foreground">💡 {current.hint}</p>

              <button
                onClick={() => speak(current.word, 0.6)}
                className="mt-5 rounded-full border-2 border-border px-5 py-2 font-bold transition-transform hover:scale-105"
              >
                🔊 Hear it
              </button>

              <div className="mt-8">
                {phase === "result" ? (
                  <div className="animate-pop-in">
                    <div className={`text-5xl ${lastCorrect ? "" : "opacity-90"}`}>
                      {lastCorrect ? "🌟" : "💪"}
                    </div>
                    <p className="mt-2 text-lg font-bold">{feedback}</p>
                    <button
                      onClick={next}
                      className="mt-5 rounded-full bg-gradient-warm px-8 py-3 text-lg font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
                    >
                      {idx + 1 >= words.length ? "Finish 🎉" : "Next word →"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={listen}
                    disabled={phase === "listening" || phase === "checking"}
                    className="rounded-full bg-primary px-10 py-5 text-xl font-bold text-primary-foreground shadow-pop transition-transform hover:scale-105 disabled:opacity-70"
                  >
                    {phase === "listening" ? "🎤 Listening…" : phase === "checking" ? "Thinking…" : "🎤 Say the word"}
                  </button>
                )}
                {!speechSupported && (
                  <p className="mt-4 text-sm text-destructive">
                    Voice needs Chrome or Safari to work. You can still hear the words!
                  </p>
                )}
              </div>
            </>
          )}

          {phase === "done" && (
            <div className="animate-pop-in py-10">
              <img src={buddyOwl} alt="Buddy" className="mx-auto h-28 w-28 animate-float" />
              <h2 className="mt-4 text-3xl font-bold">Great job, {childName}! 🎉</h2>
              <p className="mt-2 text-lg text-muted-foreground">
                You got {correctCount} of {words.length} and earned 🪙 {coins} coins!
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={load}
                  className="rounded-full bg-gradient-warm px-8 py-3 font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
                >
                  Play again
                </button>
                <button
                  onClick={() => navigate({ to: "/dashboard" })}
                  className="rounded-full border-2 border-border px-8 py-3 font-bold transition-transform hover:scale-105"
                >
                  Back to dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

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
type Stage = "words" | "reading";
type Phase = "loading" | "ready" | "listening" | "checking" | "result" | "done";

const quickPictures: Record<string, string> = {
  ant: "🐜",
  apple: "🍎",
  ball: "⚽",
  bat: "🦇",
  bee: "🐝",
  bird: "🐦",
  boat: "⛵",
  book: "📚",
  bug: "🐞",
  bus: "🚌",
  cake: "🍰",
  car: "🚗",
  cat: "🐱",
  cow: "🐮",
  cup: "🥤",
  dog: "🐶",
  duck: "🦆",
  egg: "🥚",
  fish: "🐟",
  fox: "🦊",
  frog: "🐸",
  goat: "🐐",
  hat: "🎩",
  hen: "🐔",
  horse: "🐴",
  jam: "🍓",
  kite: "🪁",
  leaf: "🍃",
  lion: "🦁",
  log: "🪵",
  man: "🧍",
  map: "🗺️",
  moon: "🌙",
  mouse: "🐭",
  mug: "☕",
  nest: "🪺",
  pig: "🐷",
  pot: "🫕",
  rain: "🌧️",
  rat: "🐭",
  ring: "💍",
  ship: "🚢",
  shoe: "👟",
  sock: "🧦",
  star: "⭐",
  sun: "☀️",
  tree: "🌳",
  van: "🚐",
  web: "🕸️",
};

function quickPictureFor(word: string) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  return quickPictures[clean] ?? "🌈";
}

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
  const [stage, setStage] = useState<Stage>("words");
  const [focusSound, setFocusSound] = useState("");
  const [childName, setChildName] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [sentences, setSentences] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [sIdx, setSIdx] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [lastCorrect, setLastCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [coins, setCoins] = useState(0);
  const recRef = useRef<any>(null);
  const speechSupported = typeof window !== "undefined" && !!getRecognition();
  const isGuest = childId.startsWith("guest-");

  const guestLesson = useCallback(() => {
    let name = "Friend";
    try {
      const stored = JSON.parse(localStorage.getItem("buddy_guest_children") || "[]");
      const found = stored.find((c: any) => c.id === childId);
      if (found?.name) name = found.name;
    } catch { /* ignore */ }
    return {
      focusSound: "short a",
      childName: name,
      words: [
        { word: "cat", phonemes: "c-a-t", hint: "a furry pet" },
        { word: "hat", phonemes: "h-a-t", hint: "you wear it on your head" },
        { word: "bat", phonemes: "b-a-t", hint: "it flies at night" },
        { word: "map", phonemes: "m-a-p", hint: "shows where to go" },
        { word: "sun", phonemes: "s-u-n", hint: "shines in the sky" },
      ],
      sentences: [
        "The cat sat on a mat.",
        "A fat bat ran fast.",
        "The sun is up high.",
      ],
    };
  }, [childId]);

  const load = useCallback(async () => {
    setPhase("loading");
    setStage("words");
    setIdx(0);
    setSIdx(0);
    setCorrectCount(0);
    setCoins(0);
    setFeedback("");
    try {
      const res = isGuest ? guestLesson() : await fetchLesson({ data: { childId } });
      setFocusSound(res.focusSound);
      setChildName(res.childName);
      setWords(res.words);
      setSentences(res.sentences ?? []);
      setPhase("ready");
    } catch {
      toast.error("Couldn't start the lesson. Try again!");
    }
  }, [childId, fetchLesson, isGuest, guestLesson]);

  useEffect(() => {
    load();
  }, [load]);

  const current = words[idx];
  const currentSentence = sentences[sIdx];

  function listen(target: string) {
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
      await check(target, heard);
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

  async function check(target: string, heard: string) {
    setPhase("checking");
    try {
      let r: { correct: boolean; score: number; feedback: string };
      if (isGuest) {
        const t = target.toLowerCase().replace(/[^a-z ]/g, "").trim();
        const h = heard.toLowerCase().replace(/[^a-z ]/g, "").trim();
        const correct = !!h && (h === t || h.includes(t) || t.includes(h));
        r = {
          correct,
          score: correct ? 95 : 40,
          feedback: correct ? "Awesome — you said it perfectly!" : `Nice try! Listen: ${target}.`,
        };
      } else {
        r = await score({ data: { childId, targetWord: target, heard } });
      }
      setLastCorrect(r.correct);
      setFeedback(r.feedback);
      if (r.correct) {
        setCorrectCount((c) => c + 1);
        setCoins((c) => c + (stage === "reading" ? 10 : 5));
      }
      speak(r.feedback);
      setPhase("result");
    } catch {
      setPhase("ready");
      toast.error("Buddy got confused — try again!");
    }
  }

  async function finish() {
    const totalAsked = words.length + sentences.length;
    const xp = correctCount * 20 + words.length * 5 + sentences.length * 5;
    if (isGuest) {
      try {
        const raw = localStorage.getItem("buddy_guest_children");
        const list = raw ? (JSON.parse(raw) as any[]) : [];
        const i = list.findIndex((c) => c.id === childId);
        if (i >= 0) {
          const prev = list[i];
          const newXp = (prev.xp ?? 0) + xp;
          const newCoins = (prev.coins ?? 0) + coins;
          const newLevel = Math.max(1, Math.floor(newXp / 100) + 1);
          const accuracy = totalAsked > 0 ? Math.round((correctCount / totalAsked) * 100) : 0;
          const prevScore = prev.literacy_score ?? 0;
          const newScore = Math.min(100, Math.round(prevScore * 0.7 + accuracy * 0.3));
          list[i] = {
            ...prev,
            xp: newXp,
            coins: newCoins,
            level: newLevel,
            streak: (prev.streak ?? 0) + 1,
            literacy_score: newScore,
            updated_at: new Date().toISOString(),
          };
          localStorage.setItem("buddy_guest_children", JSON.stringify(list));
        }
      } catch { /* ignore */ }
    } else {
      try {
        await award({
          data: {
            childId,
            xp,
            coins,
            correct: correctCount,
            total: totalAsked,
          },
        });
      } catch {
        /* non-blocking */
      }
    }
    setPhase("done");
    speak(`Amazing work ${childName}! You earned ${coins} coins!`);
  }

  async function next() {
    setFeedback("");
    if (stage === "words") {
      if (idx + 1 >= words.length) {
        if (sentences.length > 0) {
          setStage("reading");
          setSIdx(0);
          setPhase("ready");
          speak("Now let's read some sentences!");
          return;
        }
        await finish();
        return;
      }
      setIdx((i) => i + 1);
      setPhase("ready");
      return;
    }
    // reading stage
    if (sIdx + 1 >= sentences.length) {
      await finish();
      return;
    }
    setSIdx((i) => i + 1);
    setPhase("ready");
  }

  const totalItems = words.length + sentences.length;
  const itemNumber = stage === "words" ? idx + 1 : words.length + sIdx + 1;
  const quickPicture = current ? quickPictureFor(current.word) : "🌈";

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

          {/* WORDS STAGE */}
          {phase !== "loading" && phase !== "done" && stage === "words" && current && (
            <>
              <span className="inline-block rounded-full bg-secondary px-4 py-1 text-sm font-bold text-secondary-foreground">
                Today's sound: {focusSound}
              </span>
              <p className="mt-4 text-sm text-muted-foreground">
                {itemNumber} of {totalItems}
              </p>

              <div className="mx-auto mt-4 flex h-44 w-44 items-center justify-center overflow-hidden rounded-3xl bg-secondary/60 text-7xl animate-pop-in" aria-label={current.word}>
                <span>{quickPicture}</span>
              </div>

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
                    {lastCorrect ? (
                      <button
                        onClick={next}
                        className="mt-5 rounded-full bg-gradient-warm px-8 py-3 text-lg font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
                      >
                        {idx + 1 >= words.length
                          ? sentences.length > 0
                            ? "Reading time →"
                            : "Finish 🎉"
                          : "Next word →"}
                      </button>
                    ) : (
                      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                        <button
                          onClick={() => listen(current.word)}
                          className="rounded-full bg-primary px-8 py-3 text-lg font-bold text-primary-foreground shadow-pop transition-transform hover:scale-105"
                        >
                          🔁 Try again
                        </button>
                        <button
                          onClick={next}
                          className="rounded-full border-2 border-border px-8 py-3 text-lg font-bold transition-transform hover:scale-105"
                        >
                          Skip →
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => listen(current.word)}
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

          {/* READING STAGE */}
          {phase !== "loading" && phase !== "done" && stage === "reading" && currentSentence && (
            <>
              <span className="inline-block rounded-full bg-secondary px-4 py-1 text-sm font-bold text-secondary-foreground">
                📖 Reading time
              </span>
              <p className="mt-4 text-sm text-muted-foreground">
                {itemNumber} of {totalItems}
              </p>

              <p className="mx-auto mt-6 max-w-md text-3xl font-bold leading-snug text-primary md:text-4xl">
                {currentSentence}
              </p>

              <button
                onClick={() => speak(currentSentence, 0.7)}
                className="mt-6 rounded-full border-2 border-border px-5 py-2 font-bold transition-transform hover:scale-105"
              >
                🔊 Buddy reads it
              </button>

              <div className="mt-8">
                {phase === "result" ? (
                  <div className="animate-pop-in">
                    <div className={`text-5xl ${lastCorrect ? "" : "opacity-90"}`}>
                      {lastCorrect ? "🌟" : "💪"}
                    </div>
                    <p className="mt-2 text-lg font-bold">{feedback}</p>
                    {lastCorrect ? (
                      <button
                        onClick={next}
                        className="mt-5 rounded-full bg-gradient-warm px-8 py-3 text-lg font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
                      >
                        {sIdx + 1 >= sentences.length ? "Finish 🎉" : "Next sentence →"}
                      </button>
                    ) : (
                      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                        <button
                          onClick={() => listen(currentSentence)}
                          className="rounded-full bg-primary px-8 py-3 text-lg font-bold text-primary-foreground shadow-pop transition-transform hover:scale-105"
                        >
                          🔁 Try again
                        </button>
                        <button
                          onClick={next}
                          className="rounded-full border-2 border-border px-8 py-3 text-lg font-bold transition-transform hover:scale-105"
                        >
                          Skip →
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => listen(currentSentence)}
                    disabled={phase === "listening" || phase === "checking"}
                    className="rounded-full bg-primary px-10 py-5 text-xl font-bold text-primary-foreground shadow-pop transition-transform hover:scale-105 disabled:opacity-70"
                  >
                    {phase === "listening" ? "🎤 Listening…" : phase === "checking" ? "Thinking…" : "🎤 Read it aloud"}
                  </button>
                )}
                {!speechSupported && (
                  <p className="mt-4 text-sm text-destructive">
                    Voice needs Chrome or Safari to work. You can still hear Buddy read!
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
                You got {correctCount} of {totalItems} and earned 🪙 {coins} coins!
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

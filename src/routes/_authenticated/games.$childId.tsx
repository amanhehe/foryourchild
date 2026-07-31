import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { track } from "@/lib/clickstream";

export const Route = createFileRoute("/_authenticated/games/$childId")({
  component: GamesPage,
});

const GUEST_KEY = "buddy_guest_children";

type Child = {
  id: string;
  name: string;
  xp: number;
  coins: number;
  level: number;
  streak: number;
  literacy_score: number;
};

function isGuestId(id: string) {
  return id.startsWith("guest-");
}

async function loadChild(childId: string): Promise<Child | null> {
  if (isGuestId(childId)) {
    try {
      const raw = localStorage.getItem(GUEST_KEY);
      const list = raw ? (JSON.parse(raw) as any[]) : [];
      const g = list.find((c) => c.id === childId);
      if (!g) return null;
      return {
        id: childId,
        name: g.name ?? "Buddy",
        xp: g.xp ?? 0,
        coins: g.coins ?? 0,
        level: g.level ?? 1,
        streak: g.streak ?? 0,
        literacy_score: g.literacy_score ?? 0,
      };
    } catch {
      return null;
    }
  }
  const { data } = await supabase
    .from("children")
    .select("id, name, xp, coins, level, streak, literacy_score")
    .eq("id", childId)
    .single();
  return (data as Child) ?? null;
}

async function awardLocal(childId: string, xp: number, coins: number) {
  if (isGuestId(childId)) {
    const raw = localStorage.getItem(GUEST_KEY);
    const list = raw ? (JSON.parse(raw) as any[]) : [];
    const idx = list.findIndex((c) => c.id === childId);
    if (idx < 0) return;
    const newXp = (list[idx].xp ?? 0) + xp;
    list[idx] = {
      ...list[idx],
      xp: newXp,
      coins: (list[idx].coins ?? 0) + coins,
      level: Math.max(1, Math.floor(newXp / 100) + 1),
    };
    localStorage.setItem(GUEST_KEY, JSON.stringify(list));
    return;
  }
  const { data: c } = await supabase
    .from("children")
    .select("xp, coins")
    .eq("id", childId)
    .single();
  if (!c) return;
  const newXp = (c.xp ?? 0) + xp;
  await supabase
    .from("children")
    .update({
      xp: newXp,
      coins: (c.coins ?? 0) + coins,
      level: Math.max(1, Math.floor(newXp / 100) + 1),
    })
    .eq("id", childId);
}

type GameId = "rhyme" | "letter" | "builder";

const GAMES: { id: GameId; emoji: string; name: string; tag: string }[] = [
  { id: "rhyme", emoji: "🎵", name: "Rhyme Time", tag: "Tap the word that rhymes" },
  { id: "letter", emoji: "🔤", name: "Letter Pop", tag: "Pop the right starting sound" },
  { id: "builder", emoji: "🧱", name: "Word Builder", tag: "Tap letters in order" },
];

function GamesPage() {
  const { childId } = Route.useParams();
  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<GameId | null>(null);

  useEffect(() => {
    track({ context: "Course: Game zone", component: "Game", event: "Game zone viewed" });
  }, []);

  useEffect(() => {
    loadChild(childId).then((c) => {
      setChild(c);
      setLoading(false);
    });
  }, [childId]);

  async function reward(xp: number, coins: number, msg: string) {
    await awardLocal(childId, xp, coins);
    const c = await loadChild(childId);
    if (c) setChild(c);
    toast.success(msg, { description: `+${xp} XP · +${coins} 🪙` });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-sky">
        <p className="font-display text-2xl">Loading games…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-sky">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
        <Link to="/dashboard" className="rounded-full bg-card px-4 py-2 font-bold shadow-soft">
          ← Back
        </Link>
        <div className="font-display text-3xl text-primary">🎮 Game Zone</div>
        <div className="rounded-full bg-card px-4 py-2 font-bold shadow-soft">
          🪙 {child?.coins ?? 0} · ⭐ {child?.xp ?? 0}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        {!active && (
          <>
            <h1 className="mb-2 text-center font-display text-4xl text-foreground">
              Pick a game, {child?.name ?? "friend"}!
            </h1>
            <p className="mb-8 text-center text-lg text-muted-foreground">
              Play, learn, and earn coins for your pet 🐲
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActive(g.id)}
                  className="group rounded-3xl bg-card p-6 text-left shadow-soft transition-transform hover:scale-105"
                >
                  <div className="mb-3 text-6xl">{g.emoji}</div>
                  <div className="font-display text-2xl text-primary">{g.name}</div>
                  <div className="mt-1 text-muted-foreground">{g.tag}</div>
                  <div className="mt-4 inline-block rounded-full bg-gradient-warm px-4 py-2 text-sm font-bold text-primary-foreground">
                    Play →
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {active === "rhyme" && (
          <RhymeGame onExit={() => setActive(null)} onWin={reward} />
        )}
        {active === "letter" && (
          <LetterGame onExit={() => setActive(null)} onWin={reward} />
        )}
        {active === "builder" && (
          <BuilderGame onExit={() => setActive(null)} onWin={reward} />
        )}
      </main>
    </div>
  );
}

function GameShell({
  title,
  score,
  round,
  total,
  onExit,
  children,
}: {
  title: string;
  score: number;
  round: number;
  total: number;
  onExit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft sm:p-10">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className="rounded-full border-2 border-border px-4 py-2 font-bold"
        >
          ← Games
        </button>
        <div className="font-display text-2xl text-primary">{title}</div>
        <div className="font-bold">
          {round}/{total} · ⭐ {score}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ---------------- Rhyme Time ---------------- */

const RHYME_ROUNDS = [
  { target: "cat", emoji: "🐱", options: ["hat", "dog", "sun"] },
  { target: "bug", emoji: "🐛", options: ["mug", "pen", "cap"] },
  { target: "star", emoji: "⭐", options: ["car", "ball", "tree"] },
  { target: "frog", emoji: "🐸", options: ["log", "bed", "cup"] },
  { target: "moon", emoji: "🌙", options: ["spoon", "fish", "tree"] },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function RhymeGame({
  onExit,
  onWin,
}: {
  onExit: () => void;
  onWin: (xp: number, coins: number, msg: string) => void;
}) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const rounds = useMemo(() => shuffle(RHYME_ROUNDS), []);
  const current = rounds[round];
  const opts = useMemo(() => (current ? shuffle(current.options) : []), [current]);

  function pick(word: string) {
    const correct = word === current.target ? false : word.endsWith(current.target.slice(-2));
    if (correct) {
      setScore((s) => s + 1);
      toast.success("🎉 That rhymes!");
    } else {
      toast("Try the one that sounds the same at the end!");
    }
    if (round + 1 >= rounds.length) {
      const finalScore = score + (correct ? 1 : 0);
      onWin(finalScore * 5, finalScore * 2, `Rhyme Time complete!`);
      setDone(true);
    } else {
      setRound((r) => r + 1);
    }
  }

  return (
    <GameShell title="🎵 Rhyme Time" score={score} round={round + 1} total={rounds.length} onExit={onExit}>
      {done ? (
        <FinishCard score={score} total={rounds.length} onExit={onExit} />
      ) : (
        <div className="text-center">
          <div className="mb-4 text-8xl">{current.emoji}</div>
          <div className="mb-6 font-display text-3xl">
            Which word rhymes with <span className="text-primary">{current.target}</span>?
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {opts.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => pick(w)}
                className="rounded-2xl bg-gradient-warm px-6 py-6 text-3xl font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}
    </GameShell>
  );
}

/* ---------------- Letter Pop ---------------- */

const LETTER_ROUNDS = [
  { word: "apple", emoji: "🍎" },
  { word: "ball", emoji: "⚽" },
  { word: "cat", emoji: "🐱" },
  { word: "dog", emoji: "🐶" },
  { word: "fish", emoji: "🐟" },
  { word: "sun", emoji: "☀️" },
  { word: "moon", emoji: "🌙" },
  { word: "tree", emoji: "🌳" },
];

function LetterGame({
  onExit,
  onWin,
}: {
  onExit: () => void;
  onWin: (xp: number, coins: number, msg: string) => void;
}) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const rounds = useMemo(() => shuffle(LETTER_ROUNDS).slice(0, 5), []);
  const current = rounds[round];
  const opts = useMemo(() => {
    if (!current) return [];
    const correct = current.word[0];
    const pool = "abcdefghijklmnoprstuvwy".split("").filter((l) => l !== correct);
    return shuffle([correct, ...shuffle(pool).slice(0, 3)]);
  }, [current]);

  function pick(letter: string) {
    const correct = letter === current.word[0];
    if (correct) {
      setScore((s) => s + 1);
      toast.success(`✨ Yes! ${current.word.toUpperCase()} starts with ${letter.toUpperCase()}`);
    } else {
      toast(`Listen again — ${current.word} starts with ${current.word[0].toUpperCase()}`);
    }
    if (round + 1 >= rounds.length) {
      const finalScore = score + (correct ? 1 : 0);
      onWin(finalScore * 5, finalScore * 2, "Letter Pop complete!");
      setDone(true);
    } else {
      setRound((r) => r + 1);
    }
  }

  function speak() {
    try {
      const u = new SpeechSynthesisUtterance(current.word);
      u.rate = 0.8;
      window.speechSynthesis.speak(u);
    } catch {}
  }

  return (
    <GameShell title="🔤 Letter Pop" score={score} round={round + 1} total={rounds.length} onExit={onExit}>
      {done ? (
        <FinishCard score={score} total={rounds.length} onExit={onExit} />
      ) : (
        <div className="text-center">
          <div className="mb-2 text-8xl">{current.emoji}</div>
          <button
            type="button"
            onClick={speak}
            className="mb-6 rounded-full bg-secondary px-5 py-2 font-bold text-secondary-foreground"
          >
            🔊 Hear the word
          </button>
          <div className="mb-6 font-display text-3xl">
            What letter does it start with?
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            {opts.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => pick(l)}
                className="rounded-2xl bg-gradient-warm px-6 py-8 font-display text-5xl uppercase text-primary-foreground shadow-soft transition-transform hover:scale-105"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
    </GameShell>
  );
}

/* ---------------- Word Builder ---------------- */

const BUILDER_ROUNDS = [
  { word: "cat", emoji: "🐱" },
  { word: "sun", emoji: "☀️" },
  { word: "bug", emoji: "🐛" },
  { word: "fish", emoji: "🐟" },
  { word: "star", emoji: "⭐" },
];

function BuilderGame({
  onExit,
  onWin,
}: {
  onExit: () => void;
  onWin: (xp: number, coins: number, msg: string) => void;
}) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const rounds = useMemo(() => shuffle(BUILDER_ROUNDS), []);
  const current = rounds[round];
  const letters = useMemo(() => (current ? shuffle(current.word.split("")) : []), [current, round]);

  function tap(letter: string, idx: number) {
    if (picked.includes(`${letter}-${idx}`)) return;
    const next = [...picked, `${letter}-${idx}`];
    setPicked(next);
    const built = next.map((p) => p.split("-")[0]).join("");
    if (built.length === current.word.length) {
      const correct = built === current.word;
      if (correct) {
        setScore((s) => s + 1);
        toast.success(`🌟 You spelled ${current.word.toUpperCase()}!`);
      } else {
        toast(`Almost! The word was ${current.word.toUpperCase()}`);
      }
      setTimeout(() => {
        setPicked([]);
        if (round + 1 >= rounds.length) {
          const finalScore = score + (correct ? 1 : 0);
          onWin(finalScore * 6, finalScore * 3, "Word Builder complete!");
          setDone(true);
        } else {
          setRound((r) => r + 1);
        }
      }, 900);
    }
  }

  return (
    <GameShell title="🧱 Word Builder" score={score} round={round + 1} total={rounds.length} onExit={onExit}>
      {done ? (
        <FinishCard score={score} total={rounds.length} onExit={onExit} />
      ) : (
        <div className="text-center">
          <div className="mb-2 text-8xl">{current.emoji}</div>
          <div className="mb-6 font-display text-2xl text-muted-foreground">
            Tap the letters in order
          </div>
          <div className="mx-auto mb-6 flex min-h-[5rem] items-center justify-center gap-2 rounded-2xl border-4 border-dashed border-border bg-background px-6 py-4">
            {picked.length === 0 ? (
              <span className="text-muted-foreground">…</span>
            ) : (
              picked.map((p) => (
                <span key={p} className="font-display text-5xl uppercase text-primary">
                  {p.split("-")[0]}
                </span>
              ))
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {letters.map((l, idx) => {
              const used = picked.includes(`${l}-${idx}`);
              return (
                <button
                  key={`${l}-${idx}`}
                  type="button"
                  disabled={used}
                  onClick={() => tap(l, idx)}
                  className={`rounded-2xl px-6 py-6 font-display text-4xl uppercase shadow-soft transition-transform hover:scale-105 ${
                    used
                      ? "bg-muted text-muted-foreground"
                      : "bg-gradient-warm text-primary-foreground"
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </GameShell>
  );
}

/* ---------------- Finish card ---------------- */

function FinishCard({
  score,
  total,
  onExit,
}: {
  score: number;
  total: number;
  onExit: () => void;
}) {
  return (
    <div className="text-center">
      <div className="mb-4 text-8xl">🏆</div>
      <div className="mb-2 font-display text-4xl text-primary">Great job!</div>
      <div className="mb-6 text-xl text-muted-foreground">
        You got {score} out of {total}
      </div>
      <button
        type="button"
        onClick={onExit}
        className="rounded-full bg-gradient-warm px-6 py-3 font-bold text-primary-foreground shadow-soft"
      >
        Back to games
      </button>
    </div>
  );
}

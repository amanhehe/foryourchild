import { createFileRoute, Link } from "@tanstack/react-router";
import { track } from "@/lib/clickstream";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pet/$childId")({
  component: PetPage,
});

type Child = {
  name: string;
  pet_type: string;
  xp: number;
  level: number;
  streak: number;
  coins: number;
  literacy_score: number;
};

const PETS: Record<string, string[]> = {
  dragon: ["🥚", "🐲", "🐉"],
  cat: ["🥚", "🐱", "🦁"],
  bird: ["🥚", "🐥", "🦅"],
  fish: ["🥚", "🐟", "🐬"],
};

function stageFor(level: number) {
  if (level >= 5) return 2;
  if (level >= 2) return 1;
  return 0;
}

function PetPage() {
  const { childId } = Route.useParams();
  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    track({ context: "Course: Pet den", component: "Pet", event: "Pet den viewed" });
  }, []);

  useEffect(() => {
    if (childId.startsWith("guest-")) {
      try {
        const raw = localStorage.getItem("buddy_guest_children");
        const list = raw ? (JSON.parse(raw) as any[]) : [];
        const g = list.find((c) => c.id === childId);
        setChild({
          name: g?.name || "Buddy",
          pet_type: g?.pet_type || "dragon",
          xp: g?.xp ?? 0,
          level: g?.level ?? 1,
          streak: g?.streak ?? 0,
          coins: g?.coins ?? 0,
          literacy_score: g?.literacy_score ?? 0,
        });
      } catch {
        setChild({ name: "Buddy", pet_type: "dragon", xp: 0, level: 1, streak: 0, coins: 0, literacy_score: 0 });
      }
      setLoading(false);
      return;
    }
    supabase
      .from("children")
      .select("name, pet_type, xp, level, streak, coins, literacy_score")
      .eq("id", childId)
      .single()
      .then(({ data }) => {
        setChild(data as Child);
        setLoading(false);
      });
  }, [childId]);

  const stages = child ? PETS[child.pet_type] ?? PETS.dragon : PETS.dragon;
  const stage = child ? stageFor(child.level) : 0;
  const xpInLevel = child ? child.xp % 100 : 0;
  const nextStageLevel = stage === 0 ? 2 : stage === 1 ? 5 : null;

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 text-primary-foreground">
        <Link to="/dashboard" className="font-bold underline-offset-4 hover:underline">← Exit</Link>
        <span className="font-display text-lg font-bold">My Buddy Pet</span>
      </header>

      <main className="mx-auto max-w-xl px-5 pb-16">
        <div className="rounded-[2rem] bg-card p-8 text-center shadow-pop">
          {loading || !child ? (
            <p className="py-16 text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="text-8xl animate-float">{stages[stage]}</div>
              <h1 className="mt-4 text-2xl font-bold">{child.name}'s pet</h1>
              <p className="text-sm text-muted-foreground">
                Stage {stage + 1} of 3 · grows as {child.name} learns!
              </p>

              <div className="mt-6">
                <div className="mb-1 flex justify-between text-sm font-bold">
                  <span>Level {child.level}</span>
                  <span>{xpInLevel}/100 XP</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-gradient-warm transition-all"
                    style={{ width: `${xpInLevel}%` }}
                  />
                </div>
                {nextStageLevel && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reach level {nextStageLevel} to evolve your pet! ✨
                  </p>
                )}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <Stat label="Coins" value={`🪙 ${child.coins}`} />
                <Stat label="Streak" value={`🔥 ${child.streak}`} />
                <Stat label="Literacy" value={`${child.literacy_score}%`} />
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  to="/learn/$childId"
                  params={{ childId }}
                  className="rounded-full bg-gradient-warm px-6 py-3 font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
                >
                  🎤 Practise to grow
                </Link>
                <Link
                  to="/story/$childId"
                  params={{ childId }}
                  className="rounded-full border-2 border-border px-6 py-3 font-bold transition-transform hover:scale-105"
                >
                  📖 Read a story
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted py-3">
      <p className="font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

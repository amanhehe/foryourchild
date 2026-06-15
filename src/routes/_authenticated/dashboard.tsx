import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import buddyOwl from "@/assets/buddy-owl.png";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Child = {
  id: string;
  name: string;
  age: number | null;
  avatar: string;
  reading_level: string;
  xp: number;
  coins: number;
  level: number;
  streak: number;
  literacy_score: number;
};

const AVATARS = ["🦊", "🐼", "🦄", "🐯", "🐸", "🐙", "🐶", "🐱"];
const LEVELS = [
  { value: "foundation", label: "Foundation (age 4–5)" },
  { value: "year1", label: "Year 1 (age 5–6)" },
  { value: "year2", label: "Year 2 (age 7–8)" },
];

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [level, setLevel] = useState("foundation");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("children")
      .select("*")
      .order("created_at", { ascending: true });
    setChildren((data ?? []) as Child[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("children").insert({
      parent_id: user.id,
      name,
      age: age ? Number(age) : null,
      avatar,
      reading_level: level,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${name} added! 🎉`);
    setName("");
    setAge("");
    setAvatar("🦊");
    setShowForm(false);
    load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <img src={buddyOwl} alt="Buddy" width={36} height={36} className="h-9 w-9" />
          <span className="font-display text-lg font-bold">Parent Dashboard</span>
        </div>
        <button
          onClick={signOut}
          className="rounded-full border-2 border-border px-4 py-2 text-sm font-bold transition-transform hover:scale-105"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        <div className="rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-soft">
          <h1 className="text-2xl font-bold">Hi {user?.user_metadata?.full_name || "there"}! 👋</h1>
          <p className="mt-1 opacity-90">Add your children and Buddy will start coaching their reading.</p>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-xl font-bold">Your children</h2>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
          >
            {showForm ? "Cancel" : "+ Add child"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={addChild}
            className="mt-4 animate-pop-in rounded-3xl border-2 border-border bg-card p-6 shadow-soft"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-bold">Child's name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lily"
                  maxLength={20}
                  className="w-full rounded-xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold">Age</label>
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="6"
                  className="w-full rounded-xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-primary"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-bold">Reading level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full rounded-xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-primary"
                >
                  {LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold">Pick an avatar</label>
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map((a) => (
                    <button
                      type="button"
                      key={a}
                      onClick={() => setAvatar(a)}
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-2xl transition-transform hover:scale-110 ${
                        avatar === a ? "border-primary bg-secondary" : "border-border bg-background"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-5 rounded-full bg-gradient-warm px-8 py-3 font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105 disabled:opacity-60"
            >
              {busy ? "Adding…" : "Add child"}
            </button>
          </form>
        )}

        {loading ? (
          <p className="mt-8 text-center text-muted-foreground">Loading…</p>
        ) : children.length === 0 && !showForm ? (
          <div className="mt-8 rounded-3xl border-2 border-dashed border-border bg-card p-10 text-center">
            <img src={buddyOwl} alt="Buddy" width={72} height={72} className="mx-auto h-18 w-18 animate-wiggle" />
            <p className="mt-3 font-bold">No children yet</p>
            <p className="text-sm text-muted-foreground">Add your first child to get started.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((c) => (
              <div
                key={c.id}
                className="animate-pop-in rounded-3xl border-2 border-border bg-card p-6 shadow-soft transition-transform hover:-translate-y-1"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-3xl">
                    {c.avatar}
                  </div>
                  <div>
                    <p className="text-lg font-bold">{c.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.age ? `Age ${c.age} · ` : ""}Level {c.level}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat label="XP" value={c.xp} />
                  <Stat label="Coins" value={c.coins} />
                  <Stat label="Streak" value={`${c.streak}🔥`} />
                </div>
                <Link
                  to="/learn/$childId"
                  params={{ childId: c.id }}
                  className="mt-4 block rounded-full bg-gradient-warm px-5 py-2.5 text-center font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
                >
                  🎤 Start learning
                </Link>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link
                    to="/story/$childId"
                    params={{ childId: c.id }}
                    className="rounded-full border-2 border-border px-3 py-2 text-center text-sm font-bold transition-transform hover:scale-105"
                  >
                    📖 Story
                  </Link>
                  <Link
                    to="/pet/$childId"
                    params={{ childId: c.id }}
                    className="rounded-full border-2 border-border px-3 py-2 text-center text-sm font-bold transition-transform hover:scale-105"
                  >
                    🐲 Pet
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-muted py-2">
      <p className="font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

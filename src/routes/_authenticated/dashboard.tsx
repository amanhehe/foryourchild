import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  joinClassroom,
  listChildClassrooms,
  type ChildClassroomRow,
  type ClassroomRow,
} from "@/lib/teacher.functions";
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

const GUEST_CHILDREN_KEY = "buddy_guest_children";
const GUEST_CLASSROOMS_KEY = "guestClassrooms";
const GUEST_CLASS_MEMBERS_KEY = "buddy_guest_class_members";

type GuestClassMembership = {
  child_id: string;
  classroom_id: string;
};

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const joinRoom = useServerFn(joinClassroom);
  const listJoinedRooms = useServerFn(listChildClassrooms);
  const [children, setChildren] = useState<Child[]>([]);
  const [joinedClasses, setJoinedClasses] = useState<ChildClassroomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [joinChildId, setJoinChildId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [level, setLevel] = useState("foundation");
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState(false);

  const isGuestMode = useCallback(() => {
    return typeof window !== "undefined" && window.localStorage.getItem("buddy_guest") === "1";
  }, []);

  const getGuestChildren = useCallback((): Child[] => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(GUEST_CHILDREN_KEY) ?? "[]") as Child[];
    } catch {
      return [];
    }
  }, []);

  const saveGuestChildren = useCallback((nextChildren: Child[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GUEST_CHILDREN_KEY, JSON.stringify(nextChildren));
  }, []);

  const getGuestClassrooms = useCallback((): ClassroomRow[] => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(GUEST_CLASSROOMS_KEY) ?? "[]") as ClassroomRow[];
    } catch {
      return [];
    }
  }, []);

  const getGuestMemberships = useCallback((): GuestClassMembership[] => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(
        window.localStorage.getItem(GUEST_CLASS_MEMBERS_KEY) ?? "[]",
      ) as GuestClassMembership[];
    } catch {
      return [];
    }
  }, []);

  const saveGuestMemberships = useCallback((memberships: GuestClassMembership[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GUEST_CLASS_MEMBERS_KEY, JSON.stringify(memberships));
  }, []);

  const getGuestJoinedClasses = useCallback((): ChildClassroomRow[] => {
    const rooms = getGuestClassrooms();
    const memberships = getGuestMemberships();
    return memberships.flatMap((membership) => {
      const room = rooms.find((r) => r.id === membership.classroom_id);
      if (!room) return [];
      return [
        {
          child_id: membership.child_id,
          classroom_id: room.id,
          name: room.name,
          year_level: room.year_level,
          join_code: room.join_code,
        },
      ];
    });
  }, [getGuestClassrooms, getGuestMemberships]);

  const load = useCallback(async () => {
    if (authLoading) return;

    if (!user && isGuestMode()) {
      const guestChildren = getGuestChildren();
      setChildren(guestChildren);
      setJoinedClasses(getGuestJoinedClasses());
      setJoinChildId((current) => current || guestChildren[0]?.id || "");
      setLoading(false);
      return;
    }

    if (!user) {
      setChildren([]);
      setJoinedClasses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [{ data }, classData] = await Promise.all([
      supabase
      .from("children")
      .select("*")
        .order("created_at", { ascending: true }),
      listJoinedRooms({}),
    ]);
    const nextChildren = (data ?? []) as Child[];
    setChildren(nextChildren);
    setJoinedClasses(classData);
    setJoinChildId((current) => current || nextChildren[0]?.id || "");
    setLoading(false);
  }, [authLoading, getGuestChildren, getGuestJoinedClasses, isGuestMode, listJoinedRooms, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    const childName = name.trim();
    if (!childName) {
      toast.error("Please enter a name.");
      return;
    }

    if (!user) {
      if (isGuestMode()) {
        const guestChild: Child = {
          id: `guest-${Date.now()}`,
          name: childName,
          age: age ? Number(age) : null,
          avatar,
          reading_level: level,
          xp: 0,
          coins: 0,
          level: 1,
          streak: 0,
          literacy_score: 0,
        };
        const nextChildren = [...getGuestChildren(), guestChild];
        saveGuestChildren(nextChildren);
        setChildren(nextChildren);
        setJoinChildId((current) => current || guestChild.id);
        toast.success(`${childName} added for this prototype! 🎉`);
        setName("");
        setAge("");
        setAvatar("🦊");
        setShowForm(false);
        return;
      }
      toast.error("Please sign in to save a child profile.", {
        description: "Guest mode can't save data. Tap Sign out to go to the login screen.",
      });
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("children").insert({
      parent_id: user.id,
      name: childName,
      age: age ? Number(age) : null,
      avatar,
      reading_level: level,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${childName} added! 🎉`);
    setName("");
    setAge("");
    setAvatar("🦊");
    setShowForm(false);
    load();
  }

  async function joinClass(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!joinChildId) {
      toast.error("Add a child first, then join a class.");
      return;
    }
    if (!code) {
      toast.error("Enter the class code from the teacher.");
      return;
    }

    setJoining(true);
    try {
      if (isGuestMode()) {
        const room = getGuestClassrooms().find((r) => r.join_code.toUpperCase() === code);
        if (!room) {
          toast.error("No prototype class found with that code.");
          return;
        }
        const memberships = getGuestMemberships();
        const exists = memberships.some(
          (membership) =>
            membership.child_id === joinChildId && membership.classroom_id === room.id,
        );
        if (!exists) {
          saveGuestMemberships([...memberships, { child_id: joinChildId, classroom_id: room.id }]);
          const rooms = getGuestClassrooms().map((r) =>
            r.id === room.id ? { ...r, member_count: r.member_count + 1 } : r,
          );
          window.localStorage.setItem(GUEST_CLASSROOMS_KEY, JSON.stringify(rooms));
        }
        setJoinedClasses(getGuestJoinedClasses());
      } else {
        const joined = await joinRoom({ data: { childId: joinChildId, code } });
        setJoinedClasses((current) => {
          const withoutDuplicate = current.filter(
            (room) =>
              !(room.child_id === joined.child_id && room.classroom_id === joined.classroom_id),
          );
          return [...withoutDuplicate, joined];
        });
      }
      setJoinCode("");
      toast.success("Class joined! 🎉");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't join that class.");
    } finally {
      setJoining(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("buddy_guest");
      window.localStorage.removeItem(GUEST_CHILDREN_KEY);
      window.localStorage.removeItem(GUEST_CLASS_MEMBERS_KEY);
    }
    navigate({ to: "/" });
  }

  const classesByChild = joinedClasses.reduce<Record<string, ChildClassroomRow[]>>((acc, room) => {
    acc[room.child_id] = [...(acc[room.child_id] ?? []), room];
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <img src={buddyOwl} alt="Buddy" width={36} height={36} className="h-9 w-9" />
          <span className="font-display text-lg font-bold">Parent Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/teacher"
            className="rounded-full border-2 border-border px-4 py-2 text-sm font-bold transition-transform hover:scale-105"
          >
            🍎 Teacher
          </Link>
          <button
            onClick={signOut}
            className="rounded-full border-2 border-border px-4 py-2 text-sm font-bold transition-transform hover:scale-105"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        <div className="rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-soft">
          <h1 className="text-2xl font-bold">Hi {user?.user_metadata?.full_name || "there"}! 👋</h1>
          <p className="mt-1 opacity-90">Add your children and Buddy will start coaching their reading.</p>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-xl font-bold">Your children</h2>
          <button
            type="button"
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

        <section className="mt-6 rounded-3xl border-2 border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Join a teacher's class</h2>
              <p className="text-sm text-muted-foreground">Enter the code your teacher shared.</p>
            </div>
            <Link
              to="/teacher"
              className="text-sm font-bold text-primary underline-offset-4 hover:underline"
            >
              Make a teacher class
            </Link>
          </div>
          <form onSubmit={joinClass} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <select
              value={joinChildId}
              onChange={(e) => setJoinChildId(e.target.value)}
              disabled={children.length === 0}
              className="w-full rounded-xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-primary disabled:opacity-60"
              aria-label="Choose child"
            >
              {children.length === 0 ? (
                <option value="">Add a child first</option>
              ) : (
                children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))
              )}
            </select>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Class code"
              maxLength={12}
              className="w-full rounded-xl border-2 border-input bg-background px-4 py-2.5 font-bold uppercase outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={joining || children.length === 0}
              className="rounded-full bg-primary px-6 py-2.5 font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105 disabled:opacity-60"
            >
              {joining ? "Joining…" : "Join class"}
            </button>
          </form>
        </section>

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
                {(classesByChild[c.id] ?? []).length > 0 && (
                  <div className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground">
                    🍎 Joined {classesByChild[c.id].map((room) => room.name).join(", ")}
                  </div>
                )}
                <Link
                  to="/learn/$childId"
                  params={{ childId: c.id }}
                  className="mt-4 block rounded-full bg-gradient-warm px-5 py-2.5 text-center font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
                >
                  🎤 Start learning
                </Link>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Link
                    to="/story/$childId"
                    params={{ childId: c.id }}
                    className="rounded-full border-2 border-border px-2 py-2 text-center text-sm font-bold transition-transform hover:scale-105"
                  >
                    📖 Story
                  </Link>
                  <Link
                    to="/games/$childId"
                    params={{ childId: c.id }}
                    className="rounded-full border-2 border-border px-2 py-2 text-center text-sm font-bold transition-transform hover:scale-105"
                  >
                    🎮 Games
                  </Link>
                  <Link
                    to="/pet/$childId"
                    params={{ childId: c.id }}
                    className="rounded-full border-2 border-border px-2 py-2 text-center text-sm font-bold transition-transform hover:scale-105"
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listClassrooms,
  createClassroom,
  ensureTeacherRole,
  listClassroomPupils,
  type ClassroomRow,
  type PupilRow,
} from "@/lib/teacher.functions";
import { toast } from "sonner";
import { track } from "@/lib/clickstream";
import buddyOwl from "@/assets/buddy-owl.png";

export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherPage,
});

function isGuestMode() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("buddy_guest") === "1";
}

function getGuestRooms(): ClassroomRow[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem("guestClassrooms") || "[]");
  } catch {
    return [];
  }
}

function saveGuestRooms(rooms: ClassroomRow[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("guestClassrooms", JSON.stringify(rooms));
}

function getGuestPupils(classroomId: string): PupilRow[] {
  if (typeof window === "undefined") return [];
  try {
    const members = JSON.parse(
      window.localStorage.getItem("buddy_guest_class_members") || "[]",
    ) as { child_id: string; classroom_id: string }[];
    const children = JSON.parse(
      window.localStorage.getItem("buddy_guest_children") || "[]",
    ) as any[];
    const ids = members.filter((m) => m.classroom_id === classroomId).map((m) => m.child_id);
    return children
      .filter((c) => ids.includes(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name ?? "Pupil",
        avatar: c.avatar ?? "🦊",
        level: c.level ?? 1,
        xp: c.xp ?? 0,
        coins: c.coins ?? 0,
        streak: c.streak ?? 0,
        literacy_score: c.literacy_score ?? 0,
        reading_level: c.reading_level ?? "foundation",
        updated_at: c.updated_at ?? new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function TeacherPage() {
  const list = useServerFn(listClassrooms);
  const create = useServerFn(createClassroom);
  const ensureRole = useServerFn(ensureTeacherRole);
  const fetchPupils = useServerFn(listClassroomPupils);
  const [rooms, setRooms] = useState<ClassroomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [pupilsByRoom, setPupilsByRoom] = useState<Record<string, PupilRow[]>>({});
  const [pupilsLoading, setPupilsLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isGuestMode()) {
      setRooms(getGuestRooms());
      setLoading(false);
      return;
    }
    try {
      await ensureRole({});
      const data = await list({});
      setRooms(data);
    } catch {
      toast.error("Couldn't load classrooms.");
    } finally {
      setLoading(false);
    }
  }, [list, ensureRole]);

  useEffect(() => {
    track({ context: "Site: Teacher dashboard", component: "System", event: "Teacher dashboard viewed" });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isGuestMode()) {
        const next: ClassroomRow[] = [
          ...getGuestRooms(),
          {
            id: `guest-${Date.now()}`,
            name,
            year_level: year || null,
            join_code: randomCode(),
            member_count: 0,
          },
        ];
        saveGuestRooms(next);
        setRooms(next);
      } else {
        await create({ data: { name, yearLevel: year || undefined } });
        await load();
      }
      toast.success("Classroom created! 🎉");
      setName("");
      setYear("");
      setShowForm(false);
    } catch {
      toast.error("Couldn't create classroom.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePupils(roomId: string) {
    if (openRoom === roomId) {
      setOpenRoom(null);
      return;
    }
    setOpenRoom(roomId);
    if (pupilsByRoom[roomId]) return;
    setPupilsLoading(roomId);
    try {
      if (isGuestMode()) {
        setPupilsByRoom((p) => ({ ...p, [roomId]: getGuestPupils(roomId) }));
      } else {
        const data = await fetchPupils({ data: { classroomId: roomId } });
        setPupilsByRoom((p) => ({ ...p, [roomId]: data }));
      }
    } catch {
      toast.error("Couldn't load pupils.");
    } finally {
      setPupilsLoading(null);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <img src={buddyOwl} alt="Buddy" className="h-9 w-9" />
          <span className="font-display text-lg font-bold">Teacher Dashboard</span>
        </div>
        <Link
          to="/dashboard"
          className="rounded-full border-2 border-border px-4 py-2 text-sm font-bold transition-transform hover:scale-105"
        >
          Parent view
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        <div className="rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-soft">
          <h1 className="text-2xl font-bold">Your classrooms 🍎</h1>
          <p className="mt-1 opacity-90">Create a class, share the join code, then tap a class to see pupil progress.</p>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-xl font-bold">Classes</h2>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
          >
            {showForm ? "Cancel" : "+ New class"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={add}
            className="mt-4 animate-pop-in rounded-3xl border-2 border-border bg-card p-6 shadow-soft"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-bold">Class name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Room 3B"
                  maxLength={60}
                  className="w-full rounded-xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold">Year level</label>
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. Year 1"
                  className="w-full rounded-xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-primary"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-5 rounded-full bg-gradient-warm px-8 py-3 font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105 disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create class"}
            </button>
          </form>
        )}

        {loading ? (
          <p className="mt-8 text-center text-muted-foreground">Loading…</p>
        ) : rooms.length === 0 && !showForm ? (
          <div className="mt-8 rounded-3xl border-2 border-dashed border-border bg-card p-10 text-center">
            <p className="font-bold">No classes yet</p>
            <p className="text-sm text-muted-foreground">Create your first class to get started.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {rooms.map((r) => {
              const isOpen = openRoom === r.id;
              const pupils = pupilsByRoom[r.id];
              return (
                <div
                  key={r.id}
                  className="animate-pop-in rounded-3xl border-2 border-border bg-card p-6 shadow-soft"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold">{r.name}</p>
                      <p className="text-sm text-muted-foreground">{r.year_level || "All levels"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">
                        Code: {r.join_code}
                      </span>
                      <button
                        onClick={() => togglePupils(r.id)}
                        className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
                      >
                        {isOpen ? "Hide pupils" : `👧 ${r.member_count} pupils`}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-5 border-t-2 border-dashed border-border pt-5">
                      {pupilsLoading === r.id ? (
                        <p className="text-center text-muted-foreground">Loading pupils…</p>
                      ) : !pupils || pupils.length === 0 ? (
                        <p className="text-center text-muted-foreground">
                          No pupils yet. Share the code <b>{r.join_code}</b> with families.
                        </p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {pupils.map((p) => (
                            <div
                              key={p.id}
                              className="rounded-2xl border-2 border-border bg-background p-4"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-3xl">{p.avatar || "🦊"}</span>
                                <div className="flex-1">
                                  <p className="font-bold">{p.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {p.reading_level || "foundation"} reader
                                  </p>
                                </div>
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                                  Lvl {p.level}
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                                <Stat label="XP" value={p.xp} />
                                <Stat label="Coins" value={p.coins} />
                                <Stat label="Streak" value={`${p.streak}🔥`} />
                                <Stat label="Score" value={p.literacy_score} />
                              </div>
                              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full bg-gradient-warm"
                                  style={{ width: `${Math.min(100, p.literacy_score)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-muted px-2 py-1.5">
      <p className="font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

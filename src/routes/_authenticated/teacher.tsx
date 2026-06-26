import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listClassrooms,
  createClassroom,
  ensureTeacherRole,
  type ClassroomRow,
} from "@/lib/teacher.functions";
import { toast } from "sonner";
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

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function TeacherPage() {
  const list = useServerFn(listClassrooms);
  const create = useServerFn(createClassroom);
  const ensureRole = useServerFn(ensureTeacherRole);
  const [rooms, setRooms] = useState<ClassroomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

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
          <p className="mt-1 opacity-90">Create a class and share the join code with families.</p>
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
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => (
              <div
                key={r.id}
                className="animate-pop-in rounded-3xl border-2 border-border bg-card p-6 shadow-soft"
              >
                <p className="text-lg font-bold">{r.name}</p>
                <p className="text-sm text-muted-foreground">{r.year_level || "All levels"}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-bold">👧 {r.member_count} pupils</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">
                    Code: {r.join_code}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

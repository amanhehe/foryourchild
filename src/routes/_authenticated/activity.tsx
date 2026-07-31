import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearGuestEvents,
  downloadCsv,
  eventsToCsv,
  readGuestEvents,
  track,
  type ClickEvent,
} from "@/lib/clickstream";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity & Clickstream — AI Phonics Buddy" },
      {
        name: "description",
        content:
          "See every page view, click, video action and quiz answer logged by AI Phonics Buddy, and export the clickstream as CSV.",
      },
      { property: "og:title", content: "Activity & Clickstream — AI Phonics Buddy" },
      {
        property: "og:description",
        content: "Moodle-style learning analytics log for every learner action.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const [events, setEvents] = useState<ClickEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    if (sess.session?.user) {
      const { data } = await supabase
        .from("learning_events")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(1000);
      setEvents((data ?? []) as unknown as ClickEvent[]);
    } else {
      setEvents([...readGuestEvents()].reverse());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    track({ context: "Site: Learning analytics", component: "System", event: "Activity report viewed" });
    load();
  }, [load]);

  const components = useMemo(
    () => ["all", ...Array.from(new Set(events.map((e) => e.component)))],
    [events],
  );
  const shown = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.component === filter)),
    [events, filter],
  );

  const stats = useMemo(() => {
    const byName = new Map<string, number>();
    events.forEach((e) => byName.set(e.event_name, (byName.get(e.event_name) ?? 0) + 1));
    const top = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const sessions = new Set(events.map((e) => e.session_id)).size;
    const videoEvents = events.filter((e) => e.component === "Video").length;
    const quizEvents = events.filter((e) => e.component === "Quiz").length;
    return { top, sessions, videoEvents, quizEvents, max: top[0]?.[1] ?? 1 };
  }, [events]);

  return (
    <div className="min-h-screen bg-gradient-hero pb-16">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-primary-foreground">
        <Link to="/dashboard" className="font-bold underline-offset-4 hover:underline">
          ← Dashboard
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              downloadCsv(`clickstream-${new Date().toISOString().slice(0, 10)}.csv`, eventsToCsv(shown));
              track({
                context: "Site: Learning analytics",
                component: "Logs",
                event: "Log report exported",
                meta: { rows: shown.length },
              });
            }}
            className="rounded-full bg-card px-4 py-2 text-sm font-bold text-foreground shadow-pop"
          >
            ⬇️ Export CSV
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-full bg-card/20 px-4 py-2 text-sm font-bold backdrop-blur"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <div className="rounded-[2rem] bg-card p-6 shadow-pop md:p-8">
          <h1 className="text-3xl font-bold">📊 Activity & clickstream</h1>
          <p className="mt-2 text-muted-foreground">
            Every page view, click, video action and quiz answer is logged here — the same shape as a
            Moodle log export (Time · Context · Component · Event · Description · Origin).
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Total events", value: events.length, emoji: "🖱️" },
              { label: "Sessions", value: stats.sessions, emoji: "🧭" },
              { label: "Video actions", value: stats.videoEvents, emoji: "🎬" },
              { label: "Quiz actions", value: stats.quizEvents, emoji: "📝" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-secondary/50 p-4 text-center">
                <div className="text-2xl">{s.emoji}</div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs font-bold text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {stats.top.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-bold">Most frequent events</h2>
              <div className="mt-3 space-y-2">
                {stats.top.map(([name, count]) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-48 shrink-0 truncate text-sm font-bold">{name}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((count / stats.max) * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {components.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`rounded-full border-2 px-4 py-1 text-sm font-bold ${
                  filter === c ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                clearGuestEvents();
                toast.success("Local prototype log cleared.");
                load();
              }}
              className="ml-auto rounded-full border-2 border-border px-4 py-1 text-sm font-bold"
            >
              Clear local log
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-secondary/50 text-xs uppercase">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Event context</th>
                  <th className="p-3">Component</th>
                  <th className="p-3">Event name</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Origin</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="p-4" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && shown.length === 0 && (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan={6}>
                      No events yet — open a lesson or play a game and come back.
                    </td>
                  </tr>
                )}
                {shown.slice(0, 300).map((e) => (
                  <tr key={e.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap p-3">{new Date(e.occurred_at).toLocaleString()}</td>
                    <td className="p-3">{e.event_context}</td>
                    <td className="p-3">{e.component}</td>
                    <td className="p-3 font-bold">{e.event_name}</td>
                    <td className="p-3 text-muted-foreground">{e.description}</td>
                    <td className="p-3">{e.origin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

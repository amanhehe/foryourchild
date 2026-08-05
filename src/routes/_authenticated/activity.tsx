import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  downloadCsv,
  eventsToCsv,
  readGuestEvents,
  clearGuestEvents,
  type ClickEvent,
} from "@/lib/clickstream";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "My Activity Log — AI Phonics Buddy" },
      {
        name: "description",
        content:
          "See your own learning clickstream: page views, taps, lessons, games and quiz attempts, and export it as a CSV file.",
      },
      { property: "og:title", content: "My Activity Log — AI Phonics Buddy" },
      {
        property: "og:description",
        content: "Your personal learning activity log with CSV export.",
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
  const [signedIn, setSignedIn] = useState(false);

  async function load() {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      setSignedIn(true);
      // Move any locally buffered events into the database first, so the table
      // below is always the real stored clickstream.
      await syncGuestEvents();
      const { data } = await supabase
        .from("learning_events")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(1000);
      setEvents((data ?? []) as unknown as ClickEvent[]);
    } else {
      setSignedIn(false);
      setEvents(readGuestEvents().slice().reverse());
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const sessions = new Set(events.map((e) => e.session_id)).size;
  const quizzes = events.filter((e) => /quiz/i.test(e.event_name)).length;


  return (
    <div className="min-h-screen bg-gradient-hero pb-16">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-primary-foreground">
        <Link to="/dashboard" className="font-bold underline-offset-4 hover:underline">
          ← Dashboard
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full bg-card px-4 py-2 text-sm font-bold text-foreground shadow-pop"
          >
            🔄 Refresh
          </button>
          <button
            type="button"
            disabled={!events.length}
            onClick={() =>
              downloadCsv(
                `my-activity-${new Date().toISOString().slice(0, 10)}.csv`,
                eventsToCsv(events),
              )
            }
            className="rounded-full bg-card px-4 py-2 text-sm font-bold text-foreground shadow-pop disabled:opacity-50"
          >
            ⬇️ Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              clearGuestEvents();
              void load();
            }}
            className="rounded-full border-2 border-primary-foreground/60 px-4 py-2 text-sm font-bold"
          >
            🧹 Clear local
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <div className="rounded-[2rem] bg-card p-6 shadow-pop md:p-8">
          <h1 className="text-3xl font-bold">📊 My activity log</h1>
          <p className="mt-2 text-muted-foreground">
            Every page view, tap, lesson step, game and quiz attempt from this account, in the same
            format as a Moodle log export.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              ["Events", events.length],
              ["Sessions", sessions],
              ["Quiz events", quizzes],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-secondary/50 p-4 text-center">
                <p className="text-3xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {loading ? (
            <p className="mt-6 text-lg">Loading…</p>
          ) : events.length === 0 ? (
            <p className="mt-6 text-muted-foreground">
              No activity recorded yet — play a lesson or a game and come back.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-muted-foreground">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Event context</th>
                    <th className="py-2 pr-3">Component</th>
                    <th className="py-2 pr-3">Event name</th>
                    <th className="py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, 300).map((e) => (
                    <tr key={e.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {new Date(e.occurred_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">{e.event_context}</td>
                      <td className="py-2 pr-3">{e.component}</td>
                      <td className="py-2 pr-3 font-bold">{e.event_name}</td>
                      <td className="py-2">{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {events.length > 300 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Showing the latest 300 of {events.length} rows — export the CSV for everything.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

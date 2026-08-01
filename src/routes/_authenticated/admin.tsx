import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAllEvents, type AdminEvent } from "@/lib/admin.functions";
import { downloadCsv, eventsToCsv, type ClickEvent } from "@/lib/clickstream";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Research Console — AI Phonics Buddy" },
      {
        name: "description",
        content:
          "Private admin console for exporting the full learner clickstream and quiz attempt data collected by AI Phonics Buddy.",
      },
      { property: "og:title", content: "Research Console — AI Phonics Buddy" },
      {
        property: "og:description",
        content: "Admin-only learning analytics export for AI Phonics Buddy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const fetchAll = useServerFn(listAllEvents);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [quizCount, setQuizCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll({ data: undefined })
      .then((res) => {
        setEvents(res.events);
        setQuizCount(res.quizAttempts.length);
      })
      .catch((e: Error) =>
        setError(
          /forbidden/i.test(e.message)
            ? "This console is restricted to research/admin accounts."
            : e.message,
        ),
      )
      .finally(() => setLoading(false));
  }, [fetchAll]);

  const learners = new Set(events.map((e) => e.user_id ?? "?")).size;
  const sessions = new Set(events.map((e) => e.session_id)).size;

  return (
    <div className="min-h-screen bg-gradient-hero pb-16">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 text-primary-foreground">
        <Link to="/dashboard" className="font-bold underline-offset-4 hover:underline">
          ← Dashboard
        </Link>
        <button
          type="button"
          disabled={!events.length}
          onClick={() =>
            downloadCsv(
              `all-learners-clickstream-${new Date().toISOString().slice(0, 10)}.csv`,
              eventsToCsv(events as unknown as ClickEvent[]),
            )
          }
          className="rounded-full bg-card px-4 py-2 text-sm font-bold text-foreground shadow-pop disabled:opacity-50"
        >
          ⬇️ Export all data (CSV)
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        <div className="rounded-[2rem] bg-card p-6 shadow-pop md:p-8">
          <h1 className="text-3xl font-bold">🔒 Research console</h1>
          <p className="mt-2 text-muted-foreground">
            Private, admin-only feed of every learner&apos;s clickstream. Learners and parents can
            only ever see their own rows — this page is the only place the full dataset is
            reachable, and the database refuses it for any non-admin account.
          </p>

          {loading && <p className="mt-6 text-lg">Loading…</p>}
          {error && (
            <p className="mt-6 rounded-2xl bg-destructive/10 p-4 font-bold text-destructive">
              {error}
            </p>
          )}

          {!loading && !error && (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ["Events", events.length],
                  ["Learners", learners],
                  ["Sessions", sessions],
                  ["Quiz attempts", quizCount],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl bg-secondary/50 p-4 text-center">
                    <p className="text-3xl font-bold">{value}</p>
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-border text-muted-foreground">
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">User</th>
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
                        <td className="py-2 pr-3 font-mono text-xs">
                          {(e.user_id ?? "guest").slice(0, 8)}
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
                    Showing the latest 300 of {events.length} rows — export the CSV for the full
                    dataset.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

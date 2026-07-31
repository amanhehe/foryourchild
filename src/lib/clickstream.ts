/**
 * Clickstream tracker (Moodle-style event log).
 *
 * Every learner action — page views, clicks, video actions, quiz attempts —
 * is captured as an event row with the same shape as a Moodle log export:
 * Time / Event context / Component / Event name / Description / Origin / IP.
 *
 * Signed-in users:  events are written to the `learning_events` table.
 * Guest (prototype): events are buffered in localStorage so the demo still
 * produces a full clickstream that can be viewed and exported to CSV.
 */
import { supabase } from "@/integrations/supabase/client";

export type ClickEvent = {
  id: string;
  occurred_at: string;
  session_id: string;
  user_id: string | null;
  child_id: string | null;
  event_context: string;
  component: string;
  event_name: string;
  description: string;
  origin: string;
  target: string | null;
  action: string | null;
  route: string | null;
  meta: Record<string, unknown>;
};

export type TrackInput = {
  context: string;
  component: string;
  event: string;
  description?: string;
  target?: string;
  action?: string;
  childId?: string | null;
  meta?: Record<string, unknown>;
};

const GUEST_EVENTS_KEY = "buddy_clickstream";
const SESSION_KEY = "buddy_session_id";
const MAX_GUEST_EVENTS = 2000;

function isBrowser() {
  return typeof window !== "undefined";
}

export function getSessionId(): string {
  if (!isBrowser()) return "ssr";
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function readGuestEvents(): ClickEvent[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(window.localStorage.getItem(GUEST_EVENTS_KEY) ?? "[]") as ClickEvent[];
  } catch {
    return [];
  }
}

function writeGuestEvents(events: ClickEvent[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    GUEST_EVENTS_KEY,
    JSON.stringify(events.slice(-MAX_GUEST_EVENTS)),
  );
}

export function clearGuestEvents() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(GUEST_EVENTS_KEY);
}

function describe(input: TrackInput, userLabel: string) {
  if (input.description) return input.description;
  const bits = [`The user with id '${userLabel}'`, input.event.toLowerCase()];
  if (input.target) bits.push(`'${input.target}'`);
  bits.push(`in ${input.context}.`);
  return bits.join(" ");
}

/** Fire-and-forget: never blocks or breaks the UI. */
export async function track(input: TrackInput): Promise<void> {
  if (!isBrowser()) return;
  const session_id = getSessionId();
  const route = window.location.pathname;

  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    const row = {
      user_id: user?.id ?? null,
      child_id: input.childId && !input.childId.startsWith("guest-") ? input.childId : null,
      session_id,
      event_context: input.context,
      component: input.component,
      event_name: input.event,
      description: describe(input, user?.id ?? "guest"),
      origin: "web",
      target: input.target ?? null,
      action: input.action ?? null,
      route,
      meta: input.meta ?? {},
    };

    if (user) {
      const { error } = await supabase.from("learning_events").insert(row);
      if (!error) return;
    }

    // Guest / offline fallback
    const events = readGuestEvents();
    events.push({
      id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      occurred_at: new Date().toISOString(),
      ...row,
      child_id: input.childId ?? null,
    });
    writeGuestEvents(events);
  } catch {
    /* tracking must never break the app */
  }
}

/** Moodle-compatible CSV export. */
export function eventsToCsv(events: ClickEvent[]): string {
  const header = [
    "Time",
    "Event context",
    "Component",
    "Event name",
    "Description",
    "Origin",
    "Route",
    "Session",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = events.map((e) =>
    [
      new Date(e.occurred_at).toLocaleString(),
      e.event_context,
      e.component,
      e.event_name,
      e.description,
      e.origin,
      e.route ?? "",
      e.session_id,
    ]
      .map(esc)
      .join(","),
  );
  return [header.map(esc).join(","), ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  if (!isBrowser()) return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateStory } from "@/lib/story.functions";
import { toast } from "sonner";
import { track } from "@/lib/clickstream";
import buddyOwl from "@/assets/buddy-owl.png";

export const Route = createFileRoute("/_authenticated/story/$childId")({
  component: StoryPage,
});

const THEMES = ["Space", "Dinosaurs", "Pirates", "Magic", "Animals", "Under the sea"];

type Story = { title: string; emoji: string; paragraphs: string[] };

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.8;
  u.pitch = 1.1;
  window.speechSynthesis.speak(u);
}

function guestChildName(childId: string): string {
  try {
    const raw = localStorage.getItem("buddy_guest_children");
    if (!raw) return "Buddy";
    const list = JSON.parse(raw) as Array<{ id: string; name: string }>;
    return list.find((c) => c.id === childId)?.name || "Buddy";
  } catch {
    return "Buddy";
  }
}

function guestStory(theme: string, childId: string): Story {
  const name = guestChildName(childId);
  const t = theme || "Animals";
  const themeMap: Record<string, { emoji: string; setting: string; friend: string; thing: string }> = {
    Space: { emoji: "🚀", setting: "in a big red ship", friend: "a small green alien", thing: "a shiny star" },
    Dinosaurs: { emoji: "🦖", setting: "in a green land", friend: "a tiny dino", thing: "a big egg" },
    Pirates: { emoji: "🏴‍☠️", setting: "on a fast ship", friend: "a wise parrot", thing: "a gold map" },
    Magic: { emoji: "✨", setting: "in a tall tower", friend: "a kind cat", thing: "a magic hat" },
    Animals: { emoji: "🐶", setting: "in the park", friend: "a big dog", thing: "a red ball" },
    "Under the sea": { emoji: "🐠", setting: "deep in the sea", friend: "a pink fish", thing: "a pearl" },
  };
  const m = themeMap[t] || themeMap.Animals;
  return {
    title: `${name} and the ${t}`,
    emoji: m.emoji,
    paragraphs: [
      `${name} ran fast. ${name} got ${m.setting}. The sun was hot and the sky was blue.`,
      `${name} met ${m.friend}. They sat and had a chat. "Can you help me?" said the friend. "Yes!" said ${name}.`,
      `They went to find ${m.thing}. It was a long trip. But ${name} did not stop.`,
      `At last ${name} got ${m.thing}. The friend gave ${name} a big hug. ${name} went home with a smile. The end.`,
    ],
  };
}

function StoryPage() {
  const { childId } = Route.useParams();
  const make = useServerFn(generateStory);
  const [theme, setTheme] = useState<string>("");
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const isGuest = childId.startsWith("guest-");

  const create = useCallback(
    async (t: string) => {
      setTheme(t);
      setLoading(true);
      setStory(null);
      try {
        if (isGuest) {
          await new Promise((r) => setTimeout(r, 400));
          setStory(guestStory(t, childId));
        } else {
          const res = await make({ data: { childId, theme: t || undefined } });
          setStory(res);
        }
      } catch {
        toast.error("Buddy couldn't write a story. Using a backup story!");
        setStory(guestStory(t, childId));
      } finally {
        setLoading(false);
      }
    },
    [childId, make, isGuest],
  );


  useEffect(() => {
    track({ context: "Course: Story studio", component: "Story", event: "Story studio viewed" });
  }, []);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-fun">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 text-primary-foreground">
        <Link to="/dashboard" className="font-bold underline-offset-4 hover:underline">← Exit</Link>
        <span className="font-display text-lg font-bold">Story Studio</span>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-16">
        <div className="rounded-[2rem] bg-card p-8 shadow-pop">
          {!story && !loading && (
            <div className="text-center">
              <img src={buddyOwl} alt="Buddy" className="mx-auto h-20 w-20 animate-float" />
              <h1 className="mt-3 text-2xl font-bold">Pick a story idea ✨</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Buddy will write a story just for your child using words they can read.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => create(t)}
                    className="rounded-2xl border-2 border-border bg-background px-4 py-4 font-bold transition-transform hover:scale-105 hover:border-primary"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                onClick={() => create("")}
                className="mt-5 rounded-full bg-gradient-warm px-8 py-3 font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
              >
                🎲 Surprise me
              </button>
            </div>
          )}

          {loading && (
            <div className="py-16 text-center">
              <img src={buddyOwl} alt="Buddy" className="mx-auto h-24 w-24 animate-wiggle" />
              <p className="mt-4 font-bold">Buddy is writing your {theme || "story"}…</p>
            </div>
          )}

          {story && (
            <div className="animate-pop-in">
              <div className="text-center text-6xl">{story.emoji}</div>
              <h1 className="mt-2 text-center text-3xl font-bold">{story.title}</h1>
              <div className="mt-6 space-y-3 text-lg leading-relaxed">
                {story.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => speak(`${story.title}. ${story.paragraphs.join(" ")}`)}
                  className="rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
                >
                  🔊 Read to me
                </button>
                <button
                  onClick={() => setStory(null)}
                  className="rounded-full border-2 border-border px-6 py-3 font-bold transition-transform hover:scale-105"
                >
                  New story
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

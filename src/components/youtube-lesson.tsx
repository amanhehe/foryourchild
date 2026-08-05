import { useEffect, useRef } from "react";

type Props = {
  videoId: string;
  title: string;
  /** Called with an event name + player position, for clickstream logging. */
  onEvent: (
    event: string,
    action: string,
    meta: { position: number; percent: number },
  ) => void;
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<any> | null = null;

function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

/**
 * YouTube teaching video with full clickstream instrumentation
 * (play / pause / seek / 25-50-75% progress / complete).
 */
export function YouTubeLesson({ videoId, title, onEvent }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let player: any;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    const seen = new Set<number>();
    let last = 0;

    function pos(): { position: number; percent: number } {
      try {
        const t = player?.getCurrentTime?.() ?? 0;
        const d = player?.getDuration?.() ?? 0;
        return { position: Math.round(t), percent: d ? Math.round((t / d) * 100) : 0 };
      } catch {
        return { position: 0, percent: 0 };
      }
    }

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      player = new YT.Player(hostRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e: any) => {
            if (e.data === YT.PlayerState.PLAYING) {
              onEventRef.current("Video played", "play", pos());
            } else if (e.data === YT.PlayerState.PAUSED) {
              onEventRef.current("Video paused", "pause", pos());
            } else if (e.data === YT.PlayerState.ENDED) {
              onEventRef.current("Video completed", "complete", pos());
            }
          },
        },
      });

      timer = setInterval(() => {
        const p = pos();
        if (Math.abs(p.position - last) > 2 && last !== 0) {
          onEventRef.current("Video seeked", "seek", p);
        }
        last = p.position;
        for (const m of [25, 50, 75]) {
          if (p.percent >= m && !seen.has(m)) {
            seen.add(m);
            onEventRef.current(`Video ${m}% reached`, "progress", { ...p, percent: m });
          }
        }
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        player?.destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, [videoId]);

  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-pop">
      <div className="aspect-video w-full">
        <div ref={hostRef} title={title} className="h-full w-full" />
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import buddyOwl from "@/assets/buddy-owl.png";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  { icon: "🎤", title: "Listens & corrects", text: "Buddy hears every sound your child makes and gently fixes pronunciation in real time." },
  { icon: "🧠", title: "Adapts to your child", text: "Lessons get easier or harder automatically based on how each phoneme is mastered." },
  { icon: "📖", title: "Infinite stories", text: "AI writes brand-new stories using only the sounds your child is practising right now." },
  { icon: "📊", title: "Clear progress", text: "Parents see exactly which sound to focus on next — in plain English, not a vague score." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <img src={buddyOwl} alt="Buddy the owl" width={40} height={40} className="h-10 w-10" />
          <span className="font-display text-xl font-bold">AI Phonics Buddy</span>
        </div>
        <Link
          to="/auth"
          className="rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground shadow-soft transition-transform hover:scale-105"
        >
          Log in
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-2 md:py-20">
        <div className="text-center md:text-left">
          <span className="inline-block rounded-full bg-secondary px-4 py-1 text-sm font-bold text-secondary-foreground">
            For little readers, ages 4–8
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
            A reading coach that <span className="text-primary">actually listens</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Most phonics apps only play sounds. Buddy listens to your child read, catches
            pronunciation mistakes sound-by-sound, and turns practice into an adventure.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row md:items-start">
            <Link
              to="/auth"
              className="w-full rounded-full bg-gradient-warm px-8 py-4 text-center text-lg font-bold text-primary-foreground shadow-pop transition-transform hover:scale-105 sm:w-auto"
            >
              Start free →
            </Link>
            <Link
              to="/auth"
              className="w-full rounded-full border-2 border-border bg-card px-8 py-4 text-center text-lg font-bold transition-transform hover:scale-105 sm:w-auto"
            >
              I'm a teacher
            </Link>
          </div>
        </div>
        <div className="relative flex justify-center">
          <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-hero opacity-20 blur-3xl" />
          <img
            src={buddyOwl}
            alt="Buddy the friendly owl mascot waving"
            width={420}
            height={420}
            className="w-72 animate-float drop-shadow-2xl md:w-96"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="text-center text-3xl font-bold md:text-4xl">Why families love Buddy</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-3xl border-2 border-border bg-card p-6 shadow-soft transition-transform hover:-translate-y-1"
            >
              <div className="text-4xl">{f.icon}</div>
              <h3 className="mt-3 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 text-center">
        <div className="rounded-[2.5rem] bg-gradient-fun p-10 text-primary-foreground shadow-pop">
          <h2 className="text-3xl font-bold md:text-4xl">Ready to hear your child read?</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg opacity-90">
            Create a free parent account, add your children, and let Buddy do the listening.
          </p>
          <Link
            to="/auth"
            className="mt-7 inline-block rounded-full bg-card px-8 py-4 text-lg font-bold text-foreground shadow-soft transition-transform hover:scale-105"
          >
            Get started free
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Made with care for little readers · AI Phonics Buddy
      </footer>
    </div>
  );
}

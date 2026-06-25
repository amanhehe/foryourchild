import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import buddyOwl from "@/assets/buddy-owl.png";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("That took too long. Check your connection and try again.")),
        15000,
      ),
    );

    try {
      if (mode === "signup") {
        const { error } = await Promise.race([
          supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin + "/dashboard",
              data: { full_name: name },
            },
          }),
          timeout,
        ]);
        if (error) throw error;
        toast.success("Welcome to Buddy! 🦉");
      } else {
        const { error } = await Promise.race([
          supabase.auth.signInWithPassword({ email, password }),
          timeout,
        ]);
        if (error) throw error;
      }

      // Make sure the session is actually stored before navigating,
      // otherwise the dashboard guard can bounce us back to login.
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) throw new Error("Couldn't start your session. Please try again.");

      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-5 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-card p-8 shadow-pop">
        <div className="flex flex-col items-center text-center">
          <img src={buddyOwl} alt="Buddy" width={80} height={80} className="h-20 w-20 animate-float" />
          <h1 className="mt-3 text-2xl font-bold">
            {mode === "login" ? "Welcome back!" : "Create your parent account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? "Log in to see your children's progress" : "Set up Buddy for your family"}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border-2 border-border bg-card py-3 font-bold transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/></svg>
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="flex flex-col gap-3">
          {mode === "signup" && (
            <input
              type="text"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border-2 border-input bg-background px-4 py-3 outline-none focus:border-primary"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border-2 border-input bg-background px-4 py-3 outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border-2 border-input bg-background px-4 py-3 outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-full bg-gradient-warm py-3 text-lg font-bold text-primary-foreground shadow-soft transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem("buddy_guest", "1");
            navigate({ to: "/dashboard" });
          }}
          className="mt-4 w-full rounded-full py-3 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip for now → explore the prototype
        </button>

        <p className="mt-3 text-center text-sm text-muted-foreground">
          {mode === "login" ? "New to Buddy?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="font-bold text-primary"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}

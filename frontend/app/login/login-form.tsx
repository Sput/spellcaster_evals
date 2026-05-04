"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [{ supabase, configError }] = useState(() => {
    try {
      return { supabase: createClient(), configError: "" };
    } catch (err) {
      return {
        supabase: null,
        configError: err instanceof Error ? err.message : "Supabase is not configured",
      };
    }
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEmail("");
    setPassword("");
  }, []);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace("/run-eval");
    router.refresh();
  }

  return (
    <form className="auth-form" autoComplete="off" onSubmit={handleSignIn}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <button type="submit" disabled={isSubmitting || !supabase}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
      {(error || configError) && <p className="warn">{error || configError}</p>}
    </form>
  );
}

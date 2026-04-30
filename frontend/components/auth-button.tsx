"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function AuthButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
    } catch {
      setIsReady(true);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setIsReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? "");
      setIsReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setIsSigningOut(false);
      return;
    }
    setEmail("");
    router.replace("/login");
    router.refresh();
  }

  if (!isReady) {
    return null;
  }

  if (!email) {
    return (
      <Link
        href={`/login?redirectTo=${encodeURIComponent(pathname)}` as Route}
        className="app-nav__link app-nav__link--auth"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="app-nav__session">
      <span title={email}>{email}</span>
      <button className="app-nav__button" type="button" onClick={signOut} disabled={isSigningOut}>
        Sign Out
      </button>
    </div>
  );
}

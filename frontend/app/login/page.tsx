import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <section className="auth-shell">
      <div className="card auth-card">
        <h2>Sign in</h2>
        <p>Use your Supabase account credentials to access the eval lab.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}

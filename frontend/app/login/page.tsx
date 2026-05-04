import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <section className="auth-shell">
      <div className="card auth-card">
        <h2>Sign in</h2>
        <p>
          For login credentials, please email me at paulknick at gmail dot com.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}

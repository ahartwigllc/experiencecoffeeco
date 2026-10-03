import type { Metadata } from "next";
import { Flash } from "@/components/admin/Flash";
import { signIn } from "../actions/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="login-shell">
      <form className="login-card" action={signIn}>
        <p className="wordmark" style={{ marginTop: 0 }}>
          Experience Coffee
        </p>
        <h1 style={{ fontSize: "1.4rem" }}>Sign in to the back office</h1>
        <Flash error={error} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn btn-block" type="submit">
          Sign in
        </button>
      </form>
    </div>
  );
}

import type { Metadata } from "next";
import { Flash } from "@/components/admin/Flash";
import { setupOwner } from "../actions/auth";

export const metadata: Metadata = { title: "First-time setup" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="login-shell">
      <form className="login-card" action={setupOwner}>
        <h1 style={{ fontSize: "1.4rem" }}>Create the owner account</h1>
        <p className="small muted">This only works once, while no accounts exist, and needs the SETUP_TOKEN from your environment settings.</p>
        <Flash error={error} />
        <div className="field">
          <label htmlFor="token">Setup token</label>
          <input id="token" name="token" type="password" required />
        </div>
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" type="text" required />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password (12+ characters)</label>
          <input id="password" name="password" type="password" minLength={12} autoComplete="new-password" required />
        </div>
        <button className="btn btn-block" type="submit">
          Create account
        </button>
      </form>
    </div>
  );
}

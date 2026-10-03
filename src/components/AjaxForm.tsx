"use client";

import { useState } from "react";

/**
 * Posts a form to a JSON API route and shows the response message inline.
 * Works for newsletter, contact, and sign-in link forms.
 */
export function AjaxForm({
  action,
  submitLabel,
  pendingLabel = "Sending…",
  className,
  children,
  inline = false,
}: {
  action: string;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  const [state, setState] = useState<{ status: "idle" | "pending" | "ok" | "error"; message?: string }>({ status: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setState({ status: "pending" });
    try {
      const res = await fetch(action, { method: "POST", body: new FormData(form) });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setState({ status: "error", message: data.error || "Something went wrong. Try again." });
        return;
      }
      form.reset();
      setState({ status: "ok", message: data.message || "Done." });
    } catch {
      setState({ status: "error", message: "You appear to be offline. Try again." });
    }
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate={false}>
      <div className={inline ? "inline-form" : undefined}>
        {children}
        <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
        <button className="btn" type="submit" disabled={state.status === "pending"}>
          {state.status === "pending" ? pendingLabel : submitLabel}
        </button>
      </div>
      <p className={`form-message ${state.status === "error" ? "error" : ""}`} role="status" aria-live="polite">
        {state.message ?? ""}
      </p>
    </form>
  );
}

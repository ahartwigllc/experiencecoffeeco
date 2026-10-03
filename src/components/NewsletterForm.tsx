import { AjaxForm } from "./AjaxForm";

export function NewsletterForm({ source = "website", className }: { source?: string; className?: string }) {
  return (
    <AjaxForm action="/api/newsletter" submitLabel="Sign up" pendingLabel="Signing up…" inline className={className}>
      <label htmlFor={`nl-${source}`} className="sr-only">
        Email address
      </label>
      <input id={`nl-${source}`} type="email" name="email" placeholder="you@example.com" autoComplete="email" required />
      <input type="hidden" name="source" value={source} />
    </AjaxForm>
  );
}

import type { Metadata } from "next";
import { unsubscribe } from "./actions";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; s?: string; result?: string }>;
}) {
  const { e, s, result } = await searchParams;
  return (
    <div className="wrap narrow">
      <div className="page-head">
        <h1>{result === "ok" ? "You're unsubscribed" : "Unsubscribe from emails"}</h1>
      </div>
      {result === "ok" ? (
        <p className="lede">You won't get marketing emails from us anymore. Order receipts will still arrive when you buy something.</p>
      ) : result === "invalid" || !e || !s ? (
        <p>This unsubscribe link doesn't work. Reply to any of our emails and we'll remove you by hand.</p>
      ) : (
        <form action={unsubscribe}>
          <input type="hidden" name="e" value={e} />
          <input type="hidden" name="s" value={s} />
          <p>Stop receiving news and new-lot emails from Experience Coffee?</p>
          <button className="btn" type="submit">
            Unsubscribe
          </button>
        </form>
      )}
    </div>
  );
}

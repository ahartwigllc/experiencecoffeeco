import type { Metadata } from "next";
import Link from "next/link";
import { confirmSubscription } from "./actions";

export const metadata: Metadata = { title: "Confirm sign-up", robots: { index: false } };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string; result?: string }> }) {
  const { token, result } = await searchParams;
  return (
    <div className="wrap narrow">
      <div className="page-head">
        <h1>{result === "ok" ? "You're on the list" : "Confirm your sign-up"}</h1>
      </div>
      {result === "ok" ? (
        <>
          <p className="lede">Thanks. We'll email you when new lots land.</p>
          <Link className="btn" href="/shop">
            See what's roasting
          </Link>
        </>
      ) : result === "invalid" ? (
        <p>This confirmation link has already been used or doesn't work. Sign up again from the bottom of any page.</p>
      ) : token ? (
        <form action={confirmSubscription}>
          <input type="hidden" name="token" value={token} />
          <button className="btn btn-cherry" type="submit">
            Yes, sign me up
          </button>
        </form>
      ) : (
        <p>This link is missing its code. Sign up again from the bottom of any page.</p>
      )}
    </div>
  );
}

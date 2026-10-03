import type { Metadata } from "next";
import { verifyMagicLink } from "../actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="wrap narrow">
      <div className="page-head">
        <h1>Sign in</h1>
      </div>
      {token ? (
        <form action={verifyMagicLink}>
          <input type="hidden" name="token" value={token} />
          <button className="btn btn-cherry" type="submit">
            Continue to your account
          </button>
        </form>
      ) : (
        <p>This link is missing its code. Request a new one from the account page.</p>
      )}
    </div>
  );
}

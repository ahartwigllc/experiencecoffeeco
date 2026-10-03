/**
 * Creates or resets an owner account from the command line.
 *   npm run admin:create -- you@example.com "Andrew Hartwig" "a-long-password"
 * (Alternative with no terminal: set SETUP_TOKEN and visit /admin/setup once.)
 */
import * as schema from "../src/db/schema";
import { hashPassword } from "../src/lib/crypto";
import { connect } from "./db";

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password || password.length < 12) {
    console.error('Usage: npm run admin:create -- email "Full Name" "password of 12+ characters"');
    process.exit(1);
  }
  const { db, close } = connect();
  const passwordHash = await hashPassword(password);
  await db
    .insert(schema.staff)
    .values({ email: email.toLowerCase(), name, role: "owner", passwordHash })
    .onConflictDoUpdate({ target: schema.staff.email, set: { passwordHash, role: "owner", active: true, name } });
  console.log(`Owner account ready: ${email}. Sign in at /admin/login.`);
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

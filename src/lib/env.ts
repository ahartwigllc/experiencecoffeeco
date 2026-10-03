/** Central place for environment access, with clear errors when something is missing. */
export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function appTimezone(): string {
  return process.env.APP_TIMEZONE || "America/New_York";
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. See .env.example and docs/DEPLOYMENT.md.`);
  return v;
}

export function sessionSecret(): string {
  const v = requireEnv("SESSION_SECRET");
  if (v.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  return v;
}

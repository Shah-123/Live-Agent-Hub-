/**
 * TEMPORARY diagnostic endpoint — delete once /api/healthz is confirmed green.
 *
 * Imports nothing from the app, so it runs even while the main API function
 * crashes on a missing variable. Reports only whether the expected variable
 * NAMES are visible to a Vercel Function, never their values, which tells
 * "not set at all" apart from "set under a slightly different name".
 */
const EXPECTED = [
  "DATABASE_URL",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
];

const RELATED = /DATABASE|POSTGRES|OPENAI|AI_INTEGRATIONS|SUPABASE/i;

export default function handler(_req, res) {
  const present = {};
  for (const name of EXPECTED) {
    const v = process.env[name];
    present[name] = typeof v === "string" && v.length > 0;
  }

  // Names only. A key padded with whitespace or misspelled shows up here
  // while its EXPECTED counterpart reads false.
  const relatedKeys = Object.keys(process.env)
    .filter((k) => RELATED.test(k))
    .map((k) => JSON.stringify(k))
    .sort();

  let databaseUrlShape = null;
  if (present.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      databaseUrlShape = {
        protocol: u.protocol,
        host: u.hostname,
        port: u.port || "(default)",
        isSupabasePooler: u.hostname.endsWith("pooler.supabase.com"),
      };
    } catch (err) {
      databaseUrlShape = { parseError: err.message };
    }
  }

  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.status(200).end(
    JSON.stringify({ vercelEnv: process.env.VERCEL_ENV ?? null, present, relatedKeys, databaseUrlShape }, null, 2),
  );
}

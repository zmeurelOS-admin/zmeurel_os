// scripts/check-env.js

// đź”ą ĂŽncarcÄ .env.local explicit
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' });

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SITE_URL",
];

const missing = required.filter(
  (k) => !process.env[k] || String(process.env[k]).trim() === ""
);

if (missing.length > 0) {
  console.error("\nâťŚ Lipsesc variabile de mediu necesare pentru Supabase:");
  for (const k of missing) console.error(" - " + k);

  console.error("\nâś… Fix: completeazÄ fiČ™ierul .env.local din rÄdÄcina proiectului cu:");
  console.error("NEXT_PUBLIC_SUPABASE_URL=...");
  console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY=...\n");
  console.error("SITE_URL=...\n");

  process.exit(1);
}

if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL !== process.env.SITE_URL) {
  console.warn(
    "âš ď¸Ź NEXT_PUBLIC_SITE_URL differs from SITE_URL. OAuth and email redirects can point to the wrong origin."
  );
}

console.log("âś… Env vars ok:", required.join(", "));

if (process.env.VERCEL === "1" && (!process.env.SENTRY_AUTH_TOKEN || String(process.env.SENTRY_AUTH_TOKEN).trim() === "")) {
  console.warn(
    "[check-env] SENTRY_AUTH_TOKEN lipsește pe Vercel — upload-ul de source maps către Sentry la build poate eșua (vezi next.config.js + withSentryConfig)."
  );
}

if (process.env.VERCEL === "1" && (!process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET || String(process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET).trim() === "")) {
  console.warn(
    "[check-env] DESTRUCTIVE_ACTION_STEP_UP_SECRET lipsește pe Vercel — rutele destructive (GDPR/reset) vor respinge step-up auth."
  );
}

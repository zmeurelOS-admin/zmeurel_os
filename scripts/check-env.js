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


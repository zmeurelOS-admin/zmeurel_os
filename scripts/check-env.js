// scripts/check-env.js — rulează înainte de `next build` (`prebuild`).

// Încarcă .env.local explicit (local); pe Vercel variabilele vin din proiect.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' });

const DEFAULT_APP_URL = 'https://caietulfermei.ro';

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SITE_URL'];

const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');

if (missing.length > 0) {
  console.error('\n❌ Lipsesc variabile de mediu necesare pentru Supabase:');
  for (const k of missing) console.error(' - ' + k);

  console.error('\n✅ Fix: completează fișierul .env.local din rădăcina proiectului cu:');
  console.error('NEXT_PUBLIC_SUPABASE_URL=...');
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=...');
  console.error('SITE_URL=...\n');

  process.exit(1);
}

/**
 * Aceeași regulă ca `originValida` din `src/lib/brand.ts` (promptul 33): după `trim`, un URL `http:` / `https:`
 * valid, fără utilizator și parolă, cu un host care conține un punct; `localhost` / `127.0.0.1` doar în afara
 * producției (`VERCEL_ENV=production`). Întoarce originea sau `null`.
 */
function originValida(value, productie) {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/^["']+|["']+$/g, '').trim();
  if (!text) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return productie ? null : url.origin;
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null;
  return url.origin && url.origin !== 'null' ? url.origin : null;
}

const productie = String(process.env.VERCEL_ENV || '').trim() === 'production';

// Avertizare, nu eșec: aplicația folosește oricum adresa implicită. Se afișează doar aceste două variabile.
for (const nume of ['NEXT_PUBLIC_SITE_URL', 'SITE_URL']) {
  const valoare = process.env[nume];
  if (valoare === undefined || String(valoare).trim() === '') continue;
  if (!originValida(valoare, productie)) {
    console.warn(
      `⚠️ ${nume}=${JSON.stringify(valoare)} nu e o adresă validă (https://host cu punct${productie ? '' : ' sau localhost'}). ` +
        `Se folosește în loc: ${DEFAULT_APP_URL}`,
    );
  }
}

const site = originValida(process.env.SITE_URL, productie);
const sitePublic = originValida(process.env.NEXT_PUBLIC_SITE_URL, productie);
if (site && sitePublic && site !== sitePublic) {
  console.warn(
    '⚠️ NEXT_PUBLIC_SITE_URL diferă de SITE_URL. Linkurile de după login și cele din e-mailuri pot duce pe altă adresă.',
  );
}

console.log('✅ Variabilele de mediu sunt în regulă:', required.join(', '));

if (
  process.env.VERCEL === '1' &&
  (!process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET || String(process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET).trim() === '')
) {
  console.warn(
    '[check-env] DESTRUCTIVE_ACTION_STEP_UP_SECRET lipsește pe Vercel — rutele destructive (GDPR/reset) vor respinge step-up auth.',
  );
}

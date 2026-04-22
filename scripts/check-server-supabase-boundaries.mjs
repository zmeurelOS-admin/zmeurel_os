import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const extensions = ['.ts', '.tsx', '.js', '.jsx'];
const forbiddenFile = normalizePath(path.join(srcDir, 'lib', 'supabase', 'client.ts'));

const serverMarkers = [
  '@/lib/supabase/server',
  '@/lib/supabase/admin',
  'next/headers',
  'next/cookies',
];

function normalizePath(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function toRepoPath(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') {
      continue;
    }

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(entryPath));
      continue;
    }

    if (extensions.includes(path.extname(entry.name))) {
      files.push(normalizePath(entryPath));
    }
  }

  return files;
}

function hasUseClientDirective(text) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) {
      continue;
    }

    return /^['"]use client['"];?$/.test(line);
  }

  return false;
}

function parseRuntimeImports(text) {
  const imports = [];
  const importFromPattern = /\bimport\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g;
  const exportFromPattern = /\bexport\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g;
  const sideEffectImportPattern = /\bimport\s*['"]([^'"]+)['"]/g;
  const dynamicImportPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match;
  while ((match = importFromPattern.exec(text)) !== null) {
    if (!isTypeOnlyClause(match[1])) {
      imports.push(match[2]);
    }
  }

  while ((match = exportFromPattern.exec(text)) !== null) {
    if (!isTypeOnlyClause(match[1])) {
      imports.push(match[2]);
    }
  }

  while ((match = sideEffectImportPattern.exec(text)) !== null) {
    imports.push(match[1]);
  }

  while ((match = dynamicImportPattern.exec(text)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function isTypeOnlyClause(rawClause) {
  const clause = rawClause.trim();
  if (clause.startsWith('type ')) {
    return true;
  }

  const namedOnly = clause.match(/^\{\s*([\s\S]*?)\s*\}$/);
  if (!namedOnly) {
    return false;
  }

  const specifiers = namedOnly[1]
    .split(',')
    .map((specifier) => specifier.trim())
    .filter(Boolean);

  return specifiers.length > 0 && specifiers.every((specifier) => specifier.startsWith('type '));
}

function resolveImport(fromFile, specifier) {
  if (specifier.startsWith('@/')) {
    return resolveCandidate(path.join(srcDir, specifier.slice(2)));
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return resolveCandidate(path.resolve(path.dirname(fromFile), specifier));
  }

  return null;
}

function resolveCandidate(basePath) {
  const normalizedBase = normalizePath(basePath);

  if (extensions.includes(path.extname(normalizedBase)) && fs.existsSync(normalizedBase)) {
    return normalizedBase;
  }

  for (const extension of extensions) {
    const withExtension = `${normalizedBase}${extension}`;
    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  for (const extension of extensions) {
    const indexFile = path.join(normalizedBase, `index${extension}`);
    if (fs.existsSync(indexFile)) {
      return normalizePath(indexFile);
    }
  }

  return null;
}

const files = walk(srcDir);
const moduleInfo = new Map(
  files.map((file) => {
    const text = readText(file);
    return [
      file,
      {
        text,
        useClient: hasUseClientDirective(text),
        imports: parseRuntimeImports(text).map((specifier) => resolveImport(file, specifier)).filter(Boolean),
      },
    ];
  }),
);

function isServerSeed(file) {
  const info = moduleInfo.get(file);
  if (!info || info.useClient) {
    return false;
  }

  const repoPath = toRepoPath(file);
  if (/^src\/app\/.*\/(page|layout|route|actions)\.(ts|tsx)$/.test(repoPath)) {
    return true;
  }

  return repoPath.startsWith('src/lib/') && serverMarkers.some((marker) => info.text.includes(marker));
}

function findForbiddenChains(seed) {
  const chains = [];
  const visited = new Set();

  function visit(file, chain) {
    if (file === forbiddenFile) {
      chains.push(chain);
      return;
    }

    if (visited.has(file)) {
      return;
    }
    visited.add(file);

    const info = moduleInfo.get(file);
    if (!info) {
      return;
    }

    if (chain.length > 1 && info.useClient) {
      return;
    }

    for (const importedFile of info.imports) {
      visit(importedFile, [...chain, importedFile]);
    }
  }

  visit(seed, [seed]);
  return chains;
}

const seeds = files.filter(isServerSeed);
const findings = [];

for (const seed of seeds) {
  for (const chain of findForbiddenChains(seed)) {
    findings.push(chain);
  }
}

if (findings.length > 0) {
  console.error('[server-supabase-boundaries] Browser Supabase client reached from server-side code.\n');
  for (const chain of findings) {
    console.error(chain.map((file) => `  - ${toRepoPath(file)}`).join('\n'));
    console.error('');
  }
  console.error('Fix: use src/lib/supabase/server.ts in server code, or move browser-only access behind a client component boundary.');
  process.exit(1);
}

console.log(
  `[server-supabase-boundaries] OK — scanned ${seeds.length} server entry/helper seed(s); no runtime path to src/lib/supabase/client.ts.`,
);

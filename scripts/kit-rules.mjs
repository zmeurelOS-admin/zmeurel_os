import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Regulile kitului de componente (docs/redesign/tokens.md, CLAUDE.md).
 * Folderele modulelor refăcute se adaugă pe listă pe rând.
 */
export const KIT_RULE_DIRS = [
  'src/components/kit',
  'src/app/(dashboard)/admin/kit',
  // Recoltări (modul pilot)
  'src/app/(dashboard)/recoltari',
  'src/components/recoltari',
  // Comenzi
  'src/app/(dashboard)/comenzi',
  'src/components/comenzi',
  'src/lib/comenzi',
  // Livrări
  'src/app/(dashboard)/livrari',
  'src/components/livrari',
  'src/lib/livrari',
  // Acasă pe telefon (grila de desktop din `components/dashboard` nu e refăcută)
  'src/components/acasa',
  // Clienți, Culegători și secțiunile noi din Setări
  'src/app/(dashboard)/clienti',
  'src/components/clienti',
  'src/lib/clienti',
  'src/app/(dashboard)/culegatori',
  'src/components/culegatori',
  'src/lib/culegatori',
  'src/components/setari',
  // Cheltuieli + Investiții (o pagină, două file) și Vânzări
  'src/app/(dashboard)/cheltuieli',
  'src/app/(dashboard)/investitii',
  'src/components/cheltuieli',
  'src/lib/financial',
  'src/lib/bonuri',
  'src/app/(dashboard)/vanzari',
  'src/components/vanzari',
  'src/lib/vanzari',
  // Mai mult, Notificări, Setări (ecranele; `src/components/setari` e deja mai sus)
  'src/app/(dashboard)/mai-mult',
  'src/app/(dashboard)/notificari',
  'src/app/(dashboard)/settings',
  // Logica din spatele ecranelor refăcute: Recoltări, Setări (profilul fermei, exportul) și Acasă pe telefon.
  // `src/components/notifications` și `src/lib/notifications/config.ts` rămân afară: clopoțelul și bannerul
  // de pe desktop nu sunt refăcute, iar culorile hex din config merg în notificările push, nu în CSS.
  'src/lib/recoltari',
  'src/lib/setari',
  'src/lib/dashboard',
  // Tratamente (stropiri, fertirigare, pauza)
  'src/app/(dashboard)/tratamente',
  'src/components/tratamente',
  'src/lib/tratamente',
  // Stocuri, Produse, Rapoarte (prompt 19)
  'src/app/(dashboard)/stocuri',
  'src/components/stocuri',
  'src/lib/stocuri',
  'src/app/(dashboard)/produse',
  'src/components/produse',
  'src/lib/produse',
  'src/app/(dashboard)/rapoarte',
  'src/components/rapoarte',
  'src/lib/rapoarte',
  // Parcele și Lucrări (prompt 20; fostele Activități agricole)
  'src/app/(dashboard)/lucrari',
  'src/components/lucrari',
  'src/lib/lucrari',
]

/**
 * Fișiere vechi dintr-un folder deja verificat, folosite încă de un modul nerefăcut.
 * Se scot de aici când modulul respectiv e refăcut.
 * - Echipa rămâne pe ecranul ei de dinainte (prompt 13: Setări s-a refăcut, Echipa nu).
 */
export const KIT_RULE_PENDING_FILES = [
  'src/app/(dashboard)/settings/echipa/EchipaClient.tsx',
  // Produse: formularele vechi cu poze și blocul de asociație, nefolosite până la magazinul nou (prompt 19).
  'src/components/produse/AddProdusDialog.tsx',
  'src/components/produse/EditProdusDialog.tsx',
  'src/components/produse/ProductAssociationOfferBlock.tsx',
  'src/components/produse/ProdusFormSummary.tsx',
]

const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'])
const EXCLUDED_PATH_PATTERNS = [/\/__tests__\//, /\.test\.[cm]?[jt]sx?$/]

/** Sub 13 px nu se scrie nimic. */
const MIN_TEXT_PX = 13
const MIN_TEXT_REM = MIN_TEXT_PX / 16
/** De la 40 în sus începe scara de straturi (z-bar, z-nav, z-fab, …). */
const MIN_LAYER_Z = 40

const SIMPLE_RULES = [
  {
    rule: 'hex',
    regex: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
    message: 'Culoare hex scrisă direct. Folosește clasele de tokeni (bg-surface, text-fg, …).',
  },
  {
    rule: 'dark-variant',
    regex: /(?<![\w-])dark:/g,
    message: 'Varianta `dark:` nu se folosește în kit: tokenii au deja valoare de noapte.',
  },
  {
    rule: 'legacy-token',
    regex: /--(?:agri-|text-primary(?![\w])|surface-card|status-|soft-)/g,
    message: 'Token vechi (alias). Folosește setul canonic din docs/redesign/tokens.md.',
  },
  {
    rule: 'text-xs',
    regex: /(?<![\w-])text-xs(?![\w-])/g,
    message: '`text-xs` are 12 px. Minimum 13 px (text-[13px]), doar pentru text ajutător.',
  },
  {
    rule: 'z-arbitrary',
    regex: /(?<![\w-])-?z-\[/g,
    message: 'z-index scris direct. Folosește clasele de strat (z-bar, z-nav, z-fab, z-overlay, z-modal, z-popover, z-toast).',
  },
  {
    rule: 'z-style',
    regex: /\bzIndex\b/g,
    message: '`zIndex` în `style`. Folosește clasele de strat.',
  },
]

function getLineNumber(content, index) {
  let line = 1
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1
  }
  return line
}

function getLinePreview(content, index) {
  const start = content.lastIndexOf('\n', index - 1) + 1
  const endIndex = content.indexOf('\n', index)
  const end = endIndex === -1 ? content.length : endIndex
  return content.slice(start, end).trim().slice(0, 160)
}

function pushFinding(findings, seen, filePath, content, index, rule, message) {
  const line = getLineNumber(content, index)
  const preview = getLinePreview(content, index)
  const key = `${filePath}:${line}:${rule}`
  if (seen.has(key)) return
  seen.add(key)
  findings.push({ filePath, line, rule, message, preview })
}

/** Funcție pură: primește textul unui fișier și întoarce abaterile. */
export function scanKitFileContent({ filePath, content }) {
  const findings = []
  const seen = new Set()

  for (const { rule, regex, message } of SIMPLE_RULES) {
    for (const match of content.matchAll(regex)) {
      pushFinding(findings, seen, filePath, content, match.index, rule, message)
    }
  }

  for (const match of content.matchAll(/(?<![\w-])text-\[(\d*\.?\d+)(px|rem|em)\]/g)) {
    const value = Number(match[1])
    const tooSmall = match[2] === 'px' ? value < MIN_TEXT_PX : value < MIN_TEXT_REM
    if (tooSmall) {
      pushFinding(
        findings,
        seen,
        filePath,
        content,
        match.index,
        'text-under-13',
        `Text sub ${MIN_TEXT_PX} px (${match[1]}${match[2]}). Scara: 26 / 22 / 19 / 17 / 15 / 13.`,
      )
    }
  }

  for (const match of content.matchAll(/(?<![\w-])-?z-(\d+)(?![\w-])/g)) {
    if (Number(match[1]) >= MIN_LAYER_Z) {
      pushFinding(
        findings,
        seen,
        filePath,
        content,
        match.index,
        'z-numeric',
        `z-${match[1]} e în zona scării de straturi. Folosește clasele de strat (z-bar, z-nav, z-fab, …).`,
      )
    }
  }

  return findings.sort((a, b) => a.line - b.line)
}

function normalizePath(value) {
  return value.split(path.sep).join('/')
}

function isRelevantFilePath(filePath) {
  if (!TEXT_EXTENSIONS.has(path.extname(filePath))) return false
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(filePath))
}

async function listFiles(rootDir, relativeDir) {
  let entries
  try {
    entries = await fs.readdir(path.join(rootDir, relativeDir), { withFileTypes: true })
  } catch {
    return []
  }
  const files = []
  for (const entry of entries) {
    const relativePath = normalizePath(path.join(relativeDir, entry.name))
    if (entry.isDirectory()) {
      files.push(...(await listFiles(rootDir, relativePath)))
    } else if (entry.isFile() && isRelevantFilePath(relativePath)) {
      files.push(relativePath)
    }
  }
  return files
}

export async function runKitRules({ rootDir, dirs = KIT_RULE_DIRS } = {}) {
  const root = rootDir ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const scannedFiles = []
  const findings = []

  const pending = new Set(KIT_RULE_PENDING_FILES)

  for (const dir of dirs) {
    for (const filePath of await listFiles(root, dir)) {
      if (pending.has(filePath)) continue
      const content = await fs.readFile(path.join(root, filePath), 'utf8')
      scannedFiles.push(filePath)
      findings.push(...scanKitFileContent({ filePath, content }))
    }
  }

  return { rootDir: root, dirs, scannedFiles, findings }
}

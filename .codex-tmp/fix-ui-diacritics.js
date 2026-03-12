const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SRC_DIR = path.resolve('src');

const replacements = [
  ['Activitati', 'Activități'],
  ['activitati', 'activități'],
  ['Adauga', 'Adaugă'],
  ['adauga', 'adaugă'],
  ['Agricultura', 'Agricultură'],
  ['Anuleaza', 'Anulează'],
  ['Cauta', 'Caută'],
  ['cauta', 'caută'],
  ['Cheltuiala', 'Cheltuială'],
  ['cheltuiala', 'cheltuială'],
  ['Confirma', 'Confirmă'],
  ['confirma', 'confirmă'],
  ['Creaza', 'Creează'],
  ['Culegatori', 'Culegători'],
  ['culegatori', 'culegători'],
  ['Editeaza', 'Editează'],
  ['editeaza', 'editează'],
  ['Evidenta', 'Evidența'],
  ['evidenta', 'evidența'],
  ['Ferma', 'Fermă'],
  ['ferma', 'fermă'],
  ['Inregistrare', 'Înregistrare'],
  ['inregistrare', 'înregistrare'],
  ['Inregistrari', 'Înregistrări'],
  ['Livrata', 'Livrată'],
  ['livrata', 'livrată'],
  ['Livrari', 'Livrări'],
  ['Locatie', 'Locație'],
  ['locatie', 'locație'],
  ['Locatii', 'Locații'],
  ['locatii', 'locații'],
  ['Manopera', 'Manoperă'],
  ['manopera', 'manoperă'],
  ['Observatii', 'Observații'],
  ['observatii', 'observații'],
  ['Parcela', 'Parcelă'],
  ['parcela', 'parcelă'],
  ['Pauza', 'Pauză'],
  ['pauza', 'pauză'],
  ['Productie', 'Producție'],
  ['productie', 'producție'],
  ['Recoltari', 'Recoltări'],
  ['recoltari', 'recoltări'],
  ['Salveaza', 'Salvează'],
  ['salveaza', 'salvează'],
  ['Saptamana', 'Săptămâna'],
  ['saptamana', 'săptămâna'],
  ['Selecteaza', 'Selectează'],
  ['selecteaza', 'selectează'],
  ['Sterge', 'Șterge'],
  ['sterge', 'șterge'],
  ['Stergere', 'Ștergere'],
  ['stergere', 'ștergere'],
  ['Suprafata', 'Suprafață'],
  ['suprafata', 'suprafață'],
  ['Taiere', 'Tăiere'],
  ['taiere', 'tăiere'],
  ['Vanzare', 'Vânzare'],
  ['vanzare', 'vânzare'],
  ['Vanzari', 'Vânzări'],
  ['vanzari', 'vânzări'],
  ['Butasi', 'Butași'],
  ['butasi', 'butași'],
];

const uiAttrNames = new Set([
  'title', 'subtitle', 'description', 'subheading', 'heading', 'label', 'placeholder',
  'aria-label', 'ariaLabel', 'alt', 'emptyTitle', 'emptyDescription', 'helperText',
  'cancelLabel', 'saveLabel', 'itemType', 'tooltip', 'text', 'caption'
]);

const uiPropNames = new Set([
  'title', 'subtitle', 'description', 'subheading', 'heading', 'label', 'placeholder',
  'ariaLabel', 'aria-label', 'emptyTitle', 'emptyDescription', 'helperText',
  'cancelLabel', 'saveLabel', 'itemType', 'message', 'text', 'caption', 'actionLabel'
]);

const uiVarPattern = /(title|subtitle|description|subheading|heading|label|placeholder|message|empty|caption|helper|tooltip|statusLabels|labels|options)$/i;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const regexps = replacements.map(([from, to]) => ({
  to,
  re: new RegExp(`\\b${escapeRegex(from)}\\b`, 'g'),
}));

function applyReplacements(text) {
  let next = text;
  for (const { re, to } of regexps) {
    next = next.replace(re, to);
  }
  return next;
}

function getPropName(nameNode) {
  if (!nameNode) return null;
  if (ts.isIdentifier(nameNode)) return nameNode.text;
  if (ts.isStringLiteral(nameNode)) return nameNode.text;
  if (ts.isNumericLiteral(nameNode)) return nameNode.text;
  if (ts.isComputedPropertyName(nameNode)) return null;
  return nameNode.getText();
}

function isUiVariable(node) {
  let cur = node;
  while (cur) {
    if (ts.isVariableDeclaration(cur) && ts.isIdentifier(cur.name)) {
      return uiVarPattern.test(cur.name.text);
    }
    cur = cur.parent;
  }
  return false;
}

function isTextualJsxAttrContext(node) {
  let cur = node;
  while (cur) {
    if (ts.isJsxAttribute(cur)) {
      const name = cur.name.getText();
      return uiAttrNames.has(name);
    }
    if (ts.isJsxElement(cur) || ts.isJsxSelfClosingElement(cur) || ts.isSourceFile(cur)) break;
    cur = cur.parent;
  }
  return false;
}

function isWithinUiProperty(node) {
  let cur = node;
  while (cur) {
    if (ts.isPropertyAssignment(cur)) {
      const key = getPropName(cur.name);
      if (key && uiPropNames.has(key)) return true;
    }
    if (ts.isSourceFile(cur)) break;
    cur = cur.parent;
  }
  return false;
}

function isToastOrErrorMessageArg(node) {
  const p = node.parent;
  if (ts.isNewExpression(p) && p.expression.getText() === 'Error') return true;
  if (ts.isCallExpression(p)) {
    const callee = p.expression.getText();
    if (/\btoast(\.|$)|\balert\b|\bconfirm\b|\bprompt\b/.test(callee)) return true;
  }
  return false;
}

function shouldProcessLiteral(node) {
  const p = node.parent;

  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return false;
  if (ts.isLiteralTypeNode(p)) return false;

  if (isTextualJsxAttrContext(node)) return true;
  if (isWithinUiProperty(node)) return true;
  if (isToastOrErrorMessageArg(node)) return true;
  if (isUiVariable(node)) return true;

  return false;
}

function collectFiles(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'types') continue; // avoid generated DB schema typings
      collectFiles(full, out);
    } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx')) && !full.endsWith('.d.ts')) {
      out.push(full);
    }
  }
}

function applyEdits(content, edits) {
  edits.sort((a, b) => b.start - a.start);
  let next = content;
  for (const e of edits) {
    next = next.slice(0, e.start) + e.text + next.slice(e.end);
  }
  return next;
}

const files = [];
collectFiles(SRC_DIR, files);

let changedFiles = 0;
let changedFragments = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];

  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = node.getText(source);
      const replaced = applyReplacements(text);
      if (replaced !== text) {
        edits.push({ start: node.getStart(source), end: node.getEnd(), text: replaced });
        changedFragments += 1;
      }
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (shouldProcessLiteral(node)) {
        const text = node.text;
        const replaced = applyReplacements(text);
        if (replaced !== text) {
          edits.push({ start: node.getStart(source) + 1, end: node.getEnd() - 1, text: replaced });
          changedFragments += 1;
        }
      }
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (isWithinUiProperty(node) || isToastOrErrorMessageArg(node) || isTextualJsxAttrContext(node) || isUiVariable(node)) {
        const text = node.text;
        const replaced = applyReplacements(text);
        if (replaced !== text) {
          let start = node.getStart(source);
          let end = node.getEnd();
          if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node)) {
            start += 1;
            end -= 2;
          } else {
            start += 1;
            end -= 1;
          }
          edits.push({ start, end, text: replaced });
          changedFragments += 1;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);

  if (edits.length > 0) {
    const next = applyEdits(original, edits);
    if (next !== original) {
      fs.writeFileSync(file, next, 'utf8');
      changedFiles += 1;
    }
  }
}

console.log(`Changed files: ${changedFiles}`);
console.log(`Changed fragments: ${changedFragments}`);

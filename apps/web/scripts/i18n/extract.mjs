// Extracts every user-visible English string from the product's UI and the demo data it
// shows, for translation. Writes scripts/i18n/strings.json:
//   [{ key, kind: "text" | "pattern", context }]
// "text" keys are shown as-is; "pattern" keys hold {0}, {1}… where the code inserts values
// (template literals, and JSX text mixed with expressions).
//
//   node scripts/i18n/extract.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = new URL("../../src/", import.meta.url).pathname;
const SCAN = [
  "app/(journey)",
  "components/journey",
  "components/cycle",
  "lib/cycle",
  "lib/audit.ts",
  "components/ui.tsx",
  "components/admin-ui.tsx",
  "components/overlay.tsx",
  "lib/journey",
  "lib/workspace",
  "lib/status.ts",
  "lib/engine",
  "lib/admin",
  "lib/import",
  "lib/assessor/assessor.ts",
];
const ATTRS = new Set(["placeholder", "aria-label", "title", "alt", "label", "eyebrow", "crumb", "search", "note", "aside", "description", "disabled", "only", "sub"]);

function files(p) {
  const abs = join(ROOT, p);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap((f) => files(join(p, f)));
}

const decode = (s) =>
  s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&rsquo;/g, "’")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const norm = (s) => decode(s).replace(/\s+/g, " ").trim();

// Tailwind class lists, ids, paths, codes and other strings nobody reads.
function looksLikeText(s) {
  if (!/[A-Za-z]{2}/.test(s)) return false;
  if (s.length > 600) return false;
  if (/^(https?:|\/|\.\/|@\/|#[0-9a-f]{3,8}$)/i.test(s)) return false;
  if (/^[a-z0-9:\-\[\]\/\.#%_()!,>&=*+'"~]+( [a-z0-9:\-\[\]\/\.#%_()!,>&=*+'"~]+)*$/.test(s) && !/^[a-z]+( [a-z]+){1,}$/.test(s) && /[-:\[\]\/_]/.test(s)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(s) && !/^[a-z]+$/.test(s)) return false; // camelCase identifiers
  if (/^[a-z]+(-[a-z0-9]+)+$/.test(s)) return false; // kebab ids
  if (/^[A-Z_]+$/.test(s) && s.length <= 3) return false;
  if (/^(use client|use server)$/.test(s)) return false;
  if (/^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-]+$/.test(s) && /\d/.test(s)) return false; // svg paths
  return true;
}

const out = new Map();
function add(key, kind, context) {
  const k = key.trim();
  if (!k || !looksLikeText(k.replace(/\{\d+\}/g, ""))) return;
  if (kind === "pattern" && !/[A-Za-z]{2}/.test(k.replace(/\{\d+\}/g, ""))) return;
  if (!out.has(k)) out.set(k, { key: k, kind, context });
}

for (const file of SCAN.flatMap(files).filter((f) => /\.(tsx?|mjs)$/.test(f) && !/\.test\./.test(f))) {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = relative(ROOT, file);
  const ctx = (node) => `${rel}: ${src.slice(Math.max(0, node.getStart() - 60), node.getEnd() + 60).replace(/\s+/g, " ")}`.slice(0, 260);

  const visit = (node) => {
    // Skip imports, type positions and keys of property assignments.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return;

    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const kids = node.children;
      const hasElement = kids.some((k) => ts.isJsxElement(k) || ts.isJsxSelfClosingElement(k) || ts.isJsxFragment(k));
      const hasExpr = kids.some((k) => ts.isJsxExpression(k) && k.expression);
      const hasText = kids.some((k) => ts.isJsxText(k) && /[A-Za-z]/.test(k.getText()));
      // Text mixed with values in one element ("{n} of {m} people") becomes a pattern the
      // runtime matches against the element's whole text.
      if (!hasElement && hasExpr && hasText) {
        let i = 0;
        const parts = kids.map((k) => {
          if (ts.isJsxText(k)) return decode(k.getText());
          if (ts.isJsxExpression(k) && k.expression) {
            if (ts.isStringLiteral(k.expression)) return k.expression.text;
            return `{${i++}}`;
          }
          return "";
        });
        add(parts.join("").replace(/\s+/g, " ").trim(), "pattern", ctx(node));
      }
    }
    if (ts.isJsxText(node)) {
      const t = norm(node.getText());
      if (/[A-Za-z]/.test(t)) add(t, "text", ctx(node));
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText();
      if (ATTRS.has(name)) add(node.initializer.text, "text", ctx(node));
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent;
      const isKey = p && ts.isPropertyAssignment(p) && p.name === node;
      const isJsxAttrName = p && ts.isJsxAttribute(p) && !ATTRS.has(p.name.getText());
      const inCompare = p && ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind);
      const isClassCall = p && ts.isCallExpression(p) && /^(cx|clsx|cn)$/.test(p.expression.getText());
      if (!isKey && !isJsxAttrName && !inCompare && !isClassCall) add(norm(node.text), "text", ctx(node));
    } else if (ts.isTemplateExpression(node)) {
      const p = node.parent;
      const isClass = p && ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent) && /^(className|href|key|id|style)$/.test(p.parent.name.getText());
      const isKeyLike = p && ts.isCallExpression(p) && /^(useScreenState|clientHref|c|fetch|evidenceKey|cx)$/.test(p.expression.getText());
      if (!isClass && !isKeyLike) {
        let i = 0;
        let s = node.head.text;
        for (const span of node.templateSpans) s += `{${i++}}` + span.literal.text;
        add(norm(s), "pattern", ctx(node));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

// Words the code shows on their own or builds into sentences at run time.
for (const w of ["done", "none", "draft", "stage", "Defined", "In", "Evidence", "Reviewed", "Awaiting", "non-material", "material", "214 evidence items to re-validate", "Method", "Thresholds", "N/A treatment", "Override second approval", "Domain", "Subdomain", "Control", "Subcontrol", "Specification", "Clause", "Annex A control", "Axis", "Standard", "Requirement", "Criterion", "Perspective", "Implementation Requirement"]) add(w, "text", "single word shown on its own in the interface (status, level name or label)");

const list = [...out.values()];
writeFileSync(new URL("./strings.json", import.meta.url), JSON.stringify(list, null, 1));
console.log(`${list.length} strings (${list.filter((x) => x.kind === "pattern").length} patterns)`);

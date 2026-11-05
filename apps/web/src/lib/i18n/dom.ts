// Applies the Arabic dictionary to the live page. Text is changed in place (never by adding
// or removing nodes), so React keeps owning the DOM: when React writes new English text the
// observer translates it again. User input (inputs, textareas, editable content) and
// anything marked data-no-translate is left alone.

import { translateText } from "./translate";

const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE", "NOSCRIPT", "SVG"]);
const ATTRS = ["placeholder", "aria-label", "title"] as const;

/** What we wrote into each text node, so our own writes are not translated twice… */
const written = new WeakMap<Node, string>();
/** …and the English React had put there, so a sentence can be rebuilt when one part changes. */
const source = new WeakMap<Node, string>();
const sourceOf = (n: Text) => (written.get(n) === n.nodeValue ? (source.get(n) ?? "") : (n.nodeValue ?? ""));

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP.has(e.tagName.toUpperCase()) || e.hasAttribute("data-no-translate") || (e as HTMLElement).isContentEditable) return true;
  }
  return false;
}

function setText(node: Text, value: string) {
  if (written.get(node) !== node.nodeValue) source.set(node, node.nodeValue ?? "");
  written.set(node, value);
  if (node.nodeValue !== value) node.nodeValue = value;
}

// Arrows point along the reading direction, so they swap in right-to-left text.
const MIRROR: Record<string, string> = { "→": "←", "←": "→", "›": "‹", "‹": "›", "»": "«", "«": "»" };
const mirror = (s: string) => s.replace(/[→←›‹»«]/g, (c) => MIRROR[c]);

/** Keeps the spaces around a fragment so neighbouring values do not run together. */
function keepSpacing(original: string, translated: string) {
  const lead = /^\s/.test(original) ? " " : "";
  const trail = /\s$/.test(original) ? " " : "";
  return lead + translated + trail;
}

function translateElement(el: Element) {
  // Fields keep what people type, but their placeholder and label are interface text.
  const field = el.tagName === "INPUT" || el.tagName === "TEXTAREA";
  if (field ? el.hasAttribute("data-no-translate") || skipped(el.parentElement) : skipped(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && el.getAttribute(`data-i18n-${a}`) !== v) {
      const t = translateText(v);
      if (t) {
        el.setAttribute(a, t);
        el.setAttribute(`data-i18n-${a}`, t);
      }
    }
  }
  if (field) return;
  const texts = [...el.childNodes].filter((n): n is Text => n.nodeType === Node.TEXT_NODE);
  if (!texts.length) return;
  // Text split around values ("12 of 40 people") is translated as one sentence when the
  // element holds nothing but text.
  if (texts.length > 1 && texts.length === el.childNodes.length) {
    if (texts.every((t) => written.get(t) === t.nodeValue)) return;
    const whole = texts.map(sourceOf).join("");
    const t = translateText(whole);
    if (t) {
      setText(texts[0], mirror(keepSpacing(whole, t)));
      for (const rest of texts.slice(1)) setText(rest, "");
      return;
    }
  }
  for (const node of texts) translateNode(node);
}

function translateNode(node: Text) {
  const v = node.nodeValue ?? "";
  if (written.get(node) === v) return;
  const t = /[A-Za-z]/.test(v) ? translateText(v) : null;
  const out = t ? keepSpacing(v, t) : v;
  const final = mirror(out);
  if (final !== v) setText(node, final);
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    const parent = (root as Text).parentElement;
    if (parent) translateElement(parent);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  translateElement(el);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) translateElement(n as Element);
}

/** Translates the page now and keeps translating whatever React renders next. Returns a stop function. */
export function startTranslating(root: HTMLElement = document.body): () => void {
  walk(root);
  const pending = new Set<Node>();
  let queued = false;
  const flush = () => {
    queued = false;
    const nodes = [...pending];
    pending.clear();
    for (const n of nodes) if (n.isConnected) walk(n);
  };
  const obs = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") {
        if (written.get(m.target) !== m.target.nodeValue) pending.add(m.target);
      } else if (m.type === "attributes") pending.add(m.target);
      else m.addedNodes.forEach((n) => pending.add(n));
      if (m.type === "childList") pending.add(m.target);
    }
    if (!queued && pending.size) {
      queued = true;
      queueMicrotask(flush);
    }
  });
  obs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
  return () => obs.disconnect();
}

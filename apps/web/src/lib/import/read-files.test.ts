import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { decodeIfText, markupToText, readableRuns, rtfToText } from "@/lib/engine/extract-sources";
import type { TextDoc } from "@/lib/engine/extract";
import { readBuffer } from "./read-files";

const ascii = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
const zipOf = (files: Record<string, string>) => {
  const zip = XLSX.CFB.utils.cfb_new();
  for (const [path, text] of Object.entries(files)) XLSX.CFB.utils.cfb_add(zip, path, new Uint8Array(ascii(text)));
  const out = XLSX.CFB.write(zip, { type: "array", fileType: "zip" }) as ArrayLike<number>;
  return Uint8Array.from(out).buffer as ArrayBuffer;
};
const textOf = (docs: unknown[]) => (docs as TextDoc[]).flatMap((d) => d.lines.map((l) => l.text));
const slide = (t: string) => `<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`;

describe("reading any file", () => {
  it("reads PowerPoint slides in order, a page each", async () => {
    const docs = await readBuffer("deck.pptx", zipOf({ "ppt/slides/slide10.xml": slide("Ten"), "ppt/slides/slide2.xml": slide("Two"), "ppt/theme/theme1.xml": "<a:t>Skip</a:t>" }));
    expect(textOf(docs)).toEqual(["Two", "Ten"]);
    expect((docs[0] as TextDoc).lines.map((l) => l.page)).toEqual([1, 2]);
  });

  it("reads OpenDocument text and a Word file with the wrong name", async () => {
    expect(textOf(await readBuffer("a.odt", zipOf({ "content.xml": "<text:h>1 Title</text:h><text:p>Body</text:p>", "styles.xml": "<x>no</x>" })))).toEqual(["1 Title", "Body"]);
    expect(textOf(await readBuffer("a.bin", zipOf({ "word/document.xml": "<w:p><w:t>Clause</w:t></w:p>", "word/styles.xml": "<x>no</x>" })))).toEqual(["Clause"]);
  });

  it("reads each file in a plain zip", async () => {
    const docs = await readBuffer("pack.zip", zipOf({ "one.txt": "First", "two.html": "<p>Second</p>" }));
    expect(textOf(docs)).toEqual(expect.arrayContaining(["First", "Second"]));
  });

  it("goes by content when the extension says nothing", async () => {
    expect(textOf(await readBuffer("page.foo", ascii("<html><style>x{}</style><p>Hello &amp; welcome</p></html>")))).toEqual(["Hello & welcome"]);
    expect(textOf(await readBuffer("notes", ascii("1.1 Plain")))).toEqual(["1.1 Plain"]);
    expect(textOf(await readBuffer("old.rtf", ascii("{\\rtf1{\\fonttbl{\\f0 Arial;}}\\f0 One\\par Two}")))).toEqual(["One", "Two"]);
  });

  it("finds English and Arabic inside a binary file", async () => {
    const utf16 = (s: string) => [...s].flatMap((c) => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8]);
    const bytes = new Uint8Array([0, 1, 2, ...utf16("الضوابط الأساسية"), 0, 0, 1, ...new TextEncoder().encode("Access control policy"), 0, 2, 3, 200, 201]);
    const found = textOf(await readBuffer("legacy.doc", bytes.buffer as ArrayBuffer)).join("\n");
    expect(found).toContain("الضوابط الأساسية");
    expect(found).toContain("Access control policy");
  });
});

describe("text helpers", () => {
  it("keeps table cells and decodes character references", () => {
    expect(markupToText("<tr><td>A</td><td>&#1593;</td></tr>")).toBe("A\tع");
  });
  it("decodes Arabic in RTF", () => {
    expect(rtfToText("{\\rtf1 \\u1593?\\u1604?\\par}")).toBe("عل");
  });
  it("tells text from binary", () => {
    expect(decodeIfText(new Uint8Array(ascii("نص")))).toBe("نص");
    expect(decodeIfText(new Uint8Array([65, 0, 66]))).toBeNull();
    expect(readableRuns(new Uint8Array([1, 2, 3, 4]))).toBe("");
  });
});

/**
 * Smoke test for the katex override (0.18.2), which sits outside
 * mermaid 11.16.1's declared ^0.16.45 range.
 *
 * The shipped diagram page sets htmlLabels false (src/entry.ts), and mermaid
 * only invokes KaTeX when HTML labels are on. This test builds that path
 * from this package and renders a flowchart label that contains math.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dir, "..");
const ENTRY = path.join(import.meta.dir, "katex-math-entry.ts");
const SOURCE = 'flowchart LR\n  A["$$E=mc^2$$"]';

test("mermaid renders a diagram label that contains KaTeX math", async () => {
  const katexPkg = await Bun.file(path.join(ROOT, "node_modules/katex/package.json")).json();
  expect(katexPkg.version).toBe("0.18.2");

  const built = await Bun.build({
    entrypoints: [ENTRY],
    target: "browser",
    minify: true,
  });
  expect(built.success).toBe(true);
  const js = (await built.outputs[0].text()).replaceAll("</scri", "<\\/scri");

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<!doctype html><body><script type="module">${js}</script></body>`,
      { waitUntil: "load" },
    );
    await page.waitForFunction(
      () => typeof (window as unknown as { __renderMath?: unknown }).__renderMath === "function",
    );
    const svg = await page.evaluate(async (source) => {
      const render = (window as unknown as { __renderMath: (text: string) => Promise<string> }).__renderMath;
      return render(source);
    }, SOURCE);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toContain("MathML is unsupported");
    expect(svg).toContain("<math");
    expect(svg).toContain(">E<");
    expect(svg).toContain(">m<");
    expect(svg).toContain(">c<");
  } finally {
    await browser.close();
  }
}, 25000);

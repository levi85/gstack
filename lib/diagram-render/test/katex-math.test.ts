/**
 * Smoke test for the katex 0.18.2 override, which is outside mermaid
 * 11.16.1's declared ^0.16.45 range.
 *
 * The browser bundle is src/entry.ts, so mermaid.initialize is the shipped
 * call (htmlLabels false). Sequence diagrams still call drawKatex for labels
 * that contain $$. mermaid.core loads that copy with import("katex"), which
 * resolves to this package's override.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { chromium, type Page } from "playwright";

const ROOT = path.resolve(import.meta.dir, "..");
const ENTRY = path.join(ROOT, "src/entry.ts");

const FLOW = 'flowchart LR\n  A["$$E=mc^2$$"]';
const SEQUENCE = "sequenceDiagram\n  participant A\n  Note over A: $$x^2$$";

async function loadShippedPage(): Promise<{ page: Page; close: () => Promise<void> }> {
  const pkg = await Bun.file(path.join(ROOT, "package.json")).json();
  const built = await Bun.build({
    entrypoints: [ENTRY],
    target: "browser",
    minify: true,
    define: {
      __BUNDLE_INFO_DEPS__: JSON.stringify(pkg.dependencies),
      "process.env.NODE_ENV": '"production"',
    },
  });
  expect(built.success).toBe(true);
  const js = (await built.outputs[0].text()).replaceAll("</scri", "<\\/scri");

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(
    `<!doctype html><body><script type="module">${js}</script></body>`,
    { waitUntil: "load" },
  );
  await page.waitForFunction(
    () => typeof (window as unknown as { __renderMermaid?: unknown }).__renderMermaid === "function",
  );
  return { page, close: () => browser.close() };
}

async function renderMermaid(page: Page, id: string, source: string): Promise<string> {
  return page.evaluate(async ({ id, source }) => {
    const render = (window as unknown as {
      __renderMermaid: (id: string, text: string) => Promise<string>;
    }).__renderMermaid;
    return render(id, source);
  }, { id, source });
}

test("shipped entry renders sequence-note KaTeX with katex 0.18.2", async () => {
  const katexPkg = await Bun.file(path.join(ROOT, "node_modules/katex/package.json")).json();
  expect(katexPkg.version).toBe("0.18.2");

  const { page, close } = await loadShippedPage();
  try {
    const flow = await renderMermaid(page, "katexFlow1", FLOW);
    expect(flow.startsWith("<svg")).toBe(true);
    expect(flow).toContain("$$E=mc^2$$");

    const sequence = await renderMermaid(page, "katexSeq1", SEQUENCE);
    expect(sequence.startsWith("<svg")).toBe(true);
    expect(sequence).not.toContain("MathML is unsupported");
    expect(sequence).toContain("<math");
    expect(sequence).toContain("<mi>x</mi>");
    expect(sequence).toContain("<mn>2</mn>");
  } finally {
    await close();
  }
}, 25000);

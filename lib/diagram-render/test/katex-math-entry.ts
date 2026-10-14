/**
 * Browser entry for the KaTeX math smoke test.
 *
 * The shipped page (src/entry.ts) sets htmlLabels false so print SVGs stay
 * free of foreignObject. Mermaid only calls KaTeX from the HTML-label path,
 * so this entry turns that path on and keeps the same strict security level.
 * Bun resolves `mermaid` from this package, including the katex override.
 */
import mermaid from "mermaid";

declare global {
  interface Window {
    __renderMath: (text: string) => Promise<string>;
  }
}

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  htmlLabels: true,
  flowchart: { htmlLabels: true },
});

window.__renderMath = async (text: string): Promise<string> => {
  const { svg } = await mermaid.render("katexMath1", text);
  return svg;
};

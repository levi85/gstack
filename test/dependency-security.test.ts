import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AdmZip from "adm-zip";
import sharp from "sharp";

describe("security dependency overrides", () => {
  for (const [name, minimum] of [
    ["sharp", "0.35.5"],
    ["adm-zip", "0.6.1"],
    ["ip-address", "10.7.1"],
    ["fast-uri", "3.1.8"],
    ["hono", "4.13.7"],
    ["proxy-addr", "2.0.8"],
    ["@modelcontextprotocol/sdk", "1.31.0"],
  ]) {
    test(`${name} resolves only versions at or above ${minimum}`, async () => {
      const lock = await Bun.file(join(import.meta.dir, "../bun.lock")).text();
      const versions = [...lock.matchAll(new RegExp(`"${name}@([^"]+)"`, "g"))];
      expect(versions.length).toBeGreaterThan(0);
      for (const match of versions) {
        expect(Bun.semver.satisfies(match[1], `>=${minimum}`)).toBe(true);
      }
    });
  }

  test("sharp loads the patched runtime", () => {
    expect(Bun.semver.satisfies(sharp.versions.sharp, ">=0.35.5")).toBe(true);
  });

  test("diagram-render transitive floors", async () => {
    const lock = await Bun.file(join(import.meta.dir, "../lib/diagram-render/bun.lock")).text();
    for (const [name, minimum] of [
      ["dompurify", "3.4.16"],
      ["katex", "0.18.2"],
      ["source-map-js", "1.2.2"],
    ]) {
      const versions = [...lock.matchAll(new RegExp(`"${name}@([^"]+)"`, "g"))];
      expect(versions.length).toBeGreaterThan(0);
      for (const match of versions) {
        expect(Bun.semver.satisfies(match[1], `>=${minimum}`)).toBe(true);
      }
    }
  });

  test("adm-zip still extracts ordinary archives", () => {
    const root = mkdtempSync(join(tmpdir(), "gstack-zip-safe-"));
    try {
      const zip = new AdmZip();
      zip.addFile("nested/file.txt", Buffer.from("archive contents"));
      zip.extractAllTo(root, true);
      expect(readFileSync(join(root, "nested/file.txt"), "utf8")).toBe("archive contents");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  for (const target of ["directory", "file"] as const) {
    test.skipIf(process.platform === "win32")(`adm-zip refuses an extraction through a ${target} symlink`, () => {
      const root = mkdtempSync(join(tmpdir(), "gstack-zip-symlink-"));
      try {
        const destination = join(root, "destination");
        const outside = join(root, "outside");
        mkdirSync(destination);
        mkdirSync(outside);
        const protectedFile = join(outside, "file.txt");
        writeFileSync(protectedFile, "original contents");
        symlinkSync(target === "directory" ? outside : protectedFile, join(destination, "link"));
        const zip = new AdmZip();
        zip.addFile(target === "directory" ? "link/file.txt" : "link", Buffer.from("overwritten"));
        expect(() => zip.extractAllTo(destination, true)).toThrow();
        expect(readFileSync(protectedFile, "utf8")).toBe("original contents");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = fileURLToPath(new URL("../check-vercel.mjs", import.meta.url));
function check(rootDirectory = "Frontend", overrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "magictrip-vercel-check-"));
  try {
    mkdirSync(join(cwd, ".vercel"));
    writeFileSync(join(cwd, ".vercel/project.json"), JSON.stringify({ settings: { rootDirectory } }));
    return spawnSync(process.execPath, [script], {
      cwd, encoding: "utf8",
      env: { ...process.env, BACKEND_API_URL: "https://api.example.com",
        AZURE_API_URL: "https://api.example.com", FRONTEND_URL: "https://trip.example.com",
        NEXT_PUBLIC_API_BASE_URL: "", ...overrides },
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("correct production settings pass", () => assert.equal(check().status, 0));
test("wrong monorepo root fails", () => assert.notEqual(check(null).status, 0));
test("wrong backend fails", () => assert.notEqual(check("Frontend", { BACKEND_API_URL: "https://old.example.com" }).status, 0));
test("direct browser API override fails", () => assert.notEqual(check("Frontend", { NEXT_PUBLIC_API_BASE_URL: "https://api.example.com" }).status, 0));
test("insecure frontend origin fails", () => assert.notEqual(check("Frontend", { FRONTEND_URL: "http://trip.example.com" }).status, 0));

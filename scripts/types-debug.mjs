import { readFile } from "node:fs/promises";

const endpoint = "http://127.0.0.1:7443/ingest/4901d544-0aee-48d2-ab05-0d862ed6cec6";

const sendLog = (hypothesisId, message, data) =>
  // #region agent log
  fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "de2d06",
    },
    body: JSON.stringify({
      sessionId: "de2d06",
      runId: "types-check",
      hypothesisId,
      location: "scripts/types-debug.mjs",
      message,
      data,
      timestamp: Date.now(),
    }),
  })
    .catch(() => {})
    .finally(() => {
      console.log(
        JSON.stringify({
          sessionId: "de2d06",
          runId: "types-check",
          hypothesisId,
          location: "scripts/types-debug.mjs",
          message,
          data,
          timestamp: Date.now(),
        }),
      );
    });
// #endregion

const parseJsonc = (raw) =>
  JSON.parse(
    raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, ""),
  );

const tsconfigApp = parseJsonc(await readFile(new URL("../tsconfig.app.json", import.meta.url), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

let canResolveVitestGlobals = false;
let resolveError = "";
try {
  await import("vitest/globals");
  canResolveVitestGlobals = true;
} catch (error) {
  resolveError = error instanceof Error ? error.message : "unknown import error";
}

await sendLog("H1", "vitest globals resolution", {
  canResolveVitestGlobals,
  resolveError,
});

await sendLog("H2", "tsconfig app type entries", {
  types: tsconfigApp?.compilerOptions?.types ?? [],
});

await sendLog("H3", "vitest listed in package.json", {
  inDependencies: Boolean(packageJson.dependencies?.vitest),
  inDevDependencies: Boolean(packageJson.devDependencies?.vitest),
});

await sendLog("H4", "install mode context", {
  npmConfigProduction: process.env.npm_config_production ?? "missing",
  nodeEnv: process.env.NODE_ENV ?? "missing",
  ci: process.env.CI ?? "missing",
});

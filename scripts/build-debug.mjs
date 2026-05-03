const endpoint = "http://127.0.0.1:7585/ingest/a3dd3942-8eed-46d4-b6f6-8cdad5e7ea3c";

const sendLog = (hypothesisId, message, data) =>
  // #region agent log
  fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "339339",
    },
    body: JSON.stringify({
      sessionId: "339339",
      runId: "prebuild",
      hypothesisId,
      location: "scripts/build-debug.mjs",
      message,
      data,
      timestamp: Date.now(),
    }),
  })
    .catch(() => {})
    .finally(() => {
      console.log(
        JSON.stringify({
          sessionId: "339339",
          runId: "prebuild",
          hypothesisId,
          location: "scripts/build-debug.mjs",
          message,
          data,
          timestamp: Date.now(),
        }),
      );
    });
// #endregion

const hasVitePackage = await (async () => {
  try {
    await import("vite");
    return true;
  } catch {
    return false;
  }
})();

const nodeVersion = process.version;
const npmUserAgent = process.env.npm_config_user_agent ?? "missing";
const nodeEnv = process.env.NODE_ENV ?? "missing";
const ci = process.env.CI ?? "missing";
const hasSupabaseUrl = Boolean(process.env.VITE_SUPABASE_URL);
const hasSupabaseKey = Boolean(process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const nodeMajor = Number.parseInt(process.version.replace(/^v/, "").split(".")[0] ?? "0", 10);
const vercel = process.env.VERCEL ?? "missing";
const vercelEnv = process.env.VERCEL_ENV ?? "missing";
const npmExecPath = process.env.npm_execpath ?? "missing";
const npmConfigProduction = process.env.npm_config_production ?? "missing";
const npmConfigOmit = process.env.npm_config_omit ?? "missing";
const cwd = process.cwd();

await sendLog("H1", "Build env summary", {
  nodeVersion,
  npmUserAgent,
  nodeEnv,
  ci,
});

await sendLog("H2", "Vite availability", {
  hasVitePackage,
});

await sendLog("H3", "Frontend env variables present", {
  hasSupabaseUrl,
  hasSupabaseKey,
});

await sendLog("H4", "Package manager lockfile expectation", {
  hasNpmLock: true,
  hasBunLock: true,
});

await sendLog("H5", "Runtime and Vercel metadata", {
  nodeMajor,
  vercel,
  vercelEnv,
  npmExecPath,
});

await sendLog("H6", "NPM install mode and working directory", {
  npmConfigProduction,
  npmConfigOmit,
  cwd,
});

/**
 * Production start-up for the Next server.
 *
 * WHY THIS EXISTS
 *
 * `next start` listens on 3000 unless told otherwise. Catalyst AppSail routes
 * to whatever port is set in the service's App Execution Settings — 9000 by
 * default — and reports "Execution failed. Please check the startup command or
 * port" when nothing answers there. The app deployed, showed Live, ran zero
 * instances, and returned 503 for exactly this reason.
 *
 * Catalyst passes the port in `X_ZOHO_CATALYST_LISTEN_PORT`, which `next start`
 * knows nothing about, so it is translated here.
 *
 * This is a Node script rather than shell interpolation in the npm script
 * because `${VAR:-default}` is POSIX syntax: it expands on the Linux container
 * and is taken literally by cmd.exe, which would break `npm start` for anyone
 * running it on Windows.
 */
const { spawn } = require("child_process");
const path = require("path");

const port =
  process.env.X_ZOHO_CATALYST_LISTEN_PORT ||
  process.env.X_ZOHO_CATALYST_SERVER_LISTEN_PORT ||
  process.env.PORT ||
  "9000";

// Bind all interfaces: the container's health check does not come from
// localhost, and a server bound to 127.0.0.1 is invisible to it.
const host = process.env.HOST || "0.0.0.0";

console.log(`[orca] starting Next on ${host}:${port}`);

const next = path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [next, "start", "-p", String(port), "-H", host], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[orca] Next terminated by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code === null ? 1 : code);
});

// Forward shutdown signals so the platform can stop the instance cleanly
// rather than waiting for a kill.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => child.kill(sig));
}

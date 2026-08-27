import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * A self-contained server build, for AppSail.
   *
   * The Catalyst CLI packs and uploads whatever is in the build path and does
   * NOT install dependencies, so the upload has to carry them. Uploading the
   * whole of `node_modules` is not viable: the packer opens a read stream for
   * every file at once and Windows answers EMFILE, which produced a failed
   * deploy and a 12.9 GB error log.
   *
   * `standalone` emits `.next/standalone` with a `server.js` and only the
   * dependencies Next traced — about 2,700 files rather than 59,500.
   *
   * This is ADDITIVE: `next start` and `npm run dev` behave exactly as before.
   */
  output: "standalone",

  /**
   * Keep these OUT of the bundle and load them from node_modules at runtime.
   *
   * Without this, Turbopack externalised firebase-admin under a hashed alias —
   * the server chunk contained `import("firebase-admin-a14c8a5423a75469/app")`
   * while the trace copied the real `firebase-admin`. No such package exists on
   * disk, so on the deployed container every route that verifies an officer
   * died with:
   *
   *     Cannot find package 'firebase-admin-a14c8a5423a75469'
   *
   * which surfaced as a 500 on every authenticated route while the one public
   * route kept working — a failure that reads like a broken server rather than
   * a bundling problem.
   *
   * Naming them here makes Next import them by their real names, which the
   * standalone tracer then resolves correctly.
   *
   * Keep this list to packages that are SERVER-side and native or
   * dynamically-loading. `pdfjs-dist` belongs to the browser and listing it
   * here broke the build outright: webpack treated an ESM-only package as a
   * CommonJS external and refused to compile.
   */
  serverExternalPackages: ["firebase-admin", "zcatalyst-sdk-node", "canvas"],
};

export default nextConfig;

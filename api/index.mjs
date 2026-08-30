/**
 * Vercel Function entry point for the Express API.
 *
 * The server is bundled ahead of time by `artifacts/api-server/build.mjs`
 * (run from the root `vercel-build` script), so this file only has to hand
 * Vercel the resulting `http.Server`. Exporting the server — rather than a
 * request handler — is what lets WebSocket upgrades on
 * `/api/realtime/relay` reach the relay.
 */
export { default } from "../artifacts/api-server/dist/serverless.mjs";

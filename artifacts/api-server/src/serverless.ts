import http from "node:http";
import app from "./app";
import { setupRealtimeRelay } from "./lib/realtime-relay";

/**
 * The fully wired HTTP server, minus the `listen()` call.
 *
 * Vercel Functions adopt an exported `http.Server` and drive both plain HTTP
 * requests and WebSocket upgrades through it, so this is what `api/index.mjs`
 * re-exports. Locally, `index.ts` imports it and binds it to a port.
 */
const server = http.createServer(app);

setupRealtimeRelay(server);

export default server;

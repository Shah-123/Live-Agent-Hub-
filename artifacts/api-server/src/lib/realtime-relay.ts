import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { logger } from "./logger";
import { OpenAIRealtimeRelay } from "@workspace/integrations-openai-ai-server/realtime-client";

/**
 * Attaches a WebSocket server to the provided HTTP server for Realtime Relay
 */
export function setupRealtimeRelay(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url || "", `http://${request.headers.host}`);

    if (pathname === "/api/realtime/relay") {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit("connection", ws, request);
      });
    } else {
      // If we add other WS routes later, they could handle upgrades here
      socket.destroy();
    }
  });

  wss.on("connection", async (ws: WebSocket) => {
    logger.info("New browser WebSocket connection for Realtime Relay");

    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!apiKey) {
      logger.error("AI_INTEGRATIONS_OPENAI_API_KEY is not set");
      ws.close(1011, "Server configuration error: missing API key");
      return;
    }

    try {
      const relay = new OpenAIRealtimeRelay(ws, apiKey);
      await relay.connect();
      logger.info("Successfully established OpenAI Realtime relay session");
    } catch (err) {
      logger.error({ err }, "Failed to establish OpenAI Realtime relay session");
      ws.close(1011, "Failed to connect to OpenAI");
    }
  });

  return wss;
}

import { logger } from "./lib/logger";
import server from "./serverless";

const rawPort = process.env["API_PORT"] || process.env["PORT"];
if (!rawPort) {
  throw new Error(
    "API_PORT or PORT environment variable is required but was not provided.",
  );
}
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

export { server };

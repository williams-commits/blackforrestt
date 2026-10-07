/** Trade-app custom server — same architecture as web's: one HTTP port shared
 *  with the WebSocket gateway, engine hub booted at startup. Plain `next dev`
 *  leaves the hub empty (instruments never load) — always boot through this. */
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { hub } from "./src/server/engine/hub.js";
import { attachWebSocketServer } from "./src/server/ws/server.js";
import { prisma } from "./src/server/db.js";
import { closeRedis } from "./src/server/redis.js";
import { maintenanceScheduler } from "./src/server/maintenance.js";
import { emailDispatcher } from "./src/server/email/service.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
// Root .env carries PORT="3000" (web's port) — ignore it; trade owns 3101 in
// dev and 3000 inside its own container in production.
const port = dev ? 3101 : Number(process.env.PORT ?? 3000);

async function main(): Promise<void> {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  try {
    await hub.init();
    emailDispatcher.start();
    maintenanceScheduler.start();
  } catch (error) {
    console.error("⚠️ Hub failed to initialize (is the database migrated and seeded?):", error);
    if (!dev) throw new Error("Production startup aborted because the trading engine is not ready.", { cause: error });
  }

  const server = createServer((request, response) => {
    const parsedUrl = parse(request.url ?? "/", true);
    void handle(request, response, parsedUrl);
  });
  attachWebSocketServer(server);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(`🚀 trade ready on http://localhost:${port} (dev=${dev})`);
  console.log(`   WebSocket: ws://localhost:${port}/ws`);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received, shutting down…`);
    const forceExit = setTimeout(() => process.exit(1), 20_000);
    try {
      await prisma.$disconnect();
      closeRedis();
      server.close();
      process.exit(0);
    } finally {
      clearTimeout(forceExit);
    }
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((error) => {
  console.error("Fatal boot error:", error);
  process.exit(1);
});

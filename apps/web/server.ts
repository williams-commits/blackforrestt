/** Custom Next.js server sharing one HTTP port with the WebSocket gateway. */
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { hub } from "./src/server/engine/hub.js";
import { attachWebSocketServer } from "./src/server/ws/server.js";
import { prisma } from "./src/server/db.js";
import { closeRedis } from "./src/server/redis.js";
import { reconciliationScheduler } from "./src/server/reconciliationScheduler.js";
import { maintenanceScheduler } from "./src/server/maintenance.js";
import { emailDispatcher } from "./src/server/email/service.js";
import { closeStorage, ensureStorageBuckets } from "./src/server/storage.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const configuredPort = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65_535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}
const port = configuredPort;

async function main(): Promise<void> {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const reconciliationEnabled =
    (process.env.RECONCILIATION_ENABLED ?? (dev ? "false" : "true")).toLowerCase() === "true";
  try {
    await hub.init();
    emailDispatcher.start();
    maintenanceScheduler.start();
    if (reconciliationEnabled) reconciliationScheduler.start();
    else console.log("🧾 Reconciliation scheduler disabled for this environment.");
  } catch (error) {
    console.error("⚠️ Hub failed to initialize (is the database migrated and seeded?):", error);
    if (!dev) {
      throw new Error("Production startup aborted because the trading engine is not ready.", { cause: error });
    }
  }

  // Self-provision the private object buckets (KYC + payment proofs). The
  // deploy stack's one-shot minio-init container may not have run for the
  // current prefix/bucket set — without this, every document upload 503s.
  // Failures are logged, not fatal: the lazy retry in storage.ts still
  // recovers on the next upload attempt.
  try {
    const created = await ensureStorageBuckets();
    if (created.length > 0) console.log(`🪣 Created missing storage buckets: ${created.join(", ")}`);
  } catch (error) {
    console.warn("⚠️ Storage bucket bootstrap skipped (storage unavailable at boot — uploads will retry lazily):", error instanceof Error ? error.message : error);
  }

  const server = createServer((request, response) => {
    const parsedUrl = parse(request.url ?? "/", true);
    void handle(request, response, parsedUrl);
  });
  const wss = attachWebSocketServer(server);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(`🚀 blckforest ready on http://localhost:${port} (dev=${dev})`);
  console.log(`   WebSocket: ws://localhost:${port}/ws`);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received, shutting down…`);

    const forceExit = setTimeout(() => {
      console.error("Graceful shutdown timed out; forcing exit.");
      process.exit(1);
    }, 20_000);
    forceExit.unref?.();

    // Upgraded sockets are not closed by http.Server.close(), so drain them
    // before waiting for the HTTP listener.
    for (const client of wss.clients) client.close(1001, "Server shutting down");
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await reconciliationScheduler.stop();
    await maintenanceScheduler.stop();
    await emailDispatcher.stop();
    await hub.shutdown();
    await closeStorage();
    await closeRedis();
    await prisma.$disconnect();
    clearTimeout(forceExit);
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch(async (error) => {
  console.error("Fatal error during server boot:", error);
  await reconciliationScheduler.stop().catch(() => undefined);
  await maintenanceScheduler.stop().catch(() => undefined);
  await emailDispatcher.stop().catch(() => undefined);
  await hub.shutdown().catch(() => undefined);
  await closeStorage().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  await closeRedis().catch(() => undefined);
  process.exit(1);
});

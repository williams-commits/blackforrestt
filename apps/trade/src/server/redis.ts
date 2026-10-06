import { createClient } from "redis";

function createConfiguredClient(url: string) {
  return createClient({
    url,
    socket: {
      connectTimeout: 3_000,
      reconnectStrategy: (retries) =>
        retries < 3 ? Math.min(100 * 2 ** retries, 1_000) : false,
    },
  });
}

type RedisClient = ReturnType<typeof createConfiguredClient>;

let client: RedisClient | null = null;
let connecting: Promise<RedisClient> | null = null;

export async function getRedis(): Promise<RedisClient> {
  if (client?.isReady) return client;
  if (connecting) return connecting;
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL is required for distributed security controls.");

  const next = createConfiguredClient(url);
  next.on("error", (error) => console.error("Redis security client error", error));
  const pending = next
    .connect()
    .then(() => {
      client = next;
      return next;
    })
    .finally(() => {
      connecting = null;
    });
  connecting = pending;
  return pending;
}

export async function closeRedis(): Promise<void> {
  const current = client;
  client = null;
  connecting = null;
  if (current?.isOpen) await current.close();
}

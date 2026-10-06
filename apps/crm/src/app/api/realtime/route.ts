import { auth } from "@/auth";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated, payload-free change stream. Clients refetch their own
 * authorized data after a signal; no record details cross the stream.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  let lastSeen = await prisma.activityEvent.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, createdAt: true },
  });

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let poller: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("ready", { connectedAt: new Date().toISOString() });
      heartbeat = setInterval(() => send("heartbeat", { at: new Date().toISOString() }), 20_000);
      poller = setInterval(() => {
        void (async () => {
          const newest = await prisma.activityEvent.findFirst({
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { id: true, createdAt: true },
          });
          if (!newest || (lastSeen && newest.id === lastSeen.id)) return;
          lastSeen = newest;
          send("refresh", { id: newest.id, at: newest.createdAt.toISOString() });
        })().catch(() => undefined);
      }, 2_500);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (poller) clearInterval(poller);
    },
  });

  request.signal.addEventListener("abort", () => {
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (poller) clearInterval(poller);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
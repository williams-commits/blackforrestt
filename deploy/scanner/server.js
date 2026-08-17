/**
 * Malware scanner HTTP gateway for the production stack.
 *
 * Implements the adapter contract documented in
 * src/server/security/scanner.ts (HttpScanner):
 *   POST /scan  body: raw file bytes (application/octet-stream)
 *   response:   { "status": "CLEAN|BLOCKED", "reason": "..." }
 *
 * Bytes are forwarded to a clamd daemon (clamav/clamav container) over the
 * INSTREAM protocol. The gateway fails closed: any clamd error, timeout, or
 * invalid verdict returns 5xx so the application refuses to finalize the
 * document rather than trusting an unverifiable scan.
 *
 * Configuration (all optional):
 *   PORT            listen port                     (default 8080)
 *   CLAMD_HOST      clamd hostname                  (default clamav)
 *   CLAMD_PORT      clamd port                      (default 3310)
 *   SCANNER_TOKEN   when set, require "Authorization: Bearer <token>"
 *   MAX_BODY_BYTES  request body cap                (default 33554432 = 32 MiB)
 *   CLAMD_TIMEOUT_MS  idle timeout per scan          (default 120000)
 */
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.PORT ?? 8080);
const CLAMD_HOST = process.env.CLAMD_HOST ?? "clamav";
const CLAMD_PORT = Number(process.env.CLAMD_PORT ?? 3310);
const SCANNER_TOKEN = process.env.SCANNER_TOKEN?.trim() || "";
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 33_554_432);
const CLAMD_TIMEOUT_MS = Number(process.env.CLAMD_TIMEOUT_MS ?? 120_000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) throw new Error(`Invalid PORT: ${process.env.PORT}`);
if (!Number.isInteger(CLAMD_PORT) || CLAMD_PORT < 1 || CLAMD_PORT > 65_535) throw new Error(`Invalid CLAMD_PORT: ${process.env.CLAMD_PORT}`);

/** Send a raw buffer through clamd INSTREAM and return its verdict line. */
function clamdInstream(bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: CLAMD_HOST, port: CLAMD_PORT });
    socket.setTimeout(CLAMD_TIMEOUT_MS);
    const fail = (error) => {
      socket.destroy();
      reject(error);
    };
    socket.once("timeout", () => fail(new Error(`clamd timed out after ${CLAMD_TIMEOUT_MS}ms`)));
    socket.once("error", fail);
    let response = "";
    socket.once("connect", () => {
      socket.write("zINSTREAM\0");
      // Payloads are capped by MAX_BODY_BYTES, so letting Node buffer any
      // write backlog internally is fine; flow control is not worth the churn.
      for (let offset = 0; offset < bytes.length; ) {
        const chunk = bytes.subarray(offset, offset + 64 * 1024);
        const header = Buffer.alloc(4);
        header.writeUInt32BE(chunk.length, 0);
        socket.write(Buffer.concat([header, chunk]));
        offset += chunk.length;
      }
      socket.write(Buffer.from([0, 0, 0, 0]));
    });
    socket.on("data", (data) => {
      response += data.toString("latin1");
      if (response.includes("\0")) {
        socket.end();
        resolve(response.replace(/\0/g, "").trim());
      }
    });
    socket.once("close", () => {
      if (response.trim()) resolve(response.replace(/\0/g, "").trim());
      else reject(new Error("clamd closed the connection without a verdict."));
    });
  });
}

function clamdPing() {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: CLAMD_HOST, port: CLAMD_PORT });
    socket.setTimeout(5_000);
    const fail = (error) => {
      socket.destroy();
      reject(error);
    };
    socket.once("timeout", () => fail(new Error("clamd ping timed out")));
    socket.once("error", fail);
    socket.once("connect", () => socket.write("zPING\0"));
    socket.once("data", () => {
      socket.end();
      resolve(true);
    });
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        // Respond 413 while silently draining the remainder, so the error
        // actually reaches the client instead of a connection reset.
        request.removeAllListeners("data");
        request.on("data", () => undefined);
        reject(Object.assign(new Error("Request body exceeds the scanner size limit."), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    request.once("end", () => resolve(Buffer.concat(chunks)));
    request.once("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const send = (statusCode, payload) => {
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  };

  if (request.method === "GET" && request.url === "/healthz") {
    try {
      await clamdPing();
      return send(200, { status: "up", clamd: "up" });
    } catch (error) {
      return send(503, { status: "degraded", clamd: "down", error: String(error?.message ?? error) });
    }
  }

  if (request.method !== "POST" || request.url !== "/scan") {
    return send(404, { error: "POST /scan or GET /healthz only." });
  }
  if (SCANNER_TOKEN && request.headers.authorization !== `Bearer ${SCANNER_TOKEN}`) {
    return send(401, { error: "Invalid scanner token." });
  }

  try {
    const bytes = await readBody(request);
    const verdict = await clamdInstream(bytes);
    if (verdict === "stream: OK") {
      console.log(`CLEAN ${request.headers["x-object-key"] ?? "-"} (${bytes.length} bytes)`);
      return send(200, { status: "CLEAN", reason: "No signatures matched." });
    }
    const found = /(\S+) FOUND$/.exec(verdict);
    if (found) {
      console.warn(`BLOCKED ${request.headers["x-object-key"] ?? "-"} (${found[1]})`);
      return send(200, { status: "BLOCKED", reason: `Malware signature matched: ${found[1]}` });
    }
    console.error(`Unexpected clamd verdict: ${verdict}`);
    return send(502, { error: `Unexpected clamd verdict: ${verdict}` });
  } catch (error) {
    console.error("Scan failed:", error?.message ?? error);
    return send(error?.statusCode ?? 502, { error: String(error?.message ?? error) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Malware scanner gateway listening on :${PORT} -> ${CLAMD_HOST}:${CLAMD_PORT}`);
});

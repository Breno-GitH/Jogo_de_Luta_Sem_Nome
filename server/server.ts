import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { isIP } from "node:net";
import { Server } from "socket.io";
import { Rooms, RoomError, type RoomOptions } from "./rooms";
import { ENGINE_VERSION } from "../src/net/version";
import { PROTOCOL, exactObject, type Reply } from "../src/net/protocol";

interface Options extends RoomOptions {
  origins?: string[];
  staticDirectory?: string;
  autoTick?: boolean;
  serveFrontend?: boolean;
  trustLoopbackProxy?: boolean;
  serviceName?: string;
}
/** Node HTTP + Socket.IO. The browser has no endpoint that accepts combat
 * snapshots, health, damage, wins, clock changes or result declarations. */
export function createGameServer(options: Options = {}) {
  const staticRoot = path.resolve(options.staticDirectory ?? "dist");
  const http = createServer((req, res) => {
    if (req.url === "/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          service: options.serviceName ?? "jogo-luta",
          protocol: PROTOCOL,
          version: ENGINE_VERSION,
        }),
      );
      return;
    }
    if (options.serveFrontend === false) {
      res.writeHead(404).end();
      return;
    }
    serve(req, res, staticRoot);
  });
  const origins = options.origins ?? [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
  ];
  const originAllowed = (origin: string | undefined, host?: string) =>
    !origin ||
    origins.includes(origin) ||
    origin === `http://${host}` ||
    origin === `https://${host}`;
  const io = new Server(http, {
    maxHttpBufferSize: 8192,
    pingInterval: 3000,
    pingTimeout: 5000,
    serveClient: false,
    cors: { origin: origins, methods: ["GET", "POST"] },
    allowRequest: (req, done) =>
      done(null, originAllowed(req.headers.origin, req.headers.host)),
  });
  const rooms = new Rooms(
    (ids, event, payload) => {
      for (const id of ids) io.to(id).emit(event, payload);
    },
    () => performance.now(),
    options,
  );
  const addresses = new Map<string, { started: number; connections: number }>();
  io.use((socket, next) => {
    const peer = socket.handshake.address,
      forwarded = socket.handshake.headers["x-forwarded-for"],
      candidate =
        typeof forwarded === "string"
          ? forwarded.split(",").at(-1)!.trim()
          : "",
      key =
        options.trustLoopbackProxy &&
        ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer) &&
        isIP(candidate)
          ? candidate
          : peer,
      now = Date.now();
    let entry = addresses.get(key);
    if (!entry || now - entry.started > 60000) {
      entry = { started: now, connections: 0 };
      addresses.set(key, entry);
    }
    if (++entry.connections > 60) {
      next(new Error("Muitas conexões. Aguarde um minuto."));
      return;
    }
    next();
  });
  io.on("connection", (socket) => {
    let operations = 0,
      operationStart = Date.now(),
      inputs = 0,
      inputStart = Date.now(),
      violations = 0;
    socket.emit("net:hello", { protocol: PROTOCOL, version: ENGINE_VERSION });
    const limited = (input = false) => {
      const now = Date.now();
      if (input) {
        if (now - inputStart > 1000) {
          inputs = 0;
          inputStart = now;
        }
        if (++inputs > 150)
          throw new RoomError("rateLimit", "Muitos comandos enviados.");
      } else {
        if (now - operationStart > 60000) {
          operations = 0;
          operationStart = now;
        }
        if (++operations > 60)
          throw new RoomError(
            "rateLimit",
            "Muitas solicitações. Aguarde antes de tentar novamente.",
          );
      }
    };
    const reply = (ack: unknown, result: Reply<unknown>) => {
      if (typeof ack === "function") ack(result);
    };
    const route = (
      name: string,
      keys: string[],
      action: (payload: Record<string, unknown>) => unknown,
      version = false,
    ) => {
      socket.on(name, (payload: unknown, ack: unknown) => {
        try {
          limited();
          if (!exactObject(payload, keys))
            throw new RoomError("invalidRequest", "Solicitação inválida.");
          if (version && payload.version !== ENGINE_VERSION)
            throw new RoomError(
              "versionMismatch",
              "Versões diferentes. Atualize a página e tente novamente.",
            );
          const data = action(payload);
          reply(ack, { ok: true, data });
          if (name === "room:resume") rooms.afterResume(socket.id);
        } catch (error) {
          const known = error instanceof RoomError;
          reply(ack, {
            ok: false,
            code: known ? error.code : "serverError",
            message: known
              ? error.message
              : "Não foi possível concluir a solicitação.",
          });
        }
      });
    };
    route("room:create", ["version"], () => rooms.create(socket.id), true);
    route(
      "room:join",
      ["code", "version"],
      (payload) => rooms.join(socket.id, payload.code),
      true,
    );
    route(
      "room:resume",
      ["code", "token", "version"],
      (payload) => rooms.resume(socket.id, payload.code, payload.token),
      true,
    );
    route("room:select", ["character"], (payload) =>
      rooms.select(socket.id, payload.character),
    );
    route("room:ready", ["ready"], (payload) =>
      rooms.ready(socket.id, payload.ready),
    );
    route("room:confirm", [], () => rooms.confirm(socket.id));
    route("room:start", [], () => rooms.startMatch(socket.id));
    route("room:lobby", [], () => rooms.lobby(socket.id));
    route("room:rematch", [], () => rooms.rematch(socket.id));
    route("room:leave", [], () => rooms.leave(socket.id));
    route("match:sync", ["matchId"], (payload) =>
      rooms.sync(socket.id, payload.matchId),
    );
    socket.on("match:input", (payload: unknown) => {
      try {
        limited(true);
        rooms.input(socket.id, payload);
      } catch (error) {
        const known = error instanceof RoomError,
          code = known ? error.code : "invalidInput";
        socket.emit("input:rejected", {
          code,
          message: known ? error.message : "Comando inválido.",
        });
        if (
          !["staleMatch", "staleTick", "inputGap"].includes(code) &&
          ++violations >= 8
        )
          socket.disconnect(true);
      }
    });
    socket.on("net:ping", (ack: unknown) => {
      if (typeof ack === "function") ack({ time: Date.now() });
    });
    socket.on("disconnect", () => rooms.disconnect(socket.id));
  });
  const interval =
    options.autoTick === false
      ? undefined
      : setInterval(() => {
          rooms.pump();
          if (addresses.size > 1000)
            for (const [key, entry] of addresses)
              if (Date.now() - entry.started > 60000) addresses.delete(key);
        }, 4);
  return {
    http,
    io,
    rooms,
    async close() {
      if (interval) clearInterval(interval);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
function serve(req: IncomingMessage, res: ServerResponse, root: string) {
  if (!["GET", "HEAD"].includes(req.method ?? "")) {
    res.writeHead(405).end();
    return;
  }
  let relative: string;
  try {
    relative = decodeURIComponent(
      new URL(req.url ?? "/", "http://localhost").pathname,
    );
  } catch {
    res.writeHead(400).end();
    return;
  }
  const file = path.resolve(
    root,
    `.${relative.endsWith("/") ? relative + "index.html" : relative}`,
  );
  if (
    !file.startsWith(root + path.sep) ||
    relative.split("/").some((part) => part.startsWith(".")) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  ) {
    res
      .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      .end(
        "Cliente não encontrado. Gere o build antes de iniciar o servidor de produção.",
      );
    return;
  }
  res.setHeader(
    "Content-Type",
    mime[path.extname(file)] ?? "application/octet-stream",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-cache");
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file)
    .on("error", () => res.destroy())
    .pipe(res);
}

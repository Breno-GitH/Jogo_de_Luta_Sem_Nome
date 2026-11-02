import { createGameServer } from "./server";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const port = Number(process.env.PORT ?? 3001),
  host = process.env.HOST ?? "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT inválida");
const app = createGameServer({
  origins: process.env.ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  delay: Number(process.env.INPUT_DELAY_TICKS ?? 6),
});
app.http.listen(port, host, () =>
  console.log(
    `Jogo de luta: http://${host}:${port} (cliente de produção + Socket.IO)`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });

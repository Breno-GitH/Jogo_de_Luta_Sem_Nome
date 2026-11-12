import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { get } from "node:http";
import { networkInterfaces, hostname } from "node:os";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
if (existsSync(".env")) process.loadEnvFile(".env");
const port = 3001,
  host = "127.0.0.1",
  pidFile = "deployment/run/msfd-backend.json";
if (!existsSync("server-dist/server-core.mjs")) {
  console.error("Execute atualizar-xampp.bat antes de iniciar o multiplayer.");
  process.exit(1);
}
const running = await new Promise((resolve) => {
  const r = get(`http://${host}:${port}/health`, { timeout: 1000 }, (res) => {
    let body = "";
    res.on("data", (b) => (body += b));
    res.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
  });
  r.on("timeout", () => r.destroy());
  r.on("error", () => resolve(null));
});
if (running?.service === "jogo-luta-lan") {
  const version = readFileSync("src/net/version.ts", "utf8").match(
    /ENGINE_VERSION = "([^"]+)"/,
  )[1];
  if (running.version !== version) {
    console.error(
      "O backend em execução usa uma versão antiga. Encerre-o com Ctrl+C e inicie novamente.",
    );
    process.exit(1);
  }
  console.log(
    "O multiplayer já está em execução. Abra http://localhost/jogo-luta/",
  );
  process.exit(0);
}
const { createGameServer } = await import("../server-dist/server-core.mjs");
const app = createGameServer({
  serveFrontend: false,
  trustLoopbackProxy: true,
  serviceName: "jogo-luta-lan",
  origins: [],
  delay: Number(process.env.INPUT_DELAY_TICKS ?? 6),
});
app.http.on("error", (e) => {
  console.error(
    e.code === "EADDRINUSE"
      ? "A porta interna 3001 está ocupada. Nenhuma segunda cópia foi iniciada. Encerre o processo antigo antes de atualizar."
      : e,
  );
  process.exit(1);
});
app.http.listen(port, host, () => {
  mkdirSync("deployment/run", { recursive: true });
  writeFileSync(
    pidFile,
    JSON.stringify({
      pid: process.pid,
      project: process.cwd(),
      host,
      port,
      started: new Date().toISOString(),
    }),
  );
  console.log("Multiplayer LAN ativo. Backend interno em 127.0.0.1:3001.");
  console.log("No servidor: http://localhost/2025/M.S.F.D/");
  for (const entries of Object.values(networkInterfaces()))
    for (const n of entries ?? [])
      if (n.family === "IPv4" && !n.internal)
        console.log(`Na rede: http://${n.address}/2025/M.S.F.D/`);
  console.log(
    `Nome do computador (se resolvido pela rede): http://${hostname()}/2025/M.S.F.D/`,
  );
  console.log(
    "Apache precisa estar iniciado no XAMPP. Ctrl+C encerra este backend. Diagnóstico: node scripts/verificar-lan.mjs",
  );
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(
    signal,
    () =>
      void app.close().then(() => {
        if (
          existsSync(pidFile) &&
          JSON.parse(readFileSync(pidFile, "utf8")).pid === process.pid
        )
          unlinkSync(pidFile);
        process.exit(0);
      }),
  );

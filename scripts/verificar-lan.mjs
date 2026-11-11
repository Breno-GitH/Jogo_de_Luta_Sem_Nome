import { networkInterfaces, hostname } from "node:os";
import { io } from "socket.io-client";

const route = "/2025/Jogo_de_Luta_Sem_Nome/";
const local = new URL(route, "http://localhost");
const alias = new URL("/jogo-luta/", local);
const ipv4 = Object.entries(networkInterfaces()).flatMap(([name, addresses]) =>
  (addresses ?? []).filter(n => n.family === "IPv4" && !n.internal)
    .map(n => ({ name, ip: n.address })),
);
console.log("Computador anfitrião:", hostname());
console.log("URL local:", local.href);
for (const { name, ip } of ipv4)
  console.log(`Interface ${name} · convidados: http://${ip}${route}`);
if (!ipv4.length) console.error("Nenhuma interface IPv4 de rede encontrada.");

async function json(base, path) {
  const url = new URL(path, base);
  const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url.href}`);
  return response.json();
}
async function check(base) {
  const [frontend, backend] = await Promise.allSettled([
    json(base, "build-info.json"),
    json(base, "api/health"),
  ]);
  console.log(`\n${base.href}`);
  for (const [name, result] of [["Apache / frontend", frontend], ["Proxy / Node", backend]]) {
    if (result.status === "fulfilled")
      console.log(`  ${name} ativo · versão ${result.value.version ?? "desconhecida"}`);
    else
      console.error(`  ${name} indisponível · ${result.reason.message}`);
  }
  if (frontend.status === "rejected" || backend.status === "rejected" ||
      !frontend.value.version || backend.value.service !== "jogo-luta-lan" ||
      frontend.value.version !== backend.value.version) {
    console.error("  Verifique Apache, iniciar-multiplayer.bat e a publicação do mesmo build nos dois processos.");
    return false;
  }
  return true;
}
function socketCheck(base) {
  return new Promise((resolve) => {
    const socket = io(base.origin, {
      autoConnect: false,
      reconnection: false,
      timeout: 3000,
      path: new URL("socket.io/", base).pathname,
      extraHeaders: { Origin: base.origin },
    });
    let done = false;
    const finish = (message, ok) => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      socket.disconnect();
      console.log(`  Socket.IO ${message}`);
      resolve(ok);
    };
    const deadline = setTimeout(() => finish("sem upgrade para WebSocket", false), 5500);
    const verifyPing = () => {
      const at = performance.now();
      socket.timeout(1500).emit("net:ping", error => {
        if (error) finish("upgrade realizado, porém sem resposta do jogo", false);
        else finish(`upgrade confirmado para WebSocket · ping ${Math.round(performance.now() - at)} ms`, true);
      });
    };
    socket.io.on("open", () => {
      const engine = socket.io.engine;
      console.log(`  Socket.IO conectado por ${engine.transport.name}`);
      if (engine.transport.name === "websocket") verifyPing();
      else engine.once("upgrade", verifyPing);
    });
    socket.on("connect_error", error => finish(`falhou · ${error.message}`, false));
    socket.connect();
  });
}

try {
  const internal = await json(new URL("http://127.0.0.1:3001"), "health");
  if (internal.service !== "jogo-luta-lan") throw new Error("Outro serviço usa a porta 3001.");
  console.log(`Node interno ativo · versão ${internal.version}`);
} catch (error) {
  console.error(`Node interno indisponível · ${error.message}. Execute iniciar-multiplayer.bat.`);
  process.exitCode = 1;
}
for (const url of [local, alias]) {
  if (!(await check(url)) || !(await socketCheck(url))) process.exitCode = 1;
}
let reachable = false;
for (const { ip } of ipv4) {
  const url = new URL(route, `http://${ip}`);
  if (await check(url) && await socketCheck(url)) reachable = true;
}
if (!reachable) process.exitCode = 1;
console.log("\nOs testes acima saíram do anfitrião. Confirme a rota em outro PC da mesma rede.");
console.log("Se o convidado não abrir a página, permita TCP 80 do Apache somente no perfil Privado e com escopo LocalSubnet.");

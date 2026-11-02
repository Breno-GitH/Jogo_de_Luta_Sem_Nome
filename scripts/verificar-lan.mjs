import { get } from "node:http";
import { networkInterfaces, hostname } from "node:os";
console.log("Servidor:", hostname());
for (const list of Object.values(networkInterfaces()))
  for (const n of list ?? [])
    if (n.family === "IPv4" && !n.internal)
      console.log(`Endereco detectado: http://${n.address}/jogo-luta/`);
for (const url of [
  "http://localhost/jogo-luta/build-info.json",
  "http://localhost/jogo-luta/api/health",
  "http://localhost/2025/Jogo_de_Luta_Sem_Nome/build-info.json",
  "http://localhost/2025/Jogo_de_Luta_Sem_Nome/api/health",
]) {
  await new Promise((resolve) => {
    const r = get(url, { timeout: 3000 }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => {
        console.log(res.statusCode, url, b.slice(0, 300));
        if (res.statusCode !== 200) process.exitCode = 1;
        resolve();
      });
    });
    r.on("timeout", () => r.destroy());
    r.on("error", (e) => {
      console.error(url, e.message);
      process.exitCode = 1;
      resolve();
    });
  });
}

import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
  rmSync,
  cpSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "node:http";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const active = await new Promise((resolve) => {
  const r = get("http://127.0.0.1:3001/health", { timeout: 1000 }, (res) => {
    res.resume();
    resolve(res.statusCode === 200);
  });
  r.on("timeout", () => r.destroy());
  r.on("error", () => resolve(false));
});
if (active) {
  console.error(
    "Encerre o backend multiplayer com Ctrl+C antes de atualizar. Nenhuma versao foi publicada.",
  );
  process.exit(1);
}
const stage = path.join(root, "deployment", "staging"),
  client = path.join(stage, "client"),
  previous = path.join(root, "deployment", "previous-dist"),
  dist = path.join(root, "dist");
function confined(p) {
  const rel = path.relative(root, p);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel))
    throw Error("Destino fora do projeto: " + p);
}
function clean(p) {
  confined(p);
  rmSync(p, { recursive: true, force: true });
}
function moveDirectory(from, to) {
  confined(from);
  confined(to);
  try {
    renameSync(from, to);
  } catch (error) {
    if (process.platform !== "win32" || error.code !== "EPERM") throw error;
    // Windows can deny cross-directory rename. Copy only into a fresh target,
    // publishing index.html last, so stale assets are never mixed into a build.
    if (existsSync(to)) throw error;
    mkdirSync(to);
    try {
      const entries = readdirSync(from).sort(
        (a, b) => Number(a === "index.html") - Number(b === "index.html"),
      );
      for (const entry of entries)
        cpSync(path.join(from, entry), path.join(to, entry), {
          recursive: true,
          errorOnExist: true,
          force: false,
        });
    } catch (copyError) {
      clean(to);
      throw copyError;
    }
    clean(from);
  }
}
function run(file, args) {
  const r = spawnSync(process.execPath, [file, ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (r.status !== 0) throw Error("Build interrompido: " + file);
}
try {
  clean(stage);
  mkdirSync(stage, { recursive: true });
  run("scripts/net_version.mjs", []);
  run("node_modules/typescript/bin/tsc", ["--noEmit"]);
  run("node_modules/vite/bin/vite.js", ["build", "--outDir", client]);
  run("scripts/build_server.mjs", []);
  const version = readFileSync("src/net/version.ts", "utf8").match(
    /ENGINE_VERSION = "([^"]+)"/,
  )[1];
  writeFileSync(
    path.join(client, "build-info.json"),
    JSON.stringify(
      {
        version,
        builtAt: new Date().toISOString(),
        base: "relative",
        aliases: ["/jogo-luta/", "/2025/Jogo_de_Luta_Sem_Nome/"],
      },
      null,
      2,
    ),
  );
  clean(previous);
  confined(dist);
  if (existsSync(dist)) moveDirectory(dist, previous);
  try {
    moveDirectory(client, dist);
  } catch (e) {
    if (existsSync(previous)) moveDirectory(previous, dist);
    throw e;
  }
  clean(stage);
  console.log("Build publicado para Apache. Versao:", version);
  console.log(
    "http://localhost/jogo-luta/\nhttp://localhost/2025/Jogo_de_Luta_Sem_Nome/",
  );
} catch (e) {
  console.error(e);
  process.exit(1);
}

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
  realpathSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "node:http";
const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
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
    "Backend LAN ativo. Use atualizar-msfd.cmd para atualizar com reinicio do servico. Nenhuma versao foi publicada.",
  );
  process.exit(1);
}
const work = path.join(root, "deployment", "msfd-work");
const stage = path.join(work, "staging");
const client = path.join(stage, "client");
const server = path.join(stage, "server");
const previous = path.join(work, "previous");
const dist = path.join(root, "dist");
const serverDist = path.join(root, "server-dist");
function confined(p) {
  let existing = p;
  while (!existsSync(existing)) existing = path.dirname(existing);
  for (const target of [
    p,
    path.resolve(realpathSync(existing), path.relative(existing, p)),
  ]) {
    const rel = path.relative(root, target);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel))
      throw Error("Destino fora do projeto: " + p);
  }
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
  run("scripts/build_server.mjs", [server]);
  const git = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  const commit = git.status === 0 ? git.stdout.trim() : null;
  const version = readFileSync("src/net/version.ts", "utf8").match(
    /ENGINE_VERSION = "([^"]+)"/,
  )[1];
  writeFileSync(
    path.join(client, "build-info.json"),
    JSON.stringify(
      {
        version,
        commit,
        builtAt: new Date().toISOString(),
        base: "relative",
        aliases: [
          "/2025/M.S.F.D/",
          "/jogo-luta/",
          "/2025/Jogo_de_Luta_Sem_Nome/",
        ],
      },
      null,
      2,
    ),
  );
  clean(previous);
  mkdirSync(previous);
  const outputs = [
    [server, serverDist],
    [client, dist],
  ];
  const backups = [];
  const published = [];
  try {
    for (const [, target] of outputs) {
      if (!existsSync(target)) continue;
      const backup = path.join(previous, path.basename(target));
      moveDirectory(target, backup);
      backups.push([backup, target]);
    }
    for (const [source, target] of outputs) {
      moveDirectory(source, target);
      published.push(target);
    }
  } catch (error) {
    for (const target of published) clean(target);
    for (const [backup, target] of backups.reverse())
      moveDirectory(backup, target);
    throw error;
  }
  clean(stage);
  console.log(
    "Build publicado para Apache. Commit:",
    commit,
    "| Motor:",
    version,
  );
  console.log("http://localhost/2025/M.S.F.D/");
} catch (e) {
  console.error(e);
  process.exit(1);
}

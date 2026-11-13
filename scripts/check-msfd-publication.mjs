import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const base = new URL(process.argv[2] ?? "http://localhost/2025/M.S.F.D/");
const expectedCommit = process.argv[3];
const dist = new URL("../dist/", import.meta.url);
const digest = (data) => createHash("sha256").update(data).digest("hex");

async function served(path, search = "") {
  const url = new URL(path, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new Error("Recurso fora da publicacao: " + url.href);
  }
  url.search = search;
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new Error(`${url.href} retornou HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

try {
  const checked = new Set();
  async function verify(path, disk = path) {
    const actual = await served(path);
    const local = await readFile(new URL(disk, dist));
    if (digest(actual) !== digest(local)) {
      throw new Error(
        `Apache serviu bytes diferentes de dist em ${path || "index.html"}`,
      );
    }
    checked.add(path);
    return actual.toString("utf8");
  }

  const build = JSON.parse(await verify("build-info.json"));
  if (expectedCommit && build.commit !== expectedCommit) {
    throw new Error(
      `Commit servido ${build.commit} diverge de ${expectedCommit}`,
    );
  }
  const html = await verify("", "index.html");
  const bundles = [
    ...html.matchAll(/(?:src|href)=["'](?:\.\/)?(assets\/[^"'?#]+)["']/g),
  ].map((match) => match[1]);
  if (!bundles.some((path) => path.endsWith(".js")))
    throw new Error("Index sem bundle de producao.");
  const portraits = (
    await readdir(new URL("sprites/ben/omnitrix/", dist))
  ).filter((name) => name.endsWith(".png"));
  if (portraits.length !== 12)
    throw new Error("Inventario de retratos do Omnitrix incompleto.");
  await Promise.all(
    [
      ...new Set([
        ...bundles,
        ...portraits.map((name) => `sprites/ben/omnitrix/${name}`),
        "sprites/ben/alien-x.png",
        "sprites/fx/alien-x-dimension.png",
        "sprites/fx/alien-x-bellicus.png",
        "sprites/fx/alien-x-serena.png",
        "sprites/ben/gravattack/stage7.png",
        ...["base", "movement", "reactions", "normals", "specials", "pandemonium"]
          .map(name => `sprites/xebec/${name}.png`),
      ]),
    ].map((path) => verify(path)),
  );

  const health = JSON.parse((await served("api/health")).toString("utf8"));
  if (health.service !== "jogo-luta-lan" || health.version !== build.version) {
    throw new Error(
      "Backend LAN e frontend Apache divergem: " + health.version,
    );
  }
  const handshake = (
    await served("socket.io/", "?EIO=4&transport=polling")
  ).toString("utf8");
  if (!handshake.startsWith("0") || !JSON.parse(handshake.slice(1)).sid) {
    throw new Error("Handshake Socket.IO ausente no Apache.");
  }
  console.log(`M.S.F.D. verificado em ${base.href}`);
  console.log(
    `Commit ${build.commit} | Motor ${build.version} | Build ${build.builtAt}`,
  );
  console.log(
    `${checked.size} arquivos com SHA-256 identico a dist, backend e Socket.IO verificados.`,
  );
} catch (error) {
  console.error("Publicacao nao verificada:", error.message);
  process.exitCode = 1;
}

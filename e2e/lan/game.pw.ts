import {
  test,
  expect,
  chromium,
  type Browser,
  type Page,
} from "@playwright/test";
import { networkInterfaces, hostname } from "node:os";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { io } from "socket.io-client";
import type { createGameServer as Factory } from "../../server/server";
import type { CharacterId } from "../../src/engine/characters";
const { Match, characters, snapshot, hashState } =
  await import("../../deployment/run/lan-fixtures.mjs");
import { ENGINE_VERSION } from "../../src/net/version";
const { createGameServer } =
  (await import("../../server-dist/server-core.mjs")) as {
    createGameServer: typeof Factory;
  };
const audit = "deployment/audit/lan";
mkdirSync(audit, { recursive: true });
const ip = Object.values(networkInterfaces())
  .flat()
  .find(
    (n) =>
      n?.family === "IPv4" &&
      !n.internal &&
      /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address),
  )?.address;
const local = "http://localhost/jogo-luta/",
  remote = `http://${ip ?? "localhost"}/2025/Jogo_de_Luta_Sem_Nome/`;
let app: ReturnType<typeof createGameServer>,
  browsers: Browser[] = [],
  a: Page,
  b: Page;
const hashes = new Map<string, string>();
let graceMs = 6500;
async function startServer() {
  app = createGameServer({
    origins: [],
    serveFrontend: false,
    trustLoopbackProxy: true,
    serviceName: "jogo-luta-lan",
    graceMs,
    inputTimeoutMs: 6000,
    lobbyTtlMs: 60000,
  });
  app.io.on("connection", (s) =>
    s.onAnyOutgoing((event, p) => {
      if (event === "match:step") hashes.set(p.matchId + ":" + p.tick, p.hash);
    }),
  );
  await new Promise<void>((r) => app.http.listen(3001, "127.0.0.1", r));
}
test.beforeAll(startServer);
test.afterAll(async () => {
  await app.close();
});
test.beforeEach(async () => {
  browsers = await Promise.all([
    chromium.launch({ channel: "chrome", headless: true }),
    chromium.launch({ channel: "chrome", headless: true }),
  ]);
  a = await browsers[0].newPage({ viewport: { width: 1440, height: 1100 } });
  b = await browsers[1].newPage({ viewport: { width: 1440, height: 1100 } });
});
test.afterEach(async () => {
  await Promise.all(browsers.map((x) => x.close()));
});
async function entry(p: Page, url: string) {
  await p.goto(url);
  await p.click("#online");
  await expect(p.locator("#app")).toHaveAttribute(
    "data-connection",
    "connected",
    { timeout: 20000 },
  );
}
async function pair(c0: CharacterId = "samurai", c1: CharacterId = "samurai") {
  await entry(a, local);
  await entry(b, remote);
  await a.click("#create-room");
  const code = (await a.locator("#lobby-code").innerText()).trim();
  await b.fill("#room-code", code);
  await b.click("#join-room");
  await expect(b.locator("#lobby-code")).toHaveText(code);
  for (const [p, c] of [
    [a, c0],
    [b, c1],
  ] as const) {
    await p.check(`#online-${c}`);
    await p.click("#online-confirm");
    await p.click("#online-ready");
  }
  await expect(a.locator("#online-start")).toBeEnabled();
  await a.click("#online-start");
  for (const p of [a, b])
    await expect(p.locator("canvas")).toHaveAttribute(
      "data-match-phase",
      "fight",
      { timeout: 10000 },
    );
  await observe(a);
  await observe(b);
  return code;
}
async function observe(p: Page) {
  await p.evaluate(() => {
    const root = document.querySelector<HTMLElement>("#app")!,
      canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
    (window as any).netRecords = {};
    new MutationObserver(() => {
      const d = root.dataset;
      if (d.netTick && d.netMatch)
        (window as any).netRecords[d.netMatch + ":" + d.netTick] = {
          hash: d.netHash,
          fury: canvas.dataset.furyPhase,
          road: canvas.dataset.roadPhase,
          time: canvas.dataset.timeRemaining,
          zoom: canvas.dataset.cameraZoom,
          p1: canvas.dataset.p1Health,
          p2: canvas.dataset.p2Health,
        };
    }).observe(root, { attributes: true });
  });
}
async function consistent() {
  await expect
    .poll(
      async () => {
        const x = await a.evaluate(() => (window as any).netRecords),
          y = await b.evaluate(() => (window as any).netRecords),
          common = Object.keys(x).filter((k) => y[k] && hashes.has(k));
        return (
          common.length >= 10 &&
          common.every(
            (k) => x[k].hash === y[k].hash && x[k].hash === hashes.get(k),
          )
        );
      },
      { timeout: 10000 },
    )
    .toBe(true);
}
async function seed(code: string, distance = 90, meter = 0) {
  const r = app.rooms.rooms.get(code)!;
  r.match = new Match(
    characters[r.players[0]!.character!],
    {},
    characters[r.players[1]!.character!],
  );
  r.match.phase = "fight";
  r.match.message = "";
  r.match.fighters[0].x = 500;
  r.match.fighters[1].x = 500 + distance;
  for (const f of r.match.fighters) {
    f.meter = meter;
    if (f.stand) {
      f.stand.s.x = f.x - 30 * f.facing;
      f.stand.s.y = f.y - 18;
    }
  }
  r.status = "playing";
  r.syncs = [];
  app.rooms.sync(r.players[0]!.socketId, r.matchId);
  for (const p of [a, b])
    await expect(p.locator("#app")).toHaveAttribute(
      "data-net-match",
      r.matchId,
    );
  return r;
}
async function press(p: Page, key: string) {
  await p.keyboard.down(key);
  await p.waitForTimeout(70);
  await p.keyboard.up(key);
}
async function motion(p: Page, pattern: number[], button: string) {
  for (let i = 0; i < pattern.length; i++) {
    for (const key of ["a", "d", "s"]) await p.keyboard.up(key);
    const v = pattern[i];
    if ([2, 3, 1].includes(v)) await p.keyboard.down("s");
    if ([3, 6].includes(v)) await p.keyboard.down("d");
    if ([1, 4].includes(v)) await p.keyboard.down("a");
    if (i === pattern.length - 1) await p.keyboard.down(button);
    await p.waitForTimeout(65);
  }
  for (const key of ["a", "d", "s", button]) await p.keyboard.up(key);
}
async function capture(code: string, name: string) {
  const r = app.rooms.rooms.get(code)!;
  r.nextAt = performance.now() + 2000;
  const tick = String(r.tick);
  try {
    for (const p of [a, b])
      await expect(p.locator("#app")).toHaveAttribute("data-net-tick", tick);
    const ds = await Promise.all(
      [a, b].map((p) =>
        p.locator("canvas").evaluate((c) => ({ ...c.dataset })),
      ),
    );
    expect(ds[0].cameraZoom).toBe(ds[1].cameraZoom);
    expect(ds[0].furyTick).toBe(ds[1].furyTick);
    expect(ds[0].roadTick).toBe(ds[1].roadTick);
    for (let i = 0; i < 2; i++) {
      const data = await [a, b][i]
        .locator("canvas")
        .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
      writeFileSync(
        `${audit}/${name}-p${i + 1}.png`,
        Buffer.from(data.split(",")[1], "base64"),
      );
    }
    writeFileSync(
      `${audit}/${name}.json`,
      JSON.stringify(
        { tick, hash: hashState(snapshot(r.match!)), clients: ds },
        null,
        2,
      ),
    );
  } finally {
    r.nextAt = performance.now();
  }
}

test("Apache aliases, nested labs, static resources and production build are independent of Vite", async () => {
  const errors: string[] = [];
  a.on("pageerror", (e) => errors.push(e.message));
  const bad: string[] = [];
  a.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("api/")) bad.push(r.url());
  });
  for (const url of [local, remote]) {
    await a.goto(url);
    await expect(a.locator("#training")).toBeVisible();
    for (const [mode, character, difficulty] of [
      ["versus", "samurai", "easy"],
      ["versus", "dio", "hard"],
      ["arcade", "goku", "normal"],
    ]) {
      await a.click(`#${mode}`);
      await a.check(`input[name="character"][value="${character}"]`);
      if (mode === "versus") await a.selectOption("#difficulty", difficulty);
      await a.click("#fight");
      await expect(a.locator("#app")).toHaveAttribute("data-screen", "fight");
      await expect(a.locator("canvas")).toHaveAttribute(
        "data-character",
        character,
      );
      await a.click("#menu");
    }
    await a.click("#training");
    await a.check('input[name="character"][value="goku"]');
    await a.click("#fight");
    await expect(a.locator("#app")).toHaveAttribute("data-screen", "fight");
    await expect(a.locator("canvas")).toHaveAttribute("data-character", "goku");
    await a.goto(url + "art/goku-fury.html");
    await expect(a.locator("#arena")).toHaveAttribute("data-loaded", "true", {
      timeout: 20000,
    });
  }
  expect(errors).toEqual([]);
  expect(bad).toEqual([]);
  for (const url of [local, remote, `http://${hostname()}/jogo-luta/`]) {
    const res = await a.request.get(url + "build-info.json");
    expect(res.ok()).toBe(true);
    expect((await res.json()).version).toBe(ENGINE_VERSION);
  }
  for (const path of [
    "src/main.ts",
    "node_modules/package.json",
    ".env",
    "server/index.ts",
    "assets/",
  ]) {
    const r = await a.request.get(local + path);
    expect([403, 404]).toContain(r.status());
  }
  const health = await (await a.request.get(local + "api/health")).json();
  expect(health.version).toBe(ENGINE_VERSION);
  writeFileSync(
    audit + "/apache.json",
    JSON.stringify(
      {
        local,
        remote,
        hostname: hostname(),
        actualSecondComputer: false,
        errors,
        bad,
        health,
      },
      null,
      2,
    ),
  );
});

test("rooms validate codes, enforce two seats, confirmation/host start, isolate rooms, and upgrade polling to WebSocket", async () => {
  await entry(a, local);
  await entry(b, remote);
  await b.fill("#room-code", "XXXXXX");
  await b.click("#join-room");
  await expect(b.locator("#online-error")).toContainText("não encontrada");
  await a.click("#create-room");
  const code = (await a.locator("#lobby-code").innerText()).trim();
  await b.fill("#room-code", code);
  await b.click("#join-room");
  await expect(b.locator("#lobby-code")).toHaveText(code);
  const third = io("http://localhost", {
    path: "/jogo-luta/socket.io",
    extraHeaders: { Origin: "http://localhost" },
  });
  await new Promise((r) => third.on("connect", r));
  const full = await third
    .timeout(2000)
    .emitWithAck("room:join", { code, version: ENGINE_VERSION });
  expect(full.code).toBe("roomFull");
  const invalid = await third
    .timeout(2000)
    .emitWithAck("room:join", { code: "BAD", version: ENGINE_VERSION });
  expect(invalid.code).toBe("invalidCode");
  const own = await third
    .timeout(2000)
    .emitWithAck("room:create", { version: ENGINE_VERSION });
  expect(own.data.room.code).not.toBe(code);
  for (const transport of ["polling", "websocket"] as const) {
    const hostile = io("http://localhost", {
      path: "/jogo-luta/socket.io",
      extraHeaders: { Origin: "http://untrusted.invalid" },
      transports: [transport],
      reconnection: false,
      forceNew: true,
    });
    const rejected = await new Promise<boolean>((resolve) => {
      hostile.once("connect_error", () => resolve(true));
      hostile.once("connect", () => resolve(false));
    });
    hostile.disconnect();
    expect(rejected).toBe(true);
  }
  await a.check("#online-dio");
  await a.click("#online-confirm");
  await a.click("#online-ready");
  await b.check("#online-goku");
  await b.click("#online-confirm");
  await b.click("#online-ready");
  await expect(a.locator("#app")).toHaveAttribute("data-screen", "onlineLobby");
  await a.click("#online-start");
  for (const p of [a, b])
    await expect(p.locator("canvas")).toHaveAttribute(
      "data-match-phase",
      "fight",
    );
  await observe(a);
  await observe(b);
  await consistent();
  expect(app.rooms.rooms.get(own.data.room.code)!.match).toBeUndefined();
  await expect
    .poll(
      () =>
        [...app.io.sockets.sockets.values()].filter(
          (s) => s.conn.transport.name === "websocket",
        ).length,
    )
    .toBeGreaterThanOrEqual(3);
  third.disconnect();
});

for (const character of ["samurai", "dio", "goku"] as const)
  test(`${character}: real attacks and special cinematic stay authoritative on both clients`, async () => {
    const code = await pair(character, character),
      r = await seed(code, 70);
    await press(a, "j");
    await expect.poll(() => r.match!.fighters[1].health).toBeLessThan(1000);
    await consistent();
    if (character === "samurai") {
      await seed(code, 100);
      await motion(a, [2, 3, 6], "j");
      await expect
        .poll(() => app.rooms.rooms.get(code)!.match!.fighters[1].health)
        .toBeLessThan(1000);
      const s = await seed(code, 100, 100);
      await press(a, "r");
      await expect.poll(() => s.match!.capture?.kind).toBe("ultimate");
      await capture(code, "samurai-super");
      await expect
        .poll(() => s.match!.capture, { timeout: 10000 })
        .toBeUndefined();
    } else if (character === "dio") {
      const s = await seed(code, 200);
      await motion(a, [6, 3, 2], "l");
      await expect.poll(() => s.match!.temporal.active).toBe(true);
      const uses = s.match!.temporal.s.ledger[0].uses;
      await capture(code, "dio-time-stop");
      await press(a, "j");
      await expect
        .poll(() => s.match!.temporal.active, { timeout: 6000 })
        .toBe(false);
      expect(s.match!.temporal.s.ledger[0].uses).toBe(uses);
      expect(s.match!.temporal.s.ledger[0].cooldown).toBeGreaterThan(0);
      await seed(code, 320);
      await motion(a, [2, 3, 6], "k");
      await expect
        .poll(() => app.rooms.rooms.get(code)!.match!.fighters[1].health)
        .toBeLessThan(1000);
      await seed(code, 110);
      await motion(a, [2, 1, 4], "j");
      await expect
        .poll(() => app.rooms.rooms.get(code)!.match!.fighters[1].combo)
        .toBeGreaterThan(1);
      const rr = await seed(code, 110, 200);
      await press(a, "r");
      await expect.poll(() => !!rr.match!.roadRoller).toBe(true);
      await expect(a.locator("canvas")).toHaveAttribute(
        "data-road-phase",
        "barrage",
      );
      await capture(code, "dio-road-roller");
      await expect
        .poll(() => rr.match!.roadRoller, { timeout: 10000 })
        .toBeUndefined();
    } else {
      await seed(code, 300);
      await motion(a, [2, 3, 6], "k");
      await expect
        .poll(() => app.rooms.rooms.get(code)!.match!.fighters[1].health)
        .toBeLessThan(1000);
      await seed(code, 300);
      await motion(a, [2, 1, 4], "l");
      await expect
        .poll(() => app.rooms.rooms.get(code)!.match!.fighters[1].combo)
        .toBeGreaterThan(1);
      const tele = await seed(code, 200);
      await motion(a, [2, 5, 2], "k");
      await expect
        .poll(() => tele.match!.fighters[0].x)
        .toBeGreaterThan(tele.match!.fighters[1].x);
      const fury = await seed(code, 240, 100);
      await motion(a, [2, 3, 6, 2, 3, 6], "l");
      await expect.poll(() => !!fury.match!.fury, { timeout: 6000 }).toBe(true);
      await expect(a.locator("canvas")).toHaveAttribute(
        "data-fury-phase",
        "beam",
        { timeout: 10000 },
      );
      await capture(code, "goku-fury");
      await expect
        .poll(() => fury.match!.fury, { timeout: 10000 })
        .toBeUndefined();
      expect(fury.match!.fighters[0].meter).toBe(0);
      expect(fury.match!.fighters[1].health).toBe(632);
    }
    await consistent();
    for (const p of [a, b])
      await expect(p.locator("canvas")).toHaveAttribute(
        "data-camera-zoom",
        "1",
      );
  });

for (const [left, right] of [
  ["samurai", "dio"],
  ["dio", "goku"],
  ["goku", "samurai"],
] as const)
  test(`${left} vs ${right}: both players move and player two attacks facing left`, async () => {
    const code = await pair(left, right),
      r = await seed(code, 260);
    const x0 = r.match!.fighters[0].x,
      x1 = r.match!.fighters[1].x;
    await a.keyboard.down("d");
    await b.keyboard.down("a");
    await a.waitForTimeout(200);
    await a.keyboard.up("d");
    await b.keyboard.up("a");
    await expect.poll(() => r.match!.fighters[0].x).toBeGreaterThan(x0);
    await expect.poll(() => r.match!.fighters[1].x).toBeLessThan(x1);
    await seed(code, 70);
    await press(b, "j");
    await expect.poll(() => r.match!.fighters[0].health).toBeLessThan(1000);
    await consistent();
  });

test("refresh resumes the same room, disconnect terminates safely, lobby reuse, rematch and backend restart", async () => {
  const code = await pair("goku", "dio");
  await b.reload();
  await b.click("#online");
  await expect(b.locator("#app")).toHaveAttribute(
    "data-screen",
    "onlineFight",
    { timeout: 12000 },
  );
  await observe(b);
  const r = await seed(code, 80);
  for (let round = 0; round < 2; round++) {
    await expect.poll(() => r.match!.phase, { timeout: 10000 }).toBe("fight");
    const victim = r.match!.fighters[1];
    victim.x = r.match!.fighters[0].x + 70;
    victim.health = 1;
    if (victim.stand) {
      victim.stand.s.x = victim.x - 30 * victim.facing;
      victim.stand.s.y = victim.y - 18;
    }
    r.syncs = [];
    app.rooms.sync(r.players[0]!.socketId, r.matchId);
    await expect(a.locator("#app")).toHaveAttribute(
      "data-net-match",
      r.matchId,
    );
    await press(a, "j");
    await expect
      .poll(() => r.match!.phase, { timeout: 5000 })
      .not.toBe("fight");
  }
  for (const p of [a, b])
    await expect(p.locator("#app")).toHaveAttribute(
      "data-screen",
      "onlineResult",
    );
  const old = r.matchId;
  await a.click("#online-rematch");
  await b.click("#online-rematch");
  await expect.poll(() => r.matchId).not.toBe(old);
  expect(r.match!.fighters.map((f) => f.data.id)).toEqual(["goku", "dio"]);
  await browsers[1].close();
  await expect(a.locator("#app")).toHaveAttribute(
    "data-screen",
    "onlineResult",
    { timeout: 12000 },
  );
  await a.click("#online-lobby");
  await expect(a.locator("#lobby-code")).toHaveText(code);
  expect(app.rooms.rooms.get(code)!.status).toBe("lobby");
  await app.close();
  await expect(a.locator("#app")).not.toHaveAttribute(
    "data-connection",
    "connected",
  );
  await startServer();
  await expect(a.locator("#online-error")).toContainText(
    /expirou|recuperar|servidor|conexão/i,
    { timeout: 15000 },
  );
  await a.click("#reconnect-online");
  await expect(a.locator("#create-room")).toBeEnabled({ timeout: 10000 });
  await a.click("#create-room");
  await expect(a.locator("#lobby-code")).toBeVisible();
});

// Opt-in: the test operator stops and starts the Apache process that they own.
// Nothing here changes machine services or exposes a test endpoint over HTTP.
test("Apache outage pauses and resumes both real browser clients", async () => {
  test.skip(
    process.env.TEST_APACHE_OUTAGE !== "1",
    "Requires an operator-owned Apache restart",
  );
  await app.close();
  graceMs = 30000;
  await startServer();
  const code = await pair("dio", "goku");
  await consistent();
  writeFileSync(
    "deployment/run/apache-outage-ready.json",
    JSON.stringify({ code, time: Date.now() }),
  );
  console.log("APACHE_OUTAGE_READY");
  for (const p of [a, b])
    await expect(p.locator("#app")).not.toHaveAttribute(
      "data-connection",
      "connected",
      { timeout: 45000 },
    );
  writeFileSync(
    "deployment/run/apache-outage-detected.json",
    JSON.stringify({ code, time: Date.now() }),
  );
  console.log("APACHE_OUTAGE_DETECTED");
  for (const p of [a, b]) {
    await expect(p.locator("#app")).toHaveAttribute(
      "data-connection",
      "connected",
      { timeout: 45000 },
    );
    await expect(p.locator("#app")).toHaveAttribute(
      "data-screen",
      "onlineFight",
    );
    await observe(p);
  }
  await consistent();
  writeFileSync(
    `${audit}/apache-outage.json`,
    JSON.stringify(
      {
        code,
        resumed: true,
        authoritativeHashesEqual: true,
        actualSecondCompu
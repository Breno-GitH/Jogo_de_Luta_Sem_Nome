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
const local = process.env.BEN_LAN_TEST_URL ?? "http://localhost/jogo-luta/",
  remote = process.env.BEN_LAN_TEST_URL ?? `http://${ip ?? "localhost"}/2025/Jogo_de_Luta_Sem_Nome/`;
let app: ReturnType<typeof createGameServer>,
  browsers: Browser[] = [],
  a: Page,
  b: Page;
const hashes = new Map<string, string>();
let trace: unknown[] = [];
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
      if (event === "match:step") {
        hashes.set(p.matchId + ":" + p.tick, p.hash);
        const r = [...app.rooms.rooms.values()].find(
          (r) => r.matchId === p.matchId,
        );
        if (r?.players[0]?.socketId === s.id && r.match) {
          const f = r.match.fighters[0],
            v = r.match.fighters[1];
          trace.push({
            tick: p.tick,
            epoch: p.matchId,
            input: p.inputs[0],
            f: [
              f.state,
              f.moveId,
              f.stateFrame,
              f.x,
              f.y,
              f.vy,
              f.hitConfirmed,
              f.gokuAirTeleportsUsed,
            ],
            v: [v.state, v.combo, v.x, v.y, v.vy, v.stun],
            stop: r.match.hitstop,
          });
          if (trace.length > 800) trace.shift();
        }
      }
    }),
  );
  const port = process.env.BEN_LAN_TEST_URL ? Number(process.env.BEN_LAN_BACKEND_PORT ?? 3188) : 3001;
  await new Promise<void>((r) => app.http.listen(port, "127.0.0.1", r));
}
test.beforeAll(startServer);
test.afterAll(async () => {
  await app.close();
});
test.beforeEach(async () => {
  trace = [];
  browsers = await Promise.all([
    chromium.launch({ channel: "chrome", headless: true }),
    chromium.launch({ channel: "chrome", headless: true }),
  ]);
  a = await browsers[0].newPage({ viewport: { width: 1440, height: 1100 } });
  b = await browsers[1].newPage({ viewport: { width: 1440, height: 1100 } });
});
test.afterEach(async ({}, info) => {
  if (info.status !== info.expectedStatus)
    writeFileSync(
      `${audit}/failure-${info.title.replace(/[^a-z0-9]/gi, "-").slice(0, 90)}.json`,
      JSON.stringify(trace, null, 2),
    );
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
          chain: canvas.dataset.chainFinish,
          chainHeight: canvas.dataset.chainHeight,
          centipede: canvas.dataset.centipedePhase,
          centipedeSource: canvas.dataset.centipedeSource,
          knuckle: canvas.dataset.knucklePose,
          knuckleFrame: canvas.dataset.knuckleFrame,
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
async function seed(code: string, distance = 90, meter = 0, configure?: (match: InstanceType<typeof Match>) => void) {
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
  configure?.(r.match);
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
async function press(p: Page, key: string, hold = 70) {
  await p.keyboard.down(key);
  await p.waitForTimeout(hold);
  await p.keyboard.up(key);
}
async function motion(p: Page, pattern: number[], button: string, hold = 65) {
  for (let i = 0; i < pattern.length; i++) {
    for (const key of ["a", "d", "s"]) await p.keyboard.up(key);
    const v = pattern[i];
    if ([2, 3, 1].includes(v)) await p.keyboard.down("s");
    if ([3, 6].includes(v)) await p.keyboard.down("d");
    if ([1, 4].includes(v)) await p.keyboard.down("a");
    if (i === pattern.length - 1) await p.keyboard.down(button);
    await p.waitForTimeout(hold);
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
    expect(ds[0].jetTick).toBe(ds[1].jetTick);
    expect(ds[0].jetFist).toBe(ds[1].jetFist);
    expect(ds[0].roadTick).toBe(ds[1].roadTick);
    expect(ds[0].kirinVariant).toBe(ds[1].kirinVariant);
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
      await a.click("#confirm-character");
      if (mode === "versus") {
        await a.click("#confirm-character");
        await a.selectOption("#difficulty", difficulty);
      } else await expect(a.locator(".tower-floor")).toHaveCount(10);
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
    await a.click("#confirm-character");
    await a.click("#confirm-character");
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

test("Ben transforms on seat two and both Apache clients replay the same forms and movement", async () => {
  const code = await pair("sasuke", "ben");
  const server = () => app.rooms.rooms.get(code)!.match!.fighters[1];
  const own = b.locator("canvas");
  const remoteView = a.locator("canvas");
  for (const [id, taps] of [["xlr8", 0], ["fourArms", 1], ["heatblast", 8]] as const) {
    for (let i = 0; i < taps; i++) {
      const previous = await own.getAttribute("data-omnitrix-selection");
      await b.keyboard.press("l");
      await expect(own).not.toHaveAttribute("data-omnitrix-selection", previous);
    }
    await expect(own).toHaveAttribute("data-omnitrix-selection", id);
    await b.keyboard.down("l");
    await expect.poll(() => server().omnitrix?.active).toBe(id);
    await b.keyboard.up("l");
    await expect(own).toHaveAttribute("data-omnitrix-form", id);
    await expect(remoteView).toHaveAttribute("data-rival-omnitrix-form", id);
    for (const canvas of [own, remoteView]) {
      await expect(canvas).toHaveAttribute("data-omnitrix-facing", "-1");
      await expect(canvas).toHaveAttribute("data-omnitrix-sheet", `ben/${id}/idle.png`);
    }
  }
  const start = server().x;
  await b.keyboard.down("a");
  await expect.poll(() => server().x).toBeLessThan(start - 28);
  await b.keyboard.up("a");
  await consistent();
});

test("Ben fires Chama's independent projectile and both Apache clients receive one hit", async () => {
  const code = await pair("sasuke", "ben");
  const room = app.rooms.rooms.get(code)!;
  const canvas = b.locator("canvas");
  for (let i = 0; i < 9; i++) {
    const prior = await canvas.getAttribute("data-omnitrix-selection");
    await b.keyboard.press("l");
    await expect(canvas).not.toHaveAttribute("data-omnitrix-selection", prior);
  }
  await b.keyboard.down("l");
  await expect.poll(() => room.match!.fighters[1].omnitrix?.active).toBe("heatblast");
  await b.keyboard.up("l");
  await expect(a.locator("canvas")).toHaveAttribute("data-rival-omnitrix-form", "heatblast");
  await b.keyboard.down("s");
  await b.waitForTimeout(75);
  await b.keyboard.up("s");
  await b.keyboard.down("a");
  await b.keyboard.press("j");
  await b.keyboard.up("a");
  await expect.poll(() => room.match!.fighters[1].omnitrix!.objects[0]?.id).toBe("fireball_light");
  await expect.poll(() => room.match!.fighters[0].health).toBe(964);
  await expect(a.locator("canvas")).toHaveAttribute("data-p1-health", "964");
  await expect(b.locator("canvas")).toHaveAttribute("data-p1-health", "964");
  await consistent();
});

test("Ben stage 5 shares the crystal wall, growth and absorbed energy over Apache LAN", async () => {
  const code = await pair("goku", "ben");
  const own = b.locator("canvas"), other = a.locator("canvas");
  const room = app.rooms.rooms.get(code)!;
  const fighter = () => room.match!.fighters[1];
  async function selectForm(id: string) {
    for (let i = 0; i < 11 && (await own.getAttribute("data-omnitrix-selection")) !== id; i++) {
      const prior = await own.getAttribute("data-omnitrix-selection");
      await b.keyboard.press("l");
      await expect(own).not.toHaveAttribute("data-omnitrix-selection", prior);
    }
    await expect(own).toHaveAttribute("data-omnitrix-selection", id);
    await b.keyboard.down("l");
    await expect.poll(() => fighter().omnitrix?.active).toBe(id);
    await b.keyboard.up("l");
    await expect(other).toHaveAttribute("data-rival-omnitrix-form", id);
  }
  await selectForm("diamondhead");
  await motion(b, [2, 6], "k");
  await expect(own).toHaveAttribute("data-ben-walls", "1");
  await expect(other).toHaveAttribute("data-rival-ben-walls", "1");
  await expect.poll(() => fighter().state).toBe("idle");

  await selectForm("humungousaur");
  await motion(b, [2, 5, 2], "k");
  await expect(own).toHaveAttribute("data-ben-growth", "2");
  await expect(other).toHaveAttribute("data-rival-ben-growth", "2");
  await expect(own).toHaveAttribute("data-omnitrix-sheet", /ben\/humungousaur\/growth-2\//);
  await expect.poll(() => fighter().state).toBe("idle");

  await selectForm("feedback");
  await expect(other).toHaveAttribute("data-rival-ben-growth", "");
  // Synchronize a Ki sphere entering an active absorption window. The shared
  // engine resolves the collision and charge from this state for both clients.
  await seed(code, 160, 0, match => {
    const [goku, feedback] = match.fighters;
    feedback.omnitrix!.active = feedback.omnitrix!.selected = "feedback";
    feedback.attack("absorb_light");
    feedback.stateFrame = 3;
    const move = Object.keys(goku.data.specialMoves!).find(id => goku.data.specialMoves![id].special === "ki")!;
    match.kiProjectiles.push({ id: ++match.projectileSerial, owner: 0, move, cast: 0,
      x: feedback.x - 41, previousX: feedback.x - 41, y: 483, previousY: 483,
      vx: 14, vy: 0, facing: 1, radius: 12, age: 0, life: 25, state: "flight", impactAge: 0 });
  });
  await expect.poll(() => fighter().omnitrix?.charge ?? 0).toBeGreaterThan(0);
  const charge = String(fighter().omnitrix!.charge);
  await expect(own).toHaveAttribute("data-ben-charge", charge);
  await expect(other).toHaveAttribute("data-rival-ben-charge", charge);
  expect(fighter().health).toBe(fighter().data.health);
  await capture(code, "ben-etapa-5-feedback");
  await expect.poll(() => fighter().state).toBe("idle");
  await motion(b, [2, 5, 2], "j");
  await expect.poll(() => fighter().omnitrix!.charge).toBeLessThan(Number(charge));
  const remaining = String(fighter().omnitrix!.charge);
  await expect(own).toHaveAttribute("data-ben-charge", remaining);
  await expect(other).toHaveAttribute("data-rival-ben-charge", remaining);
  await expect.poll(() => room.match!.fighters[0].health).toBeLessThan(room.match!.fighters[0].data.health);
  await consistent();
});

test("Feedback resolves conductive capture and charge on both LAN clients", async () => {
  const code = await pair("samurai", "ben");
  const selectFeedback = (match: InstanceType<typeof Match>) => {
    const feedback = match.fighters[1];
    feedback.omnitrix!.active = feedback.omnitrix!.selected = "feedback";
    return feedback;
  };
  const room = await seed(code, 104, 0, selectFeedback);
  const own = b.locator("canvas"), other = a.locator("canvas");
  await Promise.all([
    motion(b, [2, 6], "k"),
    expect(own).toHaveAttribute("data-ben-capture", "conductor_medium"),
    expect(other).toHaveAttribute("data-ben-capture", "conductor_medium"),
  ]);
  await expect(own).toHaveAttribute("data-ben-charge", "16");
  await expect(other).toHaveAttribute("data-rival-ben-charge", "16");
  await expect.poll(() => room.match!.capture).toBeUndefined();
  const hurt = String(room.match!.fighters[0].health);
  expect(Number(hurt)).toBeLessThan(room.match!.fighters[0].data.health);
  for (const view of [own, other]) await expect(view).toHaveAttribute("data-p1-health", hurt);
  await consistent();
});

test("Ben Stage 6 transforms and resolves ice, phasing and NRG on both LAN clients", async () => {
  const code = await pair("ben", "samurai");
  const room = await seed(code, 135);
  const own = a.locator("canvas"), remote = b.locator("canvas");
  const ben = () => room.match!.fighters[0];
  async function change(id: string) {
    await expect.poll(() => ben().state).toBe("idle");
    for (let i = 0; i < 11 && (await own.getAttribute("data-omnitrix-selection")) !== id; i++) {
      const prior = await own.getAttribute("data-omnitrix-selection");
      await a.keyboard.press("l");
      await expect(own).not.toHaveAttribute("data-omnitrix-selection", prior);
    }
    await expect(own).toHaveAttribute("data-omnitrix-selection", id);
    await a.keyboard.down("l");
    await expect(own).toHaveAttribute("data-omnitrix-form", id);
    await a.keyboard.up("l");
    await expect(remote).toHaveAttribute("data-rival-omnitrix-form", id);
  }

  await change("bigChill");
  await motion(a, [2, 6], "j");
  await expect.poll(() => room.match!.fighters[1].chill?.build ?? 0).toBe(30);
  const hurt = String(room.match!.fighters[1].health);
  for (const view of [own, remote]) await expect(view).toHaveAttribute("data-p2-health", hurt);

  await change("ghostfreak");
  await Promise.all([own, remote].map((view, i) => view.evaluate((canvas, name) => {
    const observe = new MutationObserver(() => {
      if (canvas.getAttribute(name) !== "active") return;
      canvas.setAttribute("data-ben-phase-observed", "true");
      observe.disconnect();
    });
    observe.observe(canvas, { attributes: true, attributeFilter: [name] });
  }, i ? "data-rival-ben-phase" : "data-ben-phase")));
  await motion(a, [2, 5, 2], "k");
  for (const view of [own, remote]) await expect(view).toHaveAttribute("data-ben-phase-observed", "true");
  await expect(own).toHaveAttribute("data-ben-phase", "");
  await expect(remote).toHaveAttribute("data-rival-ben-phase", "");
  await seed(code, 91, 0, match => {
    const watch = match.fighters[0].omnitrix!;
    watch.active = watch.selected = "ghostfreak";
  });
  await Promise.all([
    motion(a, [2, 5, 2], "j"),
    ...[own, remote].map(view => expect(view).toHaveAttribute("data-ben-capture", "ghostPhase_light")),
    ...[own, remote].map(view => expect(view).toHaveAttribute("data-omnitrix-sheet", /zs-skayr/)),
  ]);
  await expect.poll(() => room.match!.capture).toBeUndefined();
  const spectralDamage = room.match!.fighters[1].health;
  expect(spectralDamage).toBeLessThan(room.match!.fighters[1].data.health);

  await change("nrg");
  await motion(a, [2, 5, 2], "j");
  await expect(own).toHaveAttribute("data-nrg-mode", "released");
  await expect(remote).toHaveAttribute("data-rival-nrg-mode", "released");
  await expect(own).toHaveAttribute("data-omnitrix-sheet", /ben\/nrgReleased\/stage6-/);
  await expect.poll(() => ben().state).toBe("idle");
  await motion(a, [2, 6], "k");
  await expect.poll(() => room.match!.fighters[1].health).toBeLessThan(spectralDamage);
  const finalHealth = String(room.match!.fighters[1].health);
  for (const view of [own, remote]) await expect(view).toHaveAttribute("data-p2-health", finalHealth);
  await expect.poll(() => ben().state).toBe("idle");
  await a.keyboard.down("w");
  try {
    await expect(own).toHaveAttribute("data-ben-flight", "nrg");
    await expect(remote).toHaveAttribute("data-ben-flight", "nrg");
    await expect.poll(() => ben().y).toBeLessThan(485);
  } finally { await a.keyboard.up("w"); }
  const currentX = ben().x;
  await motion(a, [2, 5, 2], "k");
  await expect.poll(() => ben().omnitrix?.nrgReleased, { timeout: 10000 }).toBe(false);
  expect(ben().x).toBeCloseTo(currentX, 0);
  await expect(own).toHaveAttribute("data-nrg-mode", "contained");
  await expect(remote).toHaveAttribute("data-rival-nrg-mode", "contained");
  await consistent();
});

test("NRG armor ram and counterpressure agree on both LAN clients", async ({}, info) => {
  const code = await pair("ben", "samurai");
  const contained = (match: InstanceType<typeof Match>) => {
    const watch = match.fighters[0].omnitrix!;
    watch.active = watch.selected = "nrg";
  };
  const own = a.locator("canvas"), remote = b.locator("canvas");
  let room = await seed(code, 126, 0, contained);
  const origin = room.match!.fighters[0].x;
  await motion(a, [2, 4], "j", 46);
  await expect.poll(() => room.match!.fighters[1].health).toBeLessThan(1000);
  expect(room.match!.fighters[0].x).toBeGreaterThan(origin + 20);
  for (const view of [own, remote])
    await expect(view).toHaveAttribute("data-p2-health", String(room.match!.fighters[1].health));

  room = await seed(code, 79, 0, match => {
    contained(match);
    match.fighters[0].x = 579;
    match.fighters[0].facing = -1;
    match.fighters[1].x = 500;
    match.fighters[1].facing = 1;
  });
  await own.evaluate(canvas => {
    const frames: { image: string; clip?: string; move?: string; x: number; rival: number; health: number; facing: number }[] = [];
    (window as any).nrgCounterFrames = frames;
    const dst = document.createElement("canvas");
    dst.width = 960;
    dst.height = 540;
    const ctx = dst.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const surface = canvas as HTMLCanvasElement;
    let previous = -Infinity;
    function sample(now: number) {
      if ((window as any).nrgCounterFrames !== frames) return;
      if (now - previous >= 29) {
        const d = surface.dataset;
        ctx.drawImage(surface, 0, 0, 960, 540);
        frames.push({ image: dst.toDataURL("image/png").split(",")[1], clip: d.animation,
          move: d.move, x: +d.rootX!, rival: +d.rivalX!, health: +d.p2Health!, facing: +d.omnitrixFacing! });
        previous = now;
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  // Schedule the rival's jab from the command, before the network echo of
  // the counter stance. Waiting for its DOM update misses the short window.
  await press(a, "s", 39);
  await a.waitForTimeout(39);
  await a.keyboard.down("s");
  await a.keyboard.down("k");
  try {
    await a.waitForTimeout(54);
    await press(b, "j", 45);
  } finally {
    await a.keyboard.up("k");
    await a.keyboard.up("s");
  }
  await expect.poll(() => room.match!.fighters[1].health).toBeLessThan(1000);
  const health = room.match!.fighters.map(f => f.health);
  expect(health[0]).toBeGreaterThan(982);
  expect(health[0]).toBeLessThan(1000);
  for (const view of [own, remote]) for (let i = 0; i < 2; i++)
    await expect(view).toHaveAttribute("data-p" + (i + 1) + "-health", String(health[i]));
  await expect.poll(() => room.match!.fighters[0].state).toBe("idle");
  await consistent();
  const frames = await own.evaluate(() => {
    const frames = (window as any).nrgCounterFrames;
    (window as any).nrgCounterFrames = null;
    return frames;
  });
  const folder = info.outputPath("counter-hit");
  mkdirSync(folder, { recursive: true });
  writeFileSync(folder + "/frames.json", JSON.stringify(frames.map(({ image, ...frame }) => frame)));
  for (let i = 0; i < frames.length; i++)
    writeFileSync(folder + "/" + String(i).padStart(3, "0") + ".png", Buffer.from(frames[i].image, "base64"));
});

test("Sasuke fights with his own normals on both LAN clients", async () => {
  const code = await pair("sasuke", "sasuke");
  let room = await seed(code, 57);
  await press(a, "l");
  await expect.poll(() => room.match!.fighters[1].health).toBe(912);
  await capture(code, "sasuke-kusanagi");
  room = await seed(code, 57);
  await press(b, "k");
  await expect.poll(() => room.match!.fighters[0].health).toBe(941);
  for (const client of [a, b]) {
    await expect(client.locator("canvas")).toHaveAttribute("data-character", "sasuke");
    await expect(client.locator("canvas")).toHaveAttribute("data-p1-health", "941");
  }
  await consistent();
});

test("Luffy Jet Gigant confirms with R and synchronizes the full Super over Apache", async () => {
  const code = await pair("luffy", "goku");
  const room = await seed(code, 175, 100);
  await press(a, "r");
  await expect.poll(() => room.match!.jetGigant?.attacker).toBe(0);
  expect(room.match!.fighters[0].meter).toBe(0);
  const timer = room.match!.timer;
  await press(b, "j");
  await expect(a.locator("canvas")).toHaveAttribute("data-jet-phase", "gigantPistol", { timeout: 12000 });
  await expect(b.locator("canvas")).toHaveAttribute("data-jet-phase", "gigantPistol");
  await expect(a.locator("canvas")).toHaveAttribute("data-jet-fist", "5");
  await capture(code, "luffy-jet-gigant");
  expect(room.match!.timer).toBe(timer);
  await expect(a.locator("canvas")).toHaveAttribute("data-jet-cel", "small");
  await expect(b.locator("canvas")).toHaveAttribute("data-jet-cel", "small");
  await expect.poll(() => room.match!.jetGigant, { timeout: 6000 }).toBeUndefined();
  for (const client of [a, b]) {
    await expect(client.locator("canvas")).toHaveAttribute("data-p2-health", "668");
    await expect(client.locator("canvas")).toHaveAttribute("data-camera-zoom", "1");
    await expect(client.locator("canvas")).toHaveAttribute("data-capture", "none");
  }
  await consistent();
});

test("Luffy elastic throw resolves once on two LAN clients", async () => {
  const code = await pair("luffy", "luffy");
  const room = await seed(code, 82);
  await press(a, "u");
  await expect.poll(() => room.match!.capture?.kind).toBe("grab");
  await capture(code, "luffy-elastic-throw");
  await expect.poll(() => room.match!.fighters[1].health).toBe(888);
  await expect.poll(() => room.match!.capture).toBeUndefined();
  await expect.poll(() => room.match!.fighters[0].state).toBe("idle");
  await consistent();
});

test("Luffy specials keep each Gatling hit authoritative on two LAN clients", async () => {
  const code = await pair("luffy", "dio");
  const room = await seed(code, 110);
  await motion(a, [2, 1, 4], "l");
  await expect.poll(() => room.match!.fighters[0].moveId).toBe("gatling_heavy");
  await expect.poll(() => room.match!.fighters[1].health).toBeLessThan(1000);
  await capture(code, "luffy-gatling-lan");
  await expect.poll(() => room.match!.fighters[1].health).toBe(881);
  await consistent();
});

test("Luffy long normal stays authoritative on two LAN clients", async () => {
  const code = await pair("luffy", "samurai");
  const r = await seed(code, 324);
  await press(a, "l");
  await expect.poll(() => r.match!.fighters[1].health).toBe(916);
  await capture(code, "luffy-stand-heavy-long");
  await consistent();
  await expect.poll(() => r.match!.fighters[0].moveId).toBe("");
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
      await press(a, "r");
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

test("Goku real keyboard launcher and air teleport combo is identical on both clients", async () => {
  const code = await pair("goku", "goku"),
    r = await seed(code, 70),
    f = () => r.match!.fighters[0];
  const hits: string[] = [];
  const hitListener = (event: string, packet: any) => {
    if (event === "match:step" && packet.matchId === r.matchId)
      for (const hit of r.match!.hits)
        if (hit.attacker === 0 && !hit.blocked) hits.push(hit.move);
  };
  // One observer on one server socket: never double-count broadcasts to P2.
  const socket = app.io.sockets.sockets.get(r.players[0]!.socketId)!;
  socket.onAnyOutgoing(hitListener);
  const wait = async (p: () => boolean) =>
    expect.poll(p, { timeout: 5000, intervals: [10] }).toBe(true);
  await a.keyboard.down("s");
  await press(a, "l", 20);
  await a.keyboard.up("s");
  await wait(() => f().canCancel("jump"));
  await a.keyboard.down("w");
  await press(a, "j", 20);
  await a.keyboard.up("w");
  await wait(() => f().moveId === "air_light" && f().hitConfirmed);
  await press(a, "k", 20);
  await wait(() => f().moveId === "air_medium" && f().hitConfirmed);
  await motion(a, [2, 5, 2], "l", 20);
  await wait(() => f().gokuAirTeleportsUsed === 1);
  await press(a, "j", 20);
  await wait(() => f().moveId === "air_light" && f().hitConfirmed);
  await press(a, "k", 20);
  await wait(() => f().moveId === "air_medium" && f().hitConfirmed);
  await press(a, "l", 20);
  await wait(() => hits.includes("air_heavy"));
  socket.offAnyOutgoing(hitListener);
  expect(hits).toEqual([
    "crouch_heavy",
    "air_light",
    "air_medium",
    "air_light",
    "air_medium",
    "air_heavy",
  ]);
  await capture(code, "goku-air-chase");
  writeFileSync(
    `${audit}/goku-air-chase-inputs.json`,
    JSON.stringify({ actualSecondComputer: false, rows: trace }, null, 2),
  );
  await consistent();
});

test("Goku air J K L teleport positions are authoritative in both directions", async () => {
  const code = await pair("goku", "samurai");
  for (const facing of [1, -1])
    for (const button of ["j", "k", "l"]) {
      const r = await seed(code, 200),
        [f, v] = r.match!.fighters;
      f.facing = facing;
      f.x = 640;
      v.x = 640 + 200 * facing;
      v.facing = -facing;
      f.y = 350;
      f.vy = -1;
      f.setState("air");
      v.y = 340;
      v.vy = -10;
      v.setState("hitstun");
      v.stun = 120;
      v.combo = 3;
      r.syncs = [];
      app.rooms.sync(r.players[0]!.socketId, r.matchId);
      await expect(a.locator("#app")).toHaveAttribute(
        "data-net-match",
        r.matchId,
      );
      await motion(a, [2, 5, 2], button, 30);
      await expect
        .poll(() => f.gokuAirTeleportsUsed, { intervals: [20] })
        .toBe(1);
      await expect
        .poll(() => f.state === "air", { intervals: [20] })
        .toBe(true);
      expect(f.x).toBeGreaterThanOrEqual(40);
      expect(f.x).toBeLessThanOrEqual(1240);
      expect(f.y).toBeLessThan(580);
      expect(Math.abs(f.x - v.x)).toBeGreaterThanOrEqual(52);
      await capture(code, `goku-air-${button}-${facing}`);
      await consistent();
    }
});

test("Apache laboratory executes the full air chase with real sprite frames and no visual errors", async () => {
  const errors: string[] = [];
  a.on("pageerror", (e) => errors.push(e.message));
  const epoch = new Date("2026-11-02T12:00:00Z");
  await a.clock.install({ time: epoch });
  await a.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await a.goto(local + "art/goku-specials.html");
  const c = a.locator("#arena");
  await expect(c).toHaveAttribute("data-loaded", "true");
  await a.clock.runFor(34);
  await a.uncheck("#repeat");
  for (const mirror of [false, true]) {
    if (mirror) await a.click("#flip");
    for (const scene of [
      "airTeleportLight",
      "airTeleportBehind",
      "airChaseCombo",
    ]) {
      await a.selectOption("#scenario", scene);
      await a.click("#execute");
      await a.clock.runFor(3400);
      if (scene === "airChaseCombo")
        await expect(c).toHaveAttribute("data-hit-count", "6");
      await expect(c).toHaveAttribute("data-physics-state", "idle");
    }
  }
  expect(errors).toEqual([]);
  await expect(a.locator("#error")).toHaveText("");
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
  expect(r.result?.score).toEqual([2, 0]);
  for (const p of [a, b]) await expect(p.locator(".score strong")).toHaveText(["2", "0"]);
  const old = r.matchId;
  await a.click("#online-rematch");
  expect(r.matchId).toBe(old);
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
        actualSecondComputer: false,
      },
      null,
      2,
    ),
  );
});

test("Sasuke specials and the visual storm agree on both LAN clients", async () => {
  const code = await pair("sasuke", "sasuke");
  let room = await seed(code, 132);
  await motion(a, [2, 1, 4], "l");
  await expect.poll(() => room.match!.fighters[1].health).toBe(897);
  expect(room.match!.sasukeStormUntil).toBeGreaterThan(room.match!.combatFrame);
  for (const client of [a, b])
    await expect(client.locator("canvas")).toHaveAttribute("data-p2-health", "897");
  await capture(code, "sasuke-goryuka");
  await consistent();

  room = await seed(code, 161);
  // P2 faces left, so its relative forward is the physical A key.
  await motion(b, [2, 1, 4], "k");
  await expect.poll(() => room.match!.fighters[0].health).toBe(911);
  for (const client of [a, b])
    await expect(client.locator("canvas")).toHaveAttribute("data-p1-health", "911");
  await consistent();
});

test("Sasuke Curse Mark activates from keyboard and synchronizes through expiry", async () => {
  const code = await pair("sasuke", "samurai");
  const room = await seed(code, 58);
  await motion(a, [2, 5, 2], "l", 72);
  await expect.poll(() => room.match!.fighters[0].sasukeCurse?.phase).toBe("active");
  for (const client of [a, b])
    await expect(client.locator("canvas")).toHaveAttribute("data-p1-curse", "active");
  await press(a, "j");
  await expect.poll(() => room.match!.fighters[1].health).toBe(960);
  await capture(code, "sasuke-curse-active");
  await consistent();
  await expect.poll(() => room.match!.fighters[0].sasukeCurse?.phase, { timeout: 22000 }).toBe("cooldown");
  for (const client of [a, b])
    await expect(client.locator("canvas")).toHaveAttribute("data-p1-curse", "cooldown");
  await consistent();
});

test("Sasuke Kirin confirms on R and synchronizes both clients through the storm", async () => {
  const code = await pair("sasuke", "dio");
  const room = await seed(code, 57, 100);
  await press(a, "r");
  await expect.poll(() => room.match!.kirin?.attacker).toBe(0);
  expect(room.match!.fighters[0].meter).toBe(0);
  const timer = room.match!.timer;
  for (const client of [a,b])
    await expect(client.locator("canvas")).toHaveAttribute("data-kirin-phase", "reveal");
  await capture(code, "sasuke-kirin");
  await consistent();
  await expect.poll(() => room.match!.fighters[1].health, { timeout: 12000 }).toBe(680);
  expect(room.match!.timer).toBe(timer);
  for (const client of [a,b])
    await expect(client.locator("canvas")).toHaveAttribute("data-p2-health", "680");
  await expect.poll(
    () => !room.match!.kirin && room.match!.fighters[1].knockedDown,
    { intervals: [16], timeout: 8000 },
  ).toBe(true);
  for (const client of [a,b])
    await expect(client.locator("canvas")).toHaveAttribute("data-camera-zoom", "1");
  await consistent();
});

test("Sasuke Black Kirin hits through crouching guard and keeps the same variant on both LAN clients", async () => {
  const code = await pair("sasuke", "samurai");
  const room = await seed(code, 57, 100);
  await motion(a, [2, 5, 2], "l", 72);
  await expect.poll(() => room.match!.fighters[0].sasukeCurse?.phase).toBe("active");
  await b.keyboard.down("s");
  await b.keyboard.down("d");
  await expect.poll(() => room.match!.fighters[1].guardIntent && room.match!.fighters[1].crouching).toBe(true);
  try {
    await press(a, "r");
    await expect.poll(() => room.match!.kirin?.cursed).toBe(true);
    expect(room.match!.fighters[0].meter).toBe(0);
    const remaining = room.match!.fighters[0].sasukeCurse!.remaining;
    await Promise.all([a, b].map(async client => {
      const canvas = client.locator("canvas");
      await expect(canvas).toHaveAttribute("data-kirin-variant", "black");
      await expect(canvas).toHaveAttribute("data-kirin-phase", "reveal");
    }));
    await capture(code, "sasuke-kirin-black");
    await expect.poll(() => room.match!.fighters[1].health, { timeout: 12000 }).toBe(680);
    expect(room.match!.fighters[0].sasukeCurse!.remaining).toBe(remaining);
    await Promise.all([a, b].map(async client => {
      const canvas = client.locator("canvas");
      await expect(canvas).toHaveAttribute("data-p2-health", "680");
      await expect(canvas).toHaveAttribute("data-kirin-phase", "none");
      await expect(canvas).toHaveAttribute("data-camera-zoom", "1");
    }));
    await consistent();
  } finally {
    await b.keyboard.up("s");
    await b.keyboard.up("d");
  }
});

test("backend outage has a bounded retry window and a usable return to the main menu", async () => {
  await pair("luffy", "sasuke");
  await app.close();
  try {
    for (const p of [a, b]) {
      await expect(p.locator("#connection-state")).toHaveText("Conexão indisponível", { timeout: 15000 });
      await expect(p.locator("#online-error")).toContainText("Servidor indisponível");
      await expect(p.locator("#create-room")).toBeDisabled();
    }
    await b.click("#back");
    await expect(b.locator("#app")).toHaveAttribute("data-screen", "menu");
  } finally {
    await startServer();
  }
  await a.click("#reconnect-online");
  await expect(a.locator("#create-room")).toBeEnabled({ timeout: 10000 });
  await a.click("#create-room");
  await expect(a.locator("#lobby-code")).toHaveText(/^[A-Z2-9]{6}$/);
});


test("Sasuke taunts, throws to win a round, rematches and changes character over LAN", async () => {
  const code = await pair("sasuke", "luffy");
  const room = await seed(code, 60);
  await press(a, "t");
  await expect(a.locator("canvas")).toHaveAttribute("data-animation", "taunt");
  await expect.poll(() => room.match!.fighters[0].state).toBe("idle");
  await press(a, "u");
  for (const client of [a, b])
    await expect(client.locator("canvas")).toHaveAttribute("data-capture", "grab");
  await expect.poll(() => room.match!.fighters[1].health).toBe(895);
  await consistent();
  await expect.poll(() => room.match!.capture).toBeUndefined();

  for (let round = 0; round < 2; round++) {
    await expect.poll(() => room.match!.phase, { timeout: 12000 }).toBe("fight");
    const [actor, victim] = room.match!.fighters;
    actor.x = 570;
    victim.x = 630;
    victim.health = 90;
    victim.setState("idle");
    victim.vx = victim.vy = victim.stun = 0;
    victim.knockedDown = false;
    victim.y = 580;
    actor.setState("idle");
    room.match!.capture = undefined;
    room.match!.hitstop = 0;
    room.syncs = [];
    app.rooms.sync(room.players[0]!.socketId, room.matchId);
    await press(a, "u");
    await expect.poll(() => room.match!.phase, { timeout: 5000 }).not.toBe("fight");
    expect(room.match!.wins[0]).toBe(round + 1);
  }
  for (const client of [a, b])
    await expect(client.locator(".score strong")).toHaveText(["2", "0"]);
  const previous = room.matchId;
  await a.click("#online-rematch");
  expect(room.matchId).toBe(previous);
  await b.click("#online-rematch");
  await expect.poll(() => room.matchId).not.toBe(previous);
  expect(room.match!.fighters.map(f => f.data.id)).toEqual(["sasuke", "luffy"]);

  // The shared room controller permits returning and changing the selection
  // once the rematch ends. Closing a client here tests that real result path.
  await browsers[1].close();
  await expect(a.locator("#app")).toHaveAttribute("data-screen", "onlineResult", { timeout: 12000 });
  await a.click("#online-lobby");
  await expect(a.locator("#lobby-code")).toHaveText(code);
  await a.check("#online-goku");
  await expect.poll(() => room.players[0]!.character).toBe("goku");
  expect(room.players[0]!.confirmed).toBe(false);
});

test("Kaneki capture choice is resolved by the LAN server and replayed by both clients", async () => {
  const code = await pair("kaneki", "sasuke");
  const room = await seed(code, 107);
  const cases = [
    ["j", 926], ["k", 908], ["l", 899],
  ] as const;
  for (const [button, expected] of cases) {
    if (button !== "j") await seed(code, 107);
    await press(a, "u");
    await expect.poll(() => room.match!.capture?.kind).toBe("grab");
    await a.keyboard.press(button);
    await expect.poll(() => room.match!.fighters[1].health).toBe(expected);
    await expect.poll(() => room.match!.capture).toBeUndefined();
    for (const client of [a, b])
      await expect(client.locator("canvas")).toHaveAttribute("data-p2-health", String(expected));
    if (button === "j") await consistent();
  }
});


test("Xebec resolves Dominação and Pandemonium on both clients", async () => {
  test.setTimeout(60000);
  const code = await pair("xebec", "samurai");
  const room = await seed(code, 132, 100, match => {
    match.fighters[0].domination!.charge = 100;
  });
  await motion(a, [2, 4], "l", 42);
  await expect.poll(() => room.match!.fighters[0].domination!.powered).toBe(true);
  await expect.poll(() => room.match!.fighters[0].domination!.charge).toBe(0);
  await expect.poll(() => room.match!.fighters[0].state).toBe("idle");
  await expect.poll(() => room.match!.fighters[1].health).toBeLessThan(1000);
  await consistent();
  await seed(code, 125, 100);
  await press(a, "r");
  for (const client of [a,b])
    await expect(client.locator("canvas")).toHaveAttribute("data-capture", "pandemonium");
  await expect.poll(() => room.match!.pandemonium?.tick).toBeGreaterThan(151);
  await consistent();
  await expect.poll(() => room.match!.pandemonium, { timeout: 12000 }).toBeUndefined();
  for (const client of [a,b]) {
    await expect(client.locator("canvas")).toHaveAttribute("data-pandemonium-tick", "-1");
    await expect(client.locator("canvas")).toHaveAttribute("data-p2-health", "666");
  }
  await consistent();
});

test("Kaneki Four Swords replays the pressure pose on both LAN clients", async () => {
  const code = await pair("kaneki", "sasuke");
  const room = await seed(code, 107);
  await motion(a, [2, 4], "k", 55);
  await expect.poll(() => room.match!.fighters[1].health).toBeLessThan(940);
  await expect.poll(() => room.match!.capture).toBeUndefined();
  const health = String(room.match!.fighters[1].health);
  for (const client of [a, b])
    await expect(client.locator("canvas")).toHaveAttribute("data-p2-health", health);
  await consistent();
  const [left, right] = await Promise.all([a,b].map(client =>
    client.evaluate(() => (window as any).netRecords)));
  const shared = Object.keys(left).find(key =>
    left[key].knuckle === "1" && right[key]?.knuckle === "1" &&
    left[key].knuckleFrame && right[key].knuckleFrame === left[key].knuckleFrame);
  expect(shared).toBeTruthy();
});


test("Kaneki chain grab and escape are resolved identically on LAN", async () => {
  const code = await pair("kaneki", "sasuke");
  const room = await seed(code, 107);
  await press(a, "u", 50);
  await expect.poll(() => room.match!.capture?.kaneki?.chain?.phase, { intervals: [20] }).toBe("choice1");
  await a.keyboard.press("j");
  await expect.poll(() => room.match!.capture?.kaneki?.chain?.phase, { intervals: [20] }).toBe("choice2");
  await a.keyboard.press("l");
  await Promise.all([a, b].map(async client => {
    await expect(client.locator("canvas")).toHaveAttribute("data-chain-finish", "centipede");
    await expect.poll(() => client.locator("canvas").evaluate(c => Number(c.dataset.chainHeight)), { intervals: [20] }).toBeGreaterThan(260);
  }));
  await expect.poll(() => room.match!.capture).toBeUndefined();
  await consistent();
  for (const client of [a,b]) {
    await expect(client.locator("canvas")).toHaveAttribute("data-p2-health","852");
    await expect(client.locator("canvas")).toHaveAttribute("data-camera-zoom","1");
  }

  await seed(code, 105);
  await press(a, "u", 50);
  await expect.poll(() => room.match!.capture?.kaneki?.chain?.phase, { intervals: [20] }).toBe("choice1");
  await a.keyboard.press("l");
  await expect.poll(() => room.match!.capture?.kaneki?.chain?.phase, { intervals: [20] }).toBe("choice2");
  await b.keyboard.press("l");
  await expect.poll(() => room.match!.capture?.kaneki?.chain?.escape?.button, { intervals: [20] }).toBe("heavy");
  await a.keyboard.press("l");
  await expect.poll(() => room.match!.capture).toBeUndefined();
  for (const client of [a,b])
    await expect(client.locator("canvas")).toHaveAttribute("data-p2-health","946");
});


test("Kaneki converts U to Centipede on both LAN clients", async () => {
  const code = await pair("kaneki", "sasuke");
  const room = await seed(code, 107, 100);
  const poll = { intervals: [20], timeout: 16000 };
  await press(a, "u", 50);
  await expect.poll(() => room.match!.capture?.kaneki?.chain?.phase, poll).toBe("choice1");
  await a.keyboard.press("r");
  await expect.poll(() => room.match!.centipede?.source, poll).toBe("universal");
  expect(room.match!.fighters[0].meter).toBe(0);
  await Promise.all([a,b].map(async client => {
    const canvas = client.locator("canvas");
    await expect(canvas).toHaveAttribute("data-centipede-source","universal");
    await expect(canvas).toHaveAttribute("data-centipede-phase","wall",{timeout:12000});
    await expect(canvas).toHaveAttribute("data-centipede-phase","ascend",{timeout:12000});
    await expect(canvas).toHaveAttribute("data-centipede-phase","impact",{timeout:12000});
    await expect(canvas).toHaveAttribute("data-camera-zoom","1",{timeout:12000});
  }));
  await expect.poll(() => room.match!.centipede, poll).toBeUndefined();
  const health = String(room.match!.fighters[1].health);
  expect(Number(health)).toBeLessThan(750);
  for (const client of [a,b])
    await expect(client.locator("canvas")).toHaveAttribute("data-p2-health",health);
  const [left,right] = await Promise.all([a,b].map(client =>
    client.evaluate(() => (window as any).netRecords)));
  expect(Object.keys(left).some(k => left[k].centipede === "impact" &&
    right[k]?.centipede === "impact" && left[k].centipedeSource === right[k].centipedeSource)).toBe(true);
  await consistent();
});

test("Kaneki long grab branches and resistance use authoritative LAN inputs", async () => {
  const code = await pair("kaneki","sasuke");
  const room = await seed(code,352);
  await motion(a,[2,6],"l",55);
  const poll = { intervals:[20] };
  await expect.poll(() => room.match!.capture?.kaneki?.chain?.origin,poll).toBe("kaguneGrab");
  await expect.poll(() => room.match!.capture?.kaneki?.chain?.phase,poll).toBe("choice1");
  await a.keyboard.press("k");
  await expect.poll(() => room.match!.capture?.kaneki?.chain?.phase,poll).toBe("choice2");
  await a.keyboard.press("l");
  await Promise.all([a,b].map(client =>
    expect(client.locator("canvas")).toHaveAttribute("data-chain-finish","redCatapult")));
  await expect.poll(() => room.match!.capture,poll).toBeUndefined();
  for (const client of [a,b])
    await expect(client.locator("canvas")).toHaveAttribute("data-p2-health","870");
  await consistent();

  await seed(code,352);
  await motion(a,[2,6],"l",55);
  await expect.poll(() => room.match!.capture?.kaneki?.chain?.phase,poll).toBe("choice1");
  for (const [i,key] of ["l","j","k"].entries()) {
    await b.keyboard.press(key);
    if (i < 2) {
      await expect.poll(() => room.match!.capture?.kaneki?.chain?.resistance,poll).toBe(i+1);
      await b.waitForTimeout(240);
    }
  }
  await expect.poll(() => room.match!.capture,poll).toBeUndefined();
  expect(room.match!.fighters[1].health).toBe(1000);
  for (const client of [a,b])
    await expect(client.locator("canvas")).toHaveAttribute("data-capture","none");
});

test("Ben Stage 7 agrees on gravity, the planetoid and Echo's clone attacks", async () => {
  const code = await pair("ben", "samurai");
  const room = await seed(code, 145);
  const own = a.locator("canvas"), remote = b.locator("canvas");
  const ben = () => room.match!.fighters[0];
  const samurai = () => room.match!.fighters[1];

  async function change(id: string) {
    await expect.poll(() => ben().state).toBe("idle");
    for (let i = 0; i < 11 && (await own.getAttribute("data-omnitrix-selection")) !== id; i++) {
      const before = await own.getAttribute("data-omnitrix-selection");
      await press(a, "l", 60);
      await expect(own).not.toHaveAttribute("data-omnitrix-selection", before);
    }
    await expect(own).toHaveAttribute("data-omnitrix-selection", id);
    await a.keyboard.down("l");
    try { await expect(own).toHaveAttribute("data-omnitrix-form", id); }
    finally { await a.keyboard.up("l"); }
    await expect(remote).toHaveAttribute("data-rival-omnitrix-form", id);
    for (const view of [own, remote]) await expect(view).toHaveAttribute("data-omnitrix-sheet", `ben/${id}/stage7.png`);
  }

  await change("gravattack");
  const startX = samurai().x;
  await motion(a, [2, 6], "j");
  await expect.poll(() => samurai().x).toBeLessThan(startX - 12);
  await expect.poll(() => ben().state).toBe("idle");
  await motion(a, [2, 5, 2], "j");
  for (const view of [own, remote]) await expect(view).toHaveAttribute("data-gravity-well", "true");
  await expect.poll(() => ben().state).toBe("idle");
  const rollStart = ben().x;
  await motion(a, [2, 5, 2], "k", 48);
  await expect.poll(() => ben().moveId === "gravityDomain_medium" && ben().x > rollStart + 12).toBe(true);

  await change("echoEcho");
  await motion(a, [2, 4], "k");
  for (const view of [own, remote]) await expect(view).toHaveAttribute("data-echo-clones", "2");
  await expect.poll(() => ben().state).toBe("idle");
  const before = samurai().health;
  await motion(a, [2, 5, 2], "k");
  await expect.poll(() => samurai().health).toBeLessThan(before);
  await expect.poll(() => ben().state).toBe("idle");
  for (const view of [own, remote]) await expect(view).toHaveAttribute("data-p2-health", String(samurai().health));
  await change("gravattack");
  for (const view of [own, remote]) await expect(view).toHaveAttribute("data-echo-clones", "0");
  await consistent();
});

test("Gravattack's fixed well lifts once and agrees in both LAN clients", async () => {
  const code = await pair("ben", "samurai");
  const room = await seed(code, 145, 0, match => {
    const watch = match.fighters[0].omnitrix!;
    watch.active = watch.selected = "gravattack";
  });
  const own = a.locator("canvas"), remote = b.locator("canvas");
  await expect(remote).toHaveAttribute("data-rival-omnitrix-form", "gravattack");
  await motion(a, [2, 6], "k");
  await expect.poll(() => room.match!.fighters[1].y).toBeLessThan(565);
  await expect.poll(() => room.match!.fighters[0].state).toBe("idle");
  for (const view of [own, remote]) await expect(view).toHaveAttribute("data-p2-health", "958");
  await consistent();
});

test("Alien X confirms and restores Ben in both authoritative LAN clients", async () => {
  const code = await pair("ben", "samurai");
  const room = await seed(code, 112, 100, match => {
    const watch = match.fighters[0].omnitrix!;
    watch.active = watch.selected = "echoEcho";
  });
  const own = a.locator("canvas"), remote = b.locator("canvas");
  await expect(remote).toHaveAttribute("data-rival-omnitrix-form", "echoEcho");
  const resyncs = await Promise.all([a, b].map(async page => {
    await page.evaluate(() => { (window as any).netRecords = {}; });
    return page.locator("#app").getAttribute("data-resyncs");
  }));
  await press(a, "r");
  for (const view of [own, remote]) {
    await expect(view).toHaveAttribute("data-alien-x-phase", "reveal");
    await expect(view).toHaveAttribute("data-omnitrix-sheet", "ben/alien-x.png");
  }
  await Promise.all([own, remote].map(view =>
    expect(view).toHaveAttribute("data-alien-x-visual", "council")));
  await expect.poll(() => room.match!.fighters[1].health).toBe(665);
  await Promise.all([own, remote].map(view =>
    expect(view).toHaveAttribute("data-alien-x-visual", "rebuild")));
  for (const view of [own, remote]) {
    await expect(view).toHaveAttribute("data-alien-x-phase", "");
    await expect(view).toHaveAttribute("data-camera-zoom", "1");
    await expect(view).toHaveAttribute("data-p2-health", "665");
  }
  await expect(own).toHaveAttribute("data-omnitrix-form", "human");
  await expect(remote).toHaveAttribute("data-rival-omnitrix-form", "human");
  for (const [i, page] of [a, b].entries()) await expect(page.locator("#app")).toHaveAttribute("data-resyncs", resyncs[i]!);
  await consistent();
});

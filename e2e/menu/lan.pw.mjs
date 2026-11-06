import { test, expect, chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const production = !!process.env.MENU_URL;
let server;
const { createGameServer } = await import("../../server-dist/server-core.mjs");
const audit = "deployment/audit/menus";
mkdirSync(audit, { recursive: true });
const root = "http://localhost/2025/Jogo_de_Luta_Sem_Nome/";
async function start() {
  server = createGameServer({
    origins: [],
    serveFrontend: false,
    trustLoopbackProxy: true,
    serviceName: "jogo-luta-lan",
    graceMs: 1800,
    inputTimeoutMs: 6000,
  });
  await new Promise((resolve) =>
    server.http.listen(3001, "127.0.0.1", resolve),
  );
}
test.beforeAll(async () => {
  if (production) await start();
});
test.afterAll(async () => {
  if (server) await server.close();
});
async function entry(p) {
  await p.goto(root);
  await p.click("#online");
  await expect(p.locator("#app")).toHaveAttribute(
    "data-connection",
    "connected",
    { timeout: 20000 },
  );
}
async function observe(p) {
  await p.evaluate(() => {
    window.menuHashes = {};
    const el = document.querySelector("#app");
    new MutationObserver(() => {
      if (el.dataset.netTick && el.dataset.netMatch)
        window.menuHashes[el.dataset.netMatch + ":" + el.dataset.netTick] =
          el.dataset.netHash;
    }).observe(el, { attributes: true });
  });
}
test("Apache LAN real rooms, validation, roster, combat hashes, local menu, KO, mutual rematch, lobby and leaving", async ({
  browser,
}) => {
  test.skip(!production, "Runs against Apache after the production build.");
  const ctxA = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    }),
    ctxB = await browser.newContext(),
    ctxC = await browser.newContext();
  const a = await ctxA.newPage(),
    b = await ctxB.newPage(),
    third = await ctxC.newPage();
  const errors = [];
  for (const p of [a, b, third])
    p.on("pageerror", (e) => errors.push(e.message));
  try {
    await entry(a);
    await entry(b);
    await b.fill("#room-code", "!!!!!!");
    await b.click("#join-room");
    await expect(b.locator("#online-error")).toContainText("seis caracteres");
    await b.fill("#room-code", "ZZZZZZ");
    await b.click("#join-room");
    await expect(b.locator("#online-error")).toContainText(
      /não encontrada|encerrada/,
    );
    await a.click("#create-room");
    const code = (await a.locator("#lobby-code").innerText()).trim();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(server.rooms.rooms.has(code)).toBe(true);
    await a.click("#copy-code");
    await expect(a.locator("#copy-code")).toHaveText("Copiado");
    expect(await a.evaluate(() => navigator.clipboard.readText())).toBe(code);
    await b.fill("#room-code", code);
    await b.click("#join-room");
    await expect(b.locator("#lobby-code")).toHaveText(code);
    await entry(third);
    await third.fill("#room-code", code);
    await third.click("#join-room");
    await expect(third.locator("#online-error")).toContainText(
      /dois jogadores|cheia/,
    );
    for (const [p, id] of [
      [a, "samurai"],
      [b, "dio"],
    ]) {
      for (const c of ["samurai", "dio", "goku", "luffy"])
        await p.check("#online-" + c);
      await p.check("#online-" + id);
      await p.click("#online-confirm");
    }
    await expect(a.locator("#online-start")).toBeDisabled();
    await a.click("#online-ready");
    await expect(a.locator("#online-start")).toBeDisabled();
    await b.click("#online-ready");
    await expect(a.locator("#online-start")).toBeEnabled();
    await a.screenshot({ path: `${audit}/lobby.png`, fullPage: true });
    await a.click("#online-start");
    for (const p of [a, b]) {
      await expect(p.locator("#app")).toHaveAttribute(
        "data-screen",
        "onlineFight",
      );
      await expect(p.locator("canvas")).toHaveAttribute(
        "data-match-phase",
        "fight",
        { timeout: 12000 },
      );
      await observe(p);
    }
    const current = Number(
      await a.locator("#app").getAttribute("data-net-tick"),
    );
    await a.keyboard.press("Escape");
    await expect(a.locator("#app")).toHaveAttribute(
      "data-screen",
      "onlinePause",
    );
    await expect
      .poll(async () =>
        Number(await a.locator("#app").getAttribute("data-net-tick")),
      )
      .toBeGreaterThan(current + 10);
    await a.click("#pause-controls");
    await a.click("#back");
    await a.click("#resume");
    await a.keyboard.down("KeyD");
    await b.keyboard.down("KeyA");
    await expect
      .poll(
        async () =>
          Number(await a.locator("canvas").getAttribute("data-target-x")) -
          Number(await a.locator("canvas").getAttribute("data-player-x")),
      )
      .toBeLessThan(90);
    await a.keyboard.up("KeyD");
    await b.keyboard.up("KeyA");
    await a.keyboard.press("KeyJ");
    await expect
      .poll(async () =>
        Number(await a.locator("canvas").getAttribute("data-target-health")),
      )
      .toBeLessThan(1000);
    await expect
      .poll(async () => {
        const x = await a.evaluate(() => window.menuHashes),
          y = await b.evaluate(() => window.menuHashes);
        const common = Object.keys(x).filter((k) => y[k]);
        return common.length > 15 && common.every((k) => x[k] === y[k]);
      })
      .toBe(true);
    await a.screenshot({ path: `${audit}/lan-fight.png`, fullPage: true });
    await expect(a.locator("canvas")).toHaveAttribute(
      "data-physics-state",
      "idle",
    );
    const room = server.rooms.rooms.get(code);
    room.match.wins[0] = 1;
    room.match.fighters[1].health = 1;
    server.rooms.sync(room.players[0].socketId, room.matchId);
    await expect(a.locator("canvas")).toHaveAttribute(
      "data-target-health",
      "1",
    );
    await a.locator("canvas").focus();
    await a.keyboard.press("KeyJ");
    for (const p of [a, b])
      await expect(p.locator("#app")).toHaveAttribute(
        "data-screen",
        "onlineResult",
        { timeout: 15000 },
      );
    await a.screenshot({ path: `${audit}/lan-result.png`, fullPage: true });
    const epoch = room.matchId;
    await a.click("#online-rematch");
    await expect(a.locator("#online-rematch")).toBeDisabled();
    expect(room.matchId).toBe(epoch);
    await b.click("#online-rematch");
    for (const p of [a, b])
      await expect(p.locator("#app")).toHaveAttribute(
        "data-screen",
        "onlineFight",
      );
    expect(room.matchId).not.toBe(epoch);
    await expect(a.locator("canvas")).toHaveAttribute(
      "data-match-phase",
      "fight",
      { timeout: 10000 },
    );
    await b.keyboard.press("Escape");
    await b.click("#pause-menu");
    await expect(b.locator("#app")).toHaveAttribute(
      "data-screen",
      "leaveConfirm",
    );
    await b.click("#keep-playing");
    await expect(b.locator("#app")).toHaveAttribute(
      "data-screen",
      "onlinePause",
    );
    await b.click("#pause-menu");
    await b.click("#confirm-leave");
    await expect(b.locator("#app")).toHaveAttribute("data-screen", "menu");
    await expect(a.locator("#app")).toHaveAttribute(
      "data-screen",
      "onlineResult",
    );
    await expect(a.locator("#overlay")).toContainText("saiu");
    await a.click("#online-lobby");
    await expect(a.locator("#app")).toHaveAttribute(
      "data-screen",
      "onlineLobby",
    );
    await a.keyboard.press("Escape");
    await a.keyboard.press("Escape");
    await expect(a.locator("#app")).toHaveAttribute(
      "data-screen",
      "onlineLobby",
    );
    await a.click("#leave-room");
    await a.click("#confirm-leave");
    await expect(a.locator("#app")).toHaveAttribute("data-screen", "menu");
    writeFileSync(
      `${audit}/lan-confirmation.json`,
      JSON.stringify(
        {
          code,
          validated: true,
          damage: true,
          hashes: true,
          serverConfirmed: true,
          mutualRematch: true,
          devices: "independent browser contexts on one computer",
        },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
  } finally {
    await ctxA.close();
    await ctxB.close();
    await ctxC.close();
  }
});
test("server unavailable, connection recovery and network entry back", async ({
  page,
}) => {
  test.skip(!production, "Apache only");
  await server.close();
  server = undefined;
  await page.goto(root);
  await page.click("#online");
  await expect(page.locator("#online-error")).toContainText(
    /servidor|conexão/,
    { timeout: 20000 },
  );
  await expect(page.locator("#create-room")).toBeDisabled();
  await start();
  await page.click("#reconnect-online");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-connection",
    "connected",
    { timeout: 20000 },
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "menu");
});

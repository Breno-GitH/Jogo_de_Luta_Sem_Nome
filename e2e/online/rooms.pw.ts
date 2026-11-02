import {
  test,
  expect,
  chromium,
  type Browser,
  type Page,
} from "@playwright/test";
import { io } from "socket.io-client";
import { mkdirSync } from "node:fs";
import type { createGameServer as ServerFactory } from "../../server/server";
const corePath = "../../server-dist/server-core.mjs";
const { createGameServer } = (await import(corePath)) as {
  createGameServer: typeof ServerFactory;
};
import { ENGINE_VERSION } from "../../src/net/version";
let server: ReturnType<typeof createGameServer>;
let browsers: Browser[] = [];
let a: Page, b: Page;
const base = "http://127.0.0.1:5175";
test.beforeAll(async () => {
  mkdirSync("art/samurai/qa/online", { recursive: true });
  server = createGameServer({ origins: [base], graceMs: 3500 });
  await new Promise<void>((resolve) =>
    server.http.listen(3101, "127.0.0.1", resolve),
  );
});
test.afterAll(async () => {
  await server.close();
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
  await Promise.all(browsers.map((browser) => browser.close()));
});
async function entry(page: Page, path = "/") {
  await page.goto(base + path);
  await page.locator("#online").click();
  await expect(page.locator("#app")).toHaveAttribute(
    "data-connection",
    "connected",
  );
  await expect(page.locator("#create-room")).toBeEnabled();
}
async function createPair(fixture = false) {
  await entry(a, fixture ? "/e2e/online/fixture.html" : "/");
  await entry(b);
  await a.locator("#create-room").click();
  const code = (await a.locator("#lobby-code").innerText()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  await b.locator("#room-code").fill(code);
  await b.locator("#join-room").click();
  await expect(b.locator("#lobby-code")).toHaveText(code);
  return code;
}
async function start() {
  await a.locator("#online-samurai").check();
  await b.locator("#online-samurai").check();
  await a.locator("#online-confirm").click();
  await b.locator("#online-confirm").click();
  await a.locator("#online-ready").click();
  await expect(a.locator("#app")).toHaveAttribute("data-screen", "onlineLobby");
  await b.locator("#online-ready").click();
  await expect(a.locator("#online-start")).toBeEnabled();
  await a.locator("#online-start").click();
  for (const page of [a, b]) {
    await expect(page.locator("#app")).toHaveAttribute(
      "data-screen",
      "onlineFight",
    );
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-match-phase",
      "fight",
    );
  }
}
async function approach() {
  await a.keyboard.down("d");
  await b.keyboard.down("a");
  await expect
    .poll(
      async () =>
        Number(await a.locator("canvas").getAttribute("data-target-x")) -
        Number(await a.locator("canvas").getAttribute("data-player-x")),
    )
    .toBeLessThan(105);
  await a.keyboard.up("d");
  await b.keyboard.up("a");
  await expect(a.locator("canvas")).toHaveAttribute(
    "data-input-direction",
    "0",
  );
  await expect(b.locator("canvas")).toHaveAttribute(
    "data-input-direction",
    "0",
  );
}
async function hashHistory(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("#app")!,
      records: Record<string, string> = {};
    (window as any).testHashes = records;
    new MutationObserver(() => {
      if (root.dataset.netMatch && root.dataset.netTick && root.dataset.netHash)
        records[`${root.dataset.netMatch}:${root.dataset.netTick}`] =
          root.dataset.netHash;
    }).observe(root, { attributes: true });
  });
}
async function sameHistory() {
  await expect
    .poll(async () => {
      const x = await a.evaluate(
          () => (window as any).testHashes as Record<string, string>,
        ),
        y = await b.evaluate(
          () => (window as any).testHashes as Record<string, string>,
        );
      const common = Object.keys(x).filter((tick) => y[tick]);
      return common.length >= 3 && common.every((tick) => x[tick] === y[tick]);
    })
    .toBe(true);
}
async function finish(code: string, winner: 0 | 1) {
  const room = server.rooms.rooms.get(code)!;
  for (let round = 1; round <= 2; round++) {
    await expect.poll(() => room.match?.phase, { timeout: 8000 }).toBe("fight");
    // Server-only fixture shortens HP; remote clients have no such operation.
    room.match!.fighters[1 - winner].health = 0;
    await expect.poll(() => room.match!.wins[winner]).toBe(round);
  }
  await expect.poll(() => room.status, { timeout: 8000 }).toBe("finished");
  for (const page of [a, b])
    await expect(page.locator("#app")).toHaveAttribute(
      "data-screen",
      "onlineResult",
    );
}

test("two independent Chrome browsers create/join/select, reject unknown/full rooms, exchange inputs and verify equal states", async () => {
  const errors: string[] = [];
  a.on("pageerror", (error) => errors.push(error.message));
  b.on("pageerror", (error) => errors.push(error.message));
  await entry(a);
  await entry(b);
  await b.locator("#room-code").fill("XXXXXX");
  await b.locator("#join-room").click();
  await expect(b.locator("#online-error")).toContainText("não encontrada");
  await a.locator("#create-room").click();
  const code = await a.locator("#lobby-code").innerText();
  await b.locator("#room-code").fill(code);
  await b.locator("#join-room").click();
  await expect(b.locator("#lobby-code")).toHaveText(code);
  const third = io("http://127.0.0.1:3101", {
    transports: ["websocket"],
    forceNew: true,
  });
  await new Promise<void>((resolve) => third.once("connect", resolve));
  expect(
    (
      await third
        .timeout(2000)
        .emitWithAck("room:join", { code, version: ENGINE_VERSION })
    ).code,
  ).toBe("roomFull");
  third.disconnect();
  await a.screenshot({
    path: "art/samurai/qa/online/lobby.png",
    fullPage: true,
  });
  await start();
  await hashHistory(a);
  await hashHistory(b);
  await expect(a.locator("canvas")).toHaveAttribute("data-local-seat", "0");
  await expect(b.locator("canvas")).toHaveAttribute("data-local-seat", "1");
  await approach();
  await a.keyboard.press("j");
  await expect(a.locator("canvas")).toHaveAttribute("data-p2-health", "955");
  await expect(b.locator("canvas")).toHaveAttribute("data-p2-health", "955");
  await expect(b.locator("canvas")).toHaveAttribute(
    "data-physics-state",
    "idle",
  );
  await b.keyboard.press("j");
  for (const page of [a, b])
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-p1-health",
      "955",
    );
  await sameHistory();
  for (const page of [a, b])
    await expect(page.locator("#app")).toHaveAttribute("data-resyncs", "0");
  await a.screenshot({
    path: "art/samurai/qa/online/player-one.png",
    fullPage: true,
  });
  await b.screenshot({
    path: "art/samurai/qa/online/player-two.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("server results are shared and a rematch requires both votes before health and rounds reset", async () => {
  const code = await createPair();
  await start();
  await finish(code, 0);
  const old = server.rooms.rooms.get(code)!.matchId;
  await expect(a.locator("#overlay")).toContainText("Vitória.");
  await expect(b.locator("#overlay")).toContainText("Derrota.");
  await a.locator("#online-rematch").click();
  await expect(a.locator("#online-rematch")).toBeDisabled();
  expect(server.rooms.rooms.get(code)!.matchId).toBe(old);
  await b.locator("#online-rematch").click();
  for (const page of [a, b]) {
    await expect(page.locator("#app")).toHaveAttribute(
      "data-screen",
      "onlineFight",
    );
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-p1-health",
      "1000",
    );
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-p2-health",
      "1000",
    );
  }
  expect(server.rooms.rooms.get(code)!.matchId).not.toBe(old);
  expect(server.rooms.rooms.get(code)!.match!.wins).toEqual([0, 0]);
});

test("a corrupted client mirror cannot change server health and is repaired from an authoritative checkpoint", async () => {
  const code = await createPair(true);
  await start();
  const room = server.rooms.rooms.get(code)!;
  await a.evaluate(() => (window as any).networkFixture.corrupt());
  // A packet carrying an authoritative checkpoint can repair the one client
  // in place. Otherwise requestSync rotates the shared session. Both paths
  // must restore health and converge; requiring a new ID was timing-dependent.
  await expect(a.locator("#app")).not.toHaveAttribute("data-resyncs", "0");
  for (const page of [a, b]) {
    await expect(page.locator("#app")).toHaveAttribute(
      "data-screen",
      "onlineFight",
    );
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-p1-health",
      "1000",
    );
  }
  // Compare new ticks after recovery; the deliberately corrupted interval
  // must not be included in a convergence assertion.
  await hashHistory(a);
  await hashHistory(b);
  await sameHistory();
  expect(room.match!.fighters[0].health).toBe(1000);
  expect(room.result).toBeUndefined();
});

test("a page reload recovers its reserved seat; a lasting disconnect ends safely without rematch", async () => {
  const code = await createPair();
  await start();
  const old = server.rooms.rooms.get(code)!.matchId;
  await a.reload();
  await a.locator("#online").click();
  await expect(a.locator("#app")).toHaveAttribute("data-screen", "onlineFight");
  await expect.poll(() => server.rooms.rooms.get(code)!.matchId).not.toBe(old);
  await expect(a.locator("canvas")).toHaveAttribute("data-local-seat", "0");
  await browsers[1].close();
  browsers = browsers.slice(0, 1);
  await expect(a.locator("#app")).toHaveAttribute(
    "data-screen",
    "onlineResult",
    { timeout: 10000 },
  );
  await expect(a.locator("#overlay")).toContainText("Vitória.");
  await expect(a.locator("#overlay")).toContainText("conexão do adversário");
  await expect(a.locator("#online-rematch")).toHaveCount(0);
});
test("the production Node server serves the built client and both players can start without Vite proxying Socket.IO", async () => {
  for (const page of [a, b]) {
    await page.goto("http://127.0.0.1:3101/");
    await page.locator("#online").click();
    await expect(page.locator("#app")).toHaveAttribute(
      "data-connection",
      "connected",
    );
  }
  await a.locator("#create-room").click();
  const code = await a.locator("#lobby-code").innerText();
  await b.locator("#room-code").fill(code);
  await b.locator("#join-room").click();
  await expect(b.locator("#lobby-code")).toHaveText(code);
  await start();
  for (const page of [a, b])
    await expect(page.locator("#app")).toHaveAttribute("data-resyncs", "0");
});

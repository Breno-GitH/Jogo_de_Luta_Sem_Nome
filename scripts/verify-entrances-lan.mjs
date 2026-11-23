import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const url = process.env.MSFD_TEST_URL ?? "http://127.0.0.1:5180/";
const out =
  process.env.MSFD_ENTRANCE_EVIDENCE ?? "deployment/audit/entrances/lan";
mkdirSync(out, { recursive: true });
// Tests reuse the production server factory; no replacement transport or server is shipped.
let server;
if (process.env.MSFD_ENTRANCE_SERVER) {
  const { createGameServer } = await import(
    pathToFileURL(process.env.MSFD_ENTRANCE_SERVER).href
  );
  server = createGameServer({
    origins: [],
    serveFrontend: false,
    trustLoopbackProxy: true,
    inputTimeoutMs: 7000,
  });
  await new Promise((resolve) =>
    server.http.listen(3188, "127.0.0.1", resolve),
  );
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
const scenarios = [];
try {
  for (const skip of [false, true]) {
    const pages = await Promise.all(
      [0, 1].map(() =>
        browser.newPage({ viewport: { width: 1440, height: 1100 } }),
      ),
    );
    const [a, b] = pages,
      errors = [];
    for (const p of pages) {
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(url);
      await p.locator("#online").click();
      await expect(p.locator("#app")).toHaveAttribute(
        "data-connection",
        "connected",
        { timeout: 30000 },
      );
      await p.evaluate(() => {
        window.introNet = {};
        new MutationObserver(() => {
          const d = document.querySelector("#app").dataset,
            c = document.querySelector("canvas").dataset;
          if (d.netMatch && d.netHash)
            window.introNet[d.netMatch + ":" + d.netTick] = {
              hash: d.netHash,
              phase: c.matchPhase,
              age: c.introTick,
              votes: c.introVotes,
              skipped: c.introSkipped,
              p1: c.p1Health,
              p2: c.p2Health,
              state: c.physicsState,
            };
        }).observe(document.querySelector("#app"), { attributes: true });
      });
    }
    await a.locator("#create-room").click();
    const code = (await a.locator("#lobby-code").innerText()).trim();
    await b.locator("#room-code").fill(code);
    await b.locator("#join-room").click();
    await expect(b.locator("#lobby-code")).toHaveText(code);
    for (const [p, id] of [
      [a, "asta"],
      [b, "dio"],
    ]) {
      await p.locator("#online-" + id).check();
      await p.locator("#online-confirm").click();
      await p.locator("#online-ready").click();
    }
    await a.locator("#online-start").click();
    for (const p of pages)
      await expect(p.locator("canvas")).toHaveAttribute(
        "data-match-phase",
        "intro",
      );
    if (skip) {
      await a.bringToFront();
      await a.locator("canvas").focus();
      await a.keyboard.press("Enter", { delay: 60 });
      await a.waitForTimeout(180);
      for (const p of pages)
        await expect(p.locator("canvas")).toHaveAttribute(
          "data-intro-votes",
          "1,0",
        );
      await a.waitForTimeout(220);
      for (const [i, p] of pages.entries()) {
        await expect(p.locator("canvas")).toHaveAttribute(
          "data-intro-skipped",
          "false",
        );
        await expect(p.locator("canvas")).toHaveAttribute(
          "data-match-phase",
          "intro",
        );
        await p
          .locator("canvas")
          .screenshot({ path: `${out}/vote-one-p${i + 1}.png` });
      }
      await b.bringToFront();
      await b.locator("canvas").focus();
      await b.keyboard.press("Enter", { delay: 60 });
      for (const p of pages)
        await expect(p.locator("canvas")).toHaveAttribute(
          "data-intro-skipped",
          "true",
        );
    }
    for (const p of pages) {
      await p.locator("canvas").focus();
      await p.keyboard.down("r");
      await p.keyboard.down("j");
    }
    for (const p of pages)
      await expect(p.locator("canvas")).toHaveAttribute(
        "data-match-phase",
        "fight",
        { timeout: 12000 },
      );
    for (const p of pages) {
      await p.keyboard.up("r");
      await p.keyboard.up("j");
    }
    await a.waitForTimeout(200);
    for (const p of pages) {
      await expect(p.locator("canvas")).toHaveAttribute(
        "data-p1-health",
        "1000",
      );
      await expect(p.locator("canvas")).toHaveAttribute(
        "data-p2-health",
        "1000",
      );
      await expect(p.locator("canvas")).toHaveAttribute(
        "data-physics-state",
        "idle",
      );
    }
    const x = await a.evaluate(() => window.introNet),
      y = await b.evaluate(() => window.introNet);
    const common = Object.keys(x).filter((k) => y[k]);
    expect(common.length).toBeGreaterThan(skip ? 35 : 180);
    expect(common.every((k) => x[k].hash === y[k].hash)).toBe(true);
    const intro = common.filter(
      (k) => x[k].phase === "intro" && y[k].phase === "intro",
    );
    expect(intro.length).toBeGreaterThan(15);
    expect(
      intro.every(
        (k) =>
          x[k].p1 === "1000" &&
          x[k].p2 === "1000" &&
          y[k].p1 === "1000" &&
          y[k].p2 === "1000",
      ),
    ).toBe(true);
    const resyncs = await Promise.all(
      pages.map((p) => p.locator("#app").getAttribute("data-resyncs")),
    );
    expect(resyncs).toEqual(["0", "0"]);
    expect(errors).toEqual([]);
    for (const [i, p] of pages.entries())
      await p.locator("canvas").screenshot({
        path: `${out}/${skip ? "skip" : "natural"}-fight-p${i + 1}.png`,
      });
    scenarios.push({
      skip,
      commonTicks: common.length,
      introTicks: intro.length,
      hashesEqual: true,
      resyncs,
      errors,
      clients: [x, y],
    });
    if (server && !skip) {
      // Controlled authoritative fixtures shorten the fights, not the entrances.
      // Both real clients still receive/execute the normal epoch and round packets.
      const room = server.rooms.rooms.get(code);
      room.match.wins = [1, 0];
      room.match.phase = "roundEnd";
      room.match.phaseFrames = 1;
      server.rooms.start(room, "start");
      for (const p of pages) {
        await expect(p.locator("canvas")).toHaveAttribute("data-round", "2");
        await expect(p.locator("canvas")).toHaveAttribute(
          "data-intro-full",
          "false",
        );
        await expect(p.locator("canvas")).toHaveAttribute(
          "data-match-phase",
          "fight",
        );
      }
      room.match.wins = [2, 0];
      room.match.phase = "roundEnd";
      room.match.phaseFrames = 1;
      server.rooms.start(room, "start");
      for (const p of pages)
        await expect(p.locator("#online-rematch")).toBeVisible();
      await a.locator("#online-rematch").click();
      await a.waitForTimeout(100);
      await expect(a.locator("#app")).toHaveAttribute(
        "data-screen",
        "onlineResult",
      );
      await b.locator("#online-rematch").click();
      for (const p of pages) {
        await expect(p.locator("canvas")).toHaveAttribute(
          "data-match-phase",
          "intro",
        );
        await expect(p.locator("canvas")).toHaveAttribute(
          "data-intro-full",
          "true",
        );
        await expect(p.locator("canvas")).toHaveAttribute(
          "data-intro-votes",
          "0,0",
        );
        await expect(p.locator("canvas")).toHaveAttribute("data-round", "1");
      }
      await a
        .locator("canvas")
        .screenshot({ path: `${out}/rematch-new-intro.png` });
      for (const p of pages)
        await expect(p.locator("canvas")).toHaveAttribute(
          "data-match-phase",
          "fight",
          { timeout: 15000 },
        );
      scenarios.at(-1).shortRoundAndRematchFixture = true;
    }
    await a.locator("#pause").click();
    await a.locator("#pause-menu").click();
    await a.locator("#confirm-leave").click();
    await Promise.all(pages.map((p) => p.close()));
    console.log(
      `LAN ${skip ? "two-vote skip" : "natural intro"}: ${common.length} equal hashes, resync 0/0`,
    );
  }
  writeFileSync(
    `${out}/result.json`,
    JSON.stringify({ url, scenarios }, null, 2),
  );
} finally {
  await browser.close();
  await server?.close();
}

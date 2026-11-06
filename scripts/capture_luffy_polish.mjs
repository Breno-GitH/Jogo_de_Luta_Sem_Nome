import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [version, root] = process.argv.slice(2);
if (!["before", "after"].includes(version) || !root) {
  throw new Error(
    "Uso: node scripts/capture_luffy_polish.mjs before|after URL/",
  );
}
const output = `deployment/audit/luffy-polish/${version}`;
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const write = (file, url) =>
  writeFileSync(
    `${output}/${file}.png`,
    Buffer.from(url.split(",")[1], "base64"),
  );
try {
  await page.goto(root + "art/luffy.html", { waitUntil: "domcontentloaded" });
  await page
    .locator("#normal option[value=bazooka_heavy]")
    .waitFor({ state: "attached" });
  // Peak drawings and each move's complete timeline from the real pose inspector.
  const normals = {
    stand_medium: [7, 10, 20],
    stand_heavy: [12, 16, 25],
    crouch_medium: [7, 10, 21],
    crouch_heavy: [10, 14, 24],
    air_medium: [8, 12, 20],
    air_heavy: [13, 18, 27],
    pistol_heavy: [17, 22, 31],
    gatling_heavy: [15, 23, 60],
    bazooka_heavy: [16, 21, 29],
  };
  for (const [id, [tick, alt, end]] of Object.entries(normals)) {
    const result = await page.evaluate(
      ({ id, tick, alt, end }) => {
        const list = document.querySelector("#normal");
        const slider = document.querySelector("#normal-tick");
        const view = document.querySelector("#normal-preview");
        const mirror = document.querySelector("#normal-mirror");
        list.value = id;
        list.dispatchEvent(new Event("change"));
        const at = (n) => {
          slider.value = String(n);
          slider.dispatchEvent(new Event("input"));
          return view.toDataURL();
        };
        const left = at(tick),
          right = at(alt);
        mirror.checked = true;
        mirror.dispatchEvent(new Event("change"));
        const mirrored = at(alt);
        mirror.checked = false;
        mirror.dispatchEvent(new Event("change"));
        const recovery = at(end);
        const button = document.querySelector("#normal-impact");
        if (button) {
          button.click();
          if (view.dataset.contact !== "true")
            throw Error(id + " não acertou na prova");
          return { left, right, mirrored, recovery, impact: view.toDataURL() };
        }
        return { left, right, mirrored, recovery };
      },
      { id, tick, alt, end },
    );
    for (const [label, data] of Object.entries(result))
      write(`${id}-${label}`, data);
  }
  await page.goto(root + "art/luffy-jet.html", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#arena[data-loaded=true]").waitFor({ timeout: 45000 });
  const captures = {
    gear: 26,
    pistol: 72,
    bazooka: 139,
    gatling: 199,
    inflate: 323,
    windup: 355,
    gigant: 375,
    landing: 409,
    small: 439,
    recovered: 531,
  };
  const captureJet = (tick) =>
    page.evaluate((tick) => {
      const slider = document.querySelector("#seek");
      slider.value = String(tick);
      slider.dispatchEvent(new Event("input"));
      const arena = document.querySelector("#arena");
      return { url: arena.toDataURL(), data: { ...arena.dataset } };
    }, tick);
  for (const [phase, tick] of Object.entries(captures)) {
    const { url, data } = await captureJet(tick);
    console.log(phase, data.jetPhase, data.jetFist, data.targetHealth);
    write("jet-" + phase, url);
  }
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}

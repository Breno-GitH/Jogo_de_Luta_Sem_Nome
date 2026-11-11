import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "@playwright/test";

test("capture the real Ben engine and renderer for the stage 4 proof", async ({ page }) => {
  test.skip(process.env.BEN_COMBAT_PROOF !== "1", "Optional visual captures from the development build");
  test.setTimeout(240000);
  await page.goto("./art/ben.html");
  const frames = await page.evaluate(async () => {
    const { Match } = await import("/src/engine/combat.ts");
    const { characters } = await import("/src/engine/characters.ts");
    const { neutral } = await import("/src/engine/types.ts");
    const { Renderer } = await import("/src/render/renderer.ts");
    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    const renderer = new Renderer(canvas);
    await renderer.preparePalette("cyan");
    const output = {};
    function arena(form, distance) {
      const match = new Match(characters.ben, { training: true }, characters.sasuke);
      match.phase = "fight";
      match.message = "";
      const [f, rival] = match.fighters;
      f.omnitrix.active = form;
      f.omnitrix.selected = form;
      f.x = 495; rival.x = f.x + distance;
      renderer.resetAnimations();
      renderer.tick(match);
      let video;
      let tick = 0;
      let total = 0;
      function paint(type = "image/png") {
        renderer.draw(match);
        return canvas.toDataURL(type, .88).split(",")[1];
      }
      function step(input = {}) {
        match.step([{ ...neutral(), ...input }, neutral()]);
        total += match.hits.filter(h => h.damage).length;
        renderer.tick(match);
        if (video && tick++ % 3 === 0) video.push(paint("image/webp"));
      }
      function run(n, input = {}) { for (let i = 0; i < n; i++) step(input); }
      function motion(type, b) {
        step({ down: true });
        if (type === 2) {
          step();
          step({ down: true, pressed: [b] });
        } else step({ direction: type === 0 ? 1 : -1, pressed: [b] });
      }
      function until(condition, limit = 90) {
        for (let i = 0; i < limit && !condition(); i++) step();
        if (!condition()) throw new Error("Visual scene did not reach the requested phase: " + form + " " + f.moveId);
      }
      return { match, f, rival, step, run, motion, until, paint, total: () => total,
        record() { video = [paint("image/webp")]; },
        video() { return video; },
      };
    }

    const shots = [
      ["turbo", "xlr8", 125, 0, "medium", a => a.f.moveId === "turbo_medium" && a.f.stateFrame >= 15],
      ["ciclone", "xlr8", 65, 1, "medium", a => a.f.moveId === "cyclone_medium" && a.f.stateFrame >= 19],
      ["quadruplo", "fourArms", 69, 1, "medium", a => a.match.capture?.ben && a.match.capture.tick >= 14],
      ["sismica", "fourArms", 150, 2, "medium", a => a.f.omnitrix.objects.some(o => o.age >= 5)],
      ["bola", "heatblast", 420, 0, "medium", a => a.f.omnitrix.objects.some(o => o.age >= 9)],
      ["pilar", "heatblast", 215, 1, "medium", a => a.f.omnitrix.objects.some(o => o.age >= 5)],
      ["propulsao", "heatblast", 180, 2, "medium", a => a.f.y < 490],
    ];
    for (const [key, form, distance, family, strength, scene] of shots) {
      const a = arena(form, distance);
      a.motion(family, strength);
      a.until(() => scene(a));
      output[key] = a.paint();
    }

    for (const form of ["xlr8", "fourArms", "heatblast"]) {
      const a = arena(form, 68);
      a.record();
      a.step({ pressed: ["light"] });
      a.until(() => a.f.hitConfirmed);
      while (a.match.hitstop) a.step();
      a.step({ pressed: ["medium"] });
      a.until(() => a.f.hitConfirmed);
      while (a.match.hitstop) a.step();
      a.motion(0, "light");
      a.until(() => a.total() >= 3);
      a.run(9);
      output["combo-" + form] = a.paint();
      a.run(12);
      output["video-" + form] = a.video();
    }

    const a = arena("xlr8", 67);
    a.record();
    a.step({ pressed: ["heavy"], omnitrix: { held: false } });
    a.motion(0, "light");
    a.step({ pressed: ["heavy"], omnitrix: { held: true } });
    let mid = false;
    for (let i = 0; i < 25; i++) {
      a.step({ omnitrix: { held: true } });
      if (!mid && a.f.omnitrix.transition?.ticks === 3) {
        output["troca"] = a.paint();
        mid = true;
      }
    }
    if (!mid || a.f.omnitrix.active !== "fourArms") throw new Error("Combo switch was not captured");
    a.step({ pressed: ["medium"], omnitrix: { held: false } });
    a.run(22);
    if (a.total() !== 2 || a.rival.combo !== 2) throw new Error("Combo did not persist through the form change");
    output["video-troca"] = a.video();
    return output;
  });
  const folder = "test-results/ben-combat";
  mkdirSync(folder, { recursive: true });
  for (const [name, data] of Object.entries(frames)) {
    if (Array.isArray(data)) {
      data.forEach((frame, index) => writeFileSync(`${folder}/${name}-${String(index).padStart(3, "0")}.webp`, Buffer.from(frame, "base64")));
    } else writeFileSync(`${folder}/${name}.png`, Buffer.from(data, "base64"));
  }
});


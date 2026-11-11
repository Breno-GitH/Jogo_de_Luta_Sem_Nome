import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "@playwright/test";

test("captures the new forms, mechanics and combos in the engine", async ({ page }) => {
  test.skip(process.env.BEN_STAGE5_PROOF !== "1", "Optional stage 5 presentation captures");
  test.setTimeout(300000);
  await page.goto("./art/ben.html");
  const proof = await page.evaluate(async () => {
    const { Match, FLOOR } = await import("/src/engine/combat.ts");
    const { characters } = await import("/src/engine/characters.ts");
    const { neutral } = await import("/src/engine/types.ts");
    const { Renderer } = await import("/src/render/renderer.ts");
    const scene = document.createElement("canvas");
    scene.width = 1280; scene.height = 720;
    const videoFrame = document.createElement("canvas");
    videoFrame.width = 720; videoFrame.height = 405;
    const videoCtx = videoFrame.getContext("2d");
    videoCtx.imageSmoothingEnabled = false;
    const renderer = new Renderer(scene);
    await renderer.preparePalette("cyan");

    const output = {};
    function arena(form, gap = 80, foe = "sasuke") {
      const match = new Match(characters.ben, { training: true }, characters[foe]);
      match.phase = "fight";
      match.message = "";
      const [f, rival] = match.fighters;
      const watch = f.omnitrix;
      watch.active = watch.selected = form;
      f.x = 495; rival.x = f.x + gap;
      renderer.resetAnimations();
      renderer.tick(match);
      let recording;
      let sample = 0;
      const events = [];
      const step = (input = {}, other = {}) => {
        match.step([{ ...neutral(), ...input }, { ...neutral(), ...other }]);
        events.push(...match.hits);
        renderer.tick(match);
        if (recording && sample++ % 3 === 0) {
          renderer.draw(match);
          videoCtx.drawImage(scene, 0, 0, 720, 405);
          recording.push(videoFrame.toDataURL("image/webp", .84).split(",")[1]);
        }
      };
      const run = (ticks, input = {}) => { for (let i = 0; i < ticks; i++) step(input); };
      const until = (condition, label) => {
        for (let i = 0; !condition() && i < 140; i++) step();
        if (!condition()) throw Error(label + " | " + f.state + " " + f.moveId + " " + JSON.stringify(events));
      };
      const motion = (index, key) => {
        step({ down: true });
        if (index === 2) { step(); step({ down: true, pressed: [key] }); }
        else step({ direction: index === 0 ? 1 : -1, pressed: [key] });
      };
      const shot = key => {
        renderer.draw(match);
        output[key] = scene.toDataURL("image/png").split(",")[1];
      };
      return { match, f, rival, watch, events, step, run, until, motion, shot,
        record: () => { recording = []; }, save: key => { output["video-" + key] = recording; } };
    }

    const examples = [
      ["spikes", "diamondhead", 188, 0, "medium", a => a.watch.objects.some(o => o.age >= 8)],
      ["wall", "diamondhead", 285, 1, "medium", a => a.watch.objects.some(o => o.age >= 9)],
      ["shards", "diamondhead", 382, 2, "medium", a => a.watch.objects.some(o => o.age >= 7)],
      ["colossal", "humungousaur", 192, 0, "medium", a => a.events.some(h => h.move === "colossal_medium")],
      ["tail", "humungousaur", 123, 1, "medium", a => a.events.some(h => h.move === "tailspin_medium")],
      ["discharge", "feedback", 421, 0, "medium", a => a.watch.objects.some(o => o.age >= 6)],
      ["cables", "feedback", 122, 2, "medium", a => a.events.some(h => h.move === "cables_medium")],
    ];
    for (const [id, form, gap, family, strength, ready] of examples) {
      const a = arena(form, gap);
      a.motion(family, strength);
      a.until(() => ready(a), id);
      a.shot(id);
    }

    const giant = arena("humungousaur", 290);
    giant.shot("normal");
    giant.motion(2, "medium");
    giant.until(() => giant.watch.growth && giant.f.state === "idle", "growth completes");
    giant.shot("growth");

    const absorb = arena("feedback", 280, "goku");
    absorb.motion(1, "light");
    absorb.until(() => absorb.f.attackPhase === "active", "absorption window");
    const ki = Object.entries(absorb.rival.data.specialMoves).find(([, move]) => move.special === "ki")[0];
    absorb.match.kiProjectiles.push({
      id: ++absorb.match.projectileSerial, owner: 1, move: ki, cast: 0, x: absorb.f.x + 41,
      previousX: absorb.f.x + 41, y: FLOOR - 97, previousY: FLOOR - 97,
      vx: -14, vy: 0, facing: -1, radius: 12, age: 0, life: 20, state: "flight", impactAge: 0,
    });
    absorb.until(() => absorb.watch.charge > 0, "Goku ki absorbed");
    absorb.shot("absorb");
    absorb.until(() => absorb.f.state === "idle", "absorption recovery");
    absorb.motion(0, "light");
    absorb.until(() => absorb.watch.objects.some(o => o.power && o.age >= 5), "strengthened discharge");
    absorb.shot("charged");

    for (const [form, finisher] of [["diamondhead", "spikes_light"], ["humungousaur", "colossal_light"], ["feedback", "discharge_light"]]) {
      const a = arena(form, 71);
      a.record();
      a.step({ pressed: ["light"] });
      a.until(() => a.f.hitConfirmed, "light");
      while (a.match.hitstop) a.step();
      a.step({ pressed: ["medium"] });
      a.until(() => a.f.hitConfirmed, "medium");
      while (a.match.hitstop) a.step();
      a.motion(0, "light");
      a.until(() => a.events.some(e => e.move === finisher && e.combo === 3), finisher);
      a.run(20);
      a.shot("combo-" + form);
      a.save(form);
    }

    const swap = arena("diamondhead", 74);
    swap.record();
    for (let i = 0; i < 4; i++) swap.step({ pressed: ["heavy"], omnitrix: { held: false } });
    if (swap.watch.selected !== "xlr8") throw Error("Omnitrix selection before the opener");
    swap.motion(0, "medium");
    swap.run(9);
    swap.step({ pressed: ["heavy"], omnitrix: { held: true } });
    for (let i = 0; i < 24; i++) {
      swap.step({ omnitrix: { held: true } });
      if (swap.watch.transition?.ticks === 3) swap.shot("swap");
    }
    if (swap.watch.active !== "xlr8" || !swap.watch.comboSwap) throw Error("No confirmed combo swap");
    swap.step({ pressed: ["jump"], direction: 1, omnitrix: { held: false } });
    swap.until(() => swap.f.airborne, "pursuit jump");
    swap.step({ pressed: ["light"], direction: 1 });
    swap.until(() => swap.events.some(e => e.move === "air_light" && e.combo === 2), "swap follow-up");
    swap.run(18);
    swap.save("swap");
    return output;
  });
  const path = "test-results/ben-stage5";
  mkdirSync(path, { recursive: true });
  for (const [id, data] of Object.entries(proof)) {
    if (Array.isArray(data)) data.forEach((cel, i) =>
      writeFileSync(`${path}/${id}-${String(i).padStart(3, "0")}.webp`, Buffer.from(cel, "base64")));
    else writeFileSync(`${path}/${id}.png`, Buffer.from(data, "base64"));
  }
});


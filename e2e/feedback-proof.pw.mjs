import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "@playwright/test";

test("renders the corrected Feedback in motion and confirms his routes", async ({ page }) => {
  test.skip(process.env.FEEDBACK_PROOF !== "1", "Optional Feedback presentation captures");
  test.setTimeout(120000);
  await page.goto("./art/ben.html");
  const proof = await page.evaluate(async () => {
    const { Match, FLOOR } = await import("/src/engine/combat.ts");
    const { characters } = await import("/src/engine/characters.ts");
    const { neutral } = await import("/src/engine/types.ts");
    const { Renderer } = await import("/src/render/renderer.ts");
    const scene = document.createElement("canvas");
    scene.width = 1280;
    scene.height = 720;
    const renderer = new Renderer(scene);
    await renderer.preparePalette("cyan");
    const output = {};
    const sample = document.createElement("canvas");
    sample.width = 800;
    sample.height = 450;
    const pixels = sample.getContext("2d");
    pixels.imageSmoothingEnabled = false;

    function arena(gap, foe = "sasuke", seat = 0) {
      const ids = seat ? [characters[foe], characters.ben] : [characters.ben, characters[foe]];
      const match = new Match(ids[0], { training: true }, ids[1]);
      const f = match.fighters[seat], rival = match.fighters[1 - seat], watch = f.omnitrix;
      const facing = seat ? -1 : 1;
      watch.active = watch.selected = "feedback";
      match.phase = "fight";
      match.message = "";
      f.x = seat ? 790 : 465;
      rival.x = f.x + gap * facing;
      renderer.effects = true;
      renderer.resetAnimations();
      renderer.tick(match);
      const events = [];
      let frames, tick = 0;
      const step = (input = {}, other = {}) => {
        const own = { ...neutral(), ...input }, opp = { ...neutral(), ...other };
        match.step(seat ? [opp, own] : [own, opp]);
        events.push(...match.hits);
        renderer.tick(match);
        if (frames && tick++ % 3 === 0) {
          renderer.draw(match);
          pixels.drawImage(scene, 0, 0, 800, 450);
          frames.push(sample.toDataURL("image/webp", .90).split(",")[1]);
        }
      };
      const run = (n, input) => { for (let i = 0; i < n; i++) step(input); };
      const until = (check, label) => {
        for (let i = 0; i < 100 && !check(); i++) step();
        if (!check()) throw Error(label + ": " + JSON.stringify(events));
      };
      const motion = (family, key) => {
        step({ down: true });
        if (family === 2) { step(); step({ down: true, pressed: [key] }); }
        else step({ direction: family === 0 ? facing : -facing, pressed: [key] });
      };
      const shot = name => {
        renderer.draw(match);
        output[name] = scene.toDataURL().split(",")[1];
      };
      return { f, rival, watch, match, step, run, until, motion, shot, events,
        record: () => { frames = []; }, save: name => { output["video-" + name] = frames; } };
    }

    const still = arena(270, "samurai");
    still.run(10);
    still.shot("idle");
    const walk = arena(600);
    walk.record();
    walk.run(32, { direction: 1 });
    walk.run(7);
    walk.run(28, { direction: -1 });
    walk.run(10);
    walk.save("walk");

    for (const [id, button, charge] of [
      ["shot-j", "light", 0], ["shot-k", "medium", 0], ["shot-power", "medium", 75],
    ]) {
      const a = arena(386);
      a.watch.charge = charge;
      a.motion(0, button);
      a.until(() => a.watch.objects.some(o => o.age >= 6), id);
      a.shot(id);
    }

    const absorb = arena(255, "goku");
    absorb.motion(1, "light");
    absorb.until(() => absorb.f.attackPhase === "active", "absorption window");
    const ki = Object.entries(absorb.rival.data.specialMoves).find(([, move]) => move.special === "ki")[0];
    const x = absorb.f.x + 41, y = FLOOR - 97;
    absorb.match.kiProjectiles.push({ id: ++absorb.match.projectileSerial, owner: 1, move: ki, cast: 0,
      x, previousX: x, y, previousY: y, vx: -14, vy: 0, facing: -1, radius: 12,
      age: 0, life: 20, state: "flight", impactAge: 0 });
    absorb.until(() => absorb.watch.charge > 0, "Goku ki absorbed");
    absorb.run(4);
    absorb.shot("absorb");

    const counter = arena(66, "samurai");
    counter.motion(1, "medium");
    counter.run(7);
    counter.rival.attack("stand_light");
    counter.rival.stateFrame = counter.rival.move.startup - 1;
    counter.step();
    if (!counter.events.some(e => e.move === "feedback_counter")) throw Error("counter failed");
    counter.shot("counter");

    for (const [id, key, gap] of [["horizontal", "light", 120], ["upper", "medium", 95]]) {
      const a = arena(gap);
      a.motion(2, key);
      a.until(() => a.events.some(e => e.move === "cables_" + key), id);
      a.shot(id);
      const art = arena(400);
      art.motion(2, key);
      const move = art.f.move;
      if (!move?.ben?.cable) throw Error("whip command not recognized");
      renderer.effects = false;
      for (const [i, frame] of [1, move.startup - 2, move.startup + 4, move.startup + move.active + 8].entries()) {
        art.until(() => art.f.stateFrame >= frame, id + " poses");
        art.shot(id + "-" + i);
      }
    }

    const basic = arena(71);
    basic.record();
    basic.step({ pressed: ["light"] });
    basic.until(() => basic.f.hitConfirmed, "standing light");
    while (basic.match.hitstop) basic.step();
    basic.step({ pressed: ["medium"] });
    basic.until(() => basic.f.hitConfirmed, "standing medium");
    while (basic.match.hitstop) basic.step();
    basic.motion(0, "light");
    basic.until(() => basic.events.some(e => e.move === "discharge_light" && e.combo === 3), "discharge combo");
    basic.shot("basic");
    basic.run(21);
    basic.save("combo");

    const aerial = arena(87);
    aerial.record();
    aerial.motion(2, "medium");
    aerial.until(() => aerial.rival.airborne, "launcher");
    while (aerial.match.hitstop) aerial.step();
    aerial.step({ pressed: ["jump"], direction: 1 });
    aerial.run(2, { direction: 1 });
    aerial.step({ pressed: ["light"], direction: 1 });
    for (let i = 0; i < 18 && aerial.events.length < 2; i++) aerial.step({ direction: 1 });
    while (aerial.match.hitstop) aerial.step();
    aerial.step({ pressed: ["medium"], direction: 1 });
    aerial.until(() => aerial.events.some(e => e.move === "air_medium" && e.combo === 3), "aerial combo");
    aerial.shot("aerial");
    aerial.run(25);
    aerial.save("air-combo");

    // Simultaneously run both orientations for 30 real seconds with the game renderer.
    const left = arena(270, "samurai"), right = arena(270, "samurai", 1);
    const positions = [left.f.x, right.f.x];
    let ticks = 0;
    await new Promise((resolve, reject) => {
      const start = performance.now();
      function frame(now) {
        try {
          const target = Math.min(1800, Math.floor((now - start) * .06));
          for (; ticks < target; ticks++) {
            for (const [i, a] of [left, right].entries()) {
              a.step();
              if (a.f.x !== positions[i] || a.f.y !== FLOOR || a.f.state !== "idle" || a.f.facing !== (i ? -1 : 1)) {
                throw Error("Idle drift at tick " + ticks);
              }
            }
          }
          const view = (ticks % 2 ? left : right);
          renderer.draw(view.match);
          if (ticks === 1800) resolve(); else requestAnimationFrame(frame);
        } catch (error) { reject(error); }
      }
      requestAnimationFrame(frame);
    });
    right.shot("mirrored");
    return output;
  });
  const path = "test-results/feedback-proof";
  mkdirSync(path, { recursive: true });
  for (const [id, data] of Object.entries(proof)) {
    if (Array.isArray(data)) data.forEach((cel, i) =>
      writeFileSync(`${path}/${id}-${String(i).padStart(3, "0")}.webp`, Buffer.from(cel, "base64")));
    else writeFileSync(`${path}/${id}.png`, Buffer.from(data, "base64"));
  }
});

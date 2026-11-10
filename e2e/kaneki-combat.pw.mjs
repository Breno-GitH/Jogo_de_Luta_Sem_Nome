import { expect, test } from "@playwright/test";

test("Centipede plays the full scene, converts grabs and restores the camera", async ({page}) => {
  test.setTimeout(65000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("art/kaneki-combat.html");
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true", {timeout:30000});
  await page.selectOption("#scenario","superCentipede");
  await seek(page,14);
  await expect(arena).toHaveAttribute("data-animation","centipedeActivation");
  for (const [tick,phase] of [[46,"transformation"],[119,"rush"],[172,"zigzag"],[264,"wall"],[312,"capture"],[351,"ascend"],[381,"windup"],[406,"descent"],[425,"impact"],[490,"return"]]) {
    await seek(page,tick);
    await expect(arena).toHaveAttribute("data-centipede-phase",phase);
  }
  await seek(page,550);
  await expect(arena).toHaveAttribute("data-capture","none");
  await expect(arena).toHaveAttribute("data-camera-zoom","1");
  await page.locator("#mirror").check();
  await seek(page,230);
  await expect(arena).toHaveAttribute("data-centipede-armor","1");
  await page.selectOption("#scenario","superCentipedeGrab");
  await seek(page,100);
  await expect(arena).toHaveAttribute("data-centipede-source","kaguneGrab");
  await page.selectOption("#scenario","superCentipedeMiss");
  await seek(page,120);
  await expect(arena).toHaveAttribute("data-capture","none");
  await expect(arena).toHaveAttribute("data-target-health","1000");
  expect(errors).toEqual([]);
});

test("Centipede emits one audible ground impact at the contact tick", async ({page}) => {
  await page.addInitScript(() => {
    window.centipedeGroundCues = [];
    const connect = AudioBufferSourceNode.prototype.connect;
    const start = AudioBufferSourceNode.prototype.start;
    const ground = new WeakSet();
    AudioBufferSourceNode.prototype.connect = function (destination, ...args) {
      if (destination instanceof BiquadFilterNode && destination.frequency.value === 580) ground.add(this);
      return connect.call(this,destination,...args);
    };
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (ground.has(this) && this.context.state === "running" && this.buffer?.getChannelData(0).some(x => x !== 0))
        window.centipedeGroundCues.push(Number(document.querySelector("#arena").dataset.centipedeTick));
      return start.apply(this,args);
    };
  });
  await page.goto("art/kaneki-combat.html");
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded","true",{timeout:30000});
  await page.selectOption("#scenario","superCentipede");
  await page.locator("#audio").click();
  await expect(page.locator("#audio")).toHaveText("Som ativo");
  await seek(page,408);
  await expect(arena).toHaveAttribute("data-centipede-phase","descent");
  await page.locator("#play").click();
  await expect(arena).toHaveAttribute("data-centipede-phase","impact");
  await page.locator("#play").click();
  expect(await page.evaluate(() => window.centipedeGroundCues)).toEqual([366]);
});

async function seek(page, tick) {
  await page.locator("#seek").evaluate((slider, n) => {
    slider.value = String(n);
    slider.dispatchEvent(new Event("input"));
  }, tick);
}

test("Kaneki captures and releases three ways using the real renderer", async ({
  page,
}) => {
  test.setTimeout(65000);
  await page.goto("art/kaneki-combat.html");
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true", {
    timeout: 30000,
  });
  await expect(arena).toHaveAttribute("data-character", "kaneki");
  for (const [mode, clip, health] of [
    ["pull", "kagunePull", 926],
    ["throw", "kaguneThrow", 908],
    ["launch", "kaguneLaunch", 899],
  ]) {
    await page.selectOption("#scenario", mode);
    await seek(page, 10);
    await expect(arena).toHaveAttribute("data-animation", "grabStartup");
    await seek(page, 22);
    await expect(arena).toHaveAttribute("data-capture", "grab");
    await seek(page, 36);
    await expect(arena).toHaveAttribute("data-animation", clip);
    await expect(arena).toHaveAttribute("data-capture-route", mode);
    await seek(page, 115);
    await expect(arena).toHaveAttribute("data-capture", "none");
    await expect(arena).toHaveAttribute("data-target-health", String(health));
    await page.locator("#mirror").setChecked(true);
    await seek(page, 115);
    await expect(arena).toHaveAttribute("data-target-health", String(health));
    await page.locator("#mirror").setChecked(false);
  }
  for (const stance of ["stand", "crouch", "air"])
    for (const strength of ["light", "medium", "heavy"]) {
      const move = stance + "_" + strength;
      await page.selectOption("#scenario", move);
      await seek(page, 4);
      await expect(arena).toHaveAttribute("data-animation", move);
      await seek(page, 20);
      await expect(arena).not.toHaveAttribute("data-target-health", "1000");
    }
  await page.selectOption("#scenario", "miss");
  await seek(page, 24);
  await expect(arena).toHaveAttribute("data-animation", "grabMiss");
  await expect(arena).toHaveAttribute("data-target-health", "1000");
});

test("Kaneki can grab and choose from the real Training menu using the keyboard", async ({
  page,
}) => {
  test.setTimeout(65000);
  await page.goto("./");
  await page.click("#training");
  await page.check('input[name="character"][value="kaneki"]');
  await page.click("#confirm-character");
  await page.check('input[name="opponent"][value="goku"]');
  await page.click("#confirm-character");
  await page.click("#fight");
  const arena = page.locator("canvas");
  await expect(arena).toHaveAttribute("data-character", "kaneki", {
    timeout: 30000,
  });
  await page.keyboard.down("d");
  await expect
    .poll(() =>
      arena.evaluate((c) =>
        Math.abs(Number(c.dataset.playerX) - Number(c.dataset.targetX)),
      ),
    )
    .toBeLessThan(120);
  await page.keyboard.up("d");
  await page.keyboard.press("u");
  await expect(arena).toHaveAttribute("data-capture", "grab");
  await page.keyboard.press("j");
  await expect(arena).toHaveAttribute("data-capture-route", "pull");
  await expect(arena).toHaveAttribute("data-capture", "none");
});


test("Four Swords plays one original snap at the pressure cel", async ({ page }) => {
  test.setTimeout(65000);
  await page.addInitScript(() => {
    window.snapSources = [];
    const connect = AudioBufferSourceNode.prototype.connect;
    const start = AudioBufferSourceNode.prototype.start;
    const snaps = new WeakSet();
    AudioBufferSourceNode.prototype.connect = function (destination, ...args) {
      if (destination instanceof BiquadFilterNode && destination.type === "bandpass" &&
          destination.frequency.value === 2700) snaps.add(this);
      return connect.call(this, destination, ...args);
    };
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (snaps.has(this) && this.context.state === "running" && this.buffer?.getChannelData(0).some(x => x !== 0)) {
        const tick = Number(document.querySelector("#arena").dataset.elapsed) + 1;
        window.snapSources.push(tick);
      }
      return start.apply(this, args);
    };
  });
  await page.goto("art/kaneki-combat.html");
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true", { timeout: 30000 });
  await page.click("#audio");
  await expect(page.locator("#audio")).toHaveText("Som ativo");
  await page.selectOption("#scenario", "fourSwords_medium");
  const poses = await page.evaluate(() => {
    const canvas = document.querySelector("#arena");
    const next = document.querySelector("#step");
    const first = {};
    for (let i = 0; i < 140; i++) {
      next.click();
      if (canvas.dataset.knucklePose !== "") first[canvas.dataset.knucklePose] ??= Number(canvas.dataset.elapsed);
    }
    return first;
  });
  expect(poses[0]).toBeLessThan(poses[1]);
  expect(poses[1]).toBeLessThan(poses[2]);
  expect(await page.evaluate(() => window.snapSources)).toEqual([poses[1]]);
  await expect(arena).toHaveAttribute("data-capture", "none");
  await expect(arena).toHaveAttribute("data-target-health", "900");
  await seek(page, poses[1]);
  await expect(arena).toHaveAttribute("data-knuckle-pose", "1");
  await expect(arena).toHaveAttribute("data-animation", "swordsSnap");
  await expect(arena).toHaveAttribute("data-camera-zoom", "1");
});


test("Kaneki renders all six authored finishers and both complete aerial drops", async ({ page }) => {
  test.setTimeout(85000);
  await page.goto("art/kaneki-combat.html");
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true", { timeout: 35000 });
  for (const finish of ["embrace","pendulum","centipede","lasso","spin","meteor"]) {
    await page.selectOption("#scenario", finish);
    const result = await arena.evaluate(canvas => {
      const next = document.querySelector("#step");
      let phases = new Set(), clips = new Set(), altitude = 0, maxZoom = 1;
      for (let i = 0; i < 162; i++) {
        next.click();
        phases.add(canvas.dataset.chainPhase);
        if (canvas.dataset.chainFinish) clips.add(canvas.dataset.animation);
        altitude = Math.max(altitude, +canvas.dataset.chainHeight);
        maxZoom = Math.max(maxZoom, +canvas.dataset.cameraZoom);
      }
      return { phases:[...phases], clips:[...clips], altitude, maxZoom,
        zoom: canvas.dataset.cameraZoom, capture:canvas.dataset.capture };
    });
    expect(result.phases).toEqual(expect.arrayContaining(["choice1","action","choice2","finisher"]));
    expect(result.clips).toContain("chain_"+finish);
    expect(result.capture).toBe("none");
    expect(result.zoom).toBe("1");
    expect(result.maxZoom).toBeGreaterThan(1);
    if (finish === "centipede" || finish === "meteor") expect(result.altitude).toBeGreaterThan(250);
  }
});

test("standard USB Gamepad API can choose two separate A presses with correct HUD labels", async ({ page }) => {
  test.setTimeout(65000);
  await page.addInitScript(() => {
    const state = Array(17).fill(false);
    window.padButtons = state;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => [{
        index:0, connected:true, mapping:"standard", id:"Xbox Controller", axes:[0,0,0,0],
        buttons: state.map(pressed => ({ pressed, touched:pressed, value:Number(pressed) }))
      }]
    });
  });
  await page.goto("art/kaneki-combat.html");
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded","true",{timeout:35000});
  await page.selectOption("#scenario","free");
  await arena.focus();
  await page.keyboard.down("d");
  await expect.poll(() => arena.evaluate(c => Math.abs(Number(c.dataset.playerX)-Number(c.dataset.targetX)))).toBeLessThan(120);
  await page.keyboard.up("d");
  await page.evaluate(() => { window.padButtons[5] = true; });
  await expect(arena).toHaveAttribute("data-capture","grab");
  await page.evaluate(() => { window.padButtons[5] = false; window.padButtons[0] = true; });
  await expect(arena).toHaveAttribute("data-chain-keys","A/X/Y");
  await expect(arena).toHaveAttribute("data-chain-phase","choice2");
  // A release by itself must leave the second window open.
  await page.evaluate(() => { window.padButtons[0] = false; });
  await page.waitForTimeout(115);
  await expect(arena).toHaveAttribute("data-chain-phase","choice2");
  await page.evaluate(() => { window.padButtons[0] = true; });
  await expect(arena).toHaveAttribute("data-chain-finish","embrace");
  await expect(arena).toHaveAttribute("data-capture","none");
});


test("Kaneki renders distinct special chain finishers and the long-grip countdown", async ({ page }) => {
  test.setTimeout(65000);
  await page.goto("art/kaneki-combat.html");
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true", { timeout: 35000 });
  for (const finish of ["centipedeDrop","redCatapult","centipedeMeteor","swordsRise","rushCrossover","rushSlam"]) {
    await page.selectOption("#scenario",finish);
    const result = await arena.evaluate((c, route) => {
      const next = document.querySelector("#step");
      let frame = null;
      for (let i=0;i<165;i++) {
        next.click();
        if (c.dataset.chainFinish === route) {
          frame = { clip:c.dataset.animation, origin:c.dataset.chainOrigin };
          break;
        }
      }
      return frame;
    }, finish);
    expect(result?.clip).toBe("chain_"+finish);
  }
  await page.selectOption("#scenario","stage5Timeout");
  await seek(page,200);
  await expect(arena).toHaveAttribute("data-chain-origin","kaguneGrab");
  const previous = Number(await arena.getAttribute("data-chain-remaining"));
  await seek(page,290);
  expect(Number(await arena.getAttribute("data-chain-remaining"))).toBe(previous-90);
  await seek(page,360);
  await expect(arena).toHaveAttribute("data-capture","none");
  await page.selectOption("#scenario","stage5Escape");
  await seek(page,88);
  await expect(arena).toHaveAttribute("data-capture","none");
  await expect(arena).toHaveAttribute("data-target-health","1000");
});

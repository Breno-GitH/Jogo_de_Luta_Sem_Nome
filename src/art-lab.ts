import { Animator } from "./render/animator";
import { FighterPresentation } from "./render/presentation";
import { Match, FLOOR } from "./engine/combat";
import { neutral } from "./engine/types";
import type { InputFrame } from "./engine/types";
import type { Move } from "./engine/types";
import { drawCombatDebug } from "./render/debug";
import { drawEffects } from "./render/effects";
import { Renderer } from "./render/renderer";

interface LabClip {
  label: string;
  sheet: string;
  player2Sheet: string;
  count: number;
  durations: number[];
  loop: boolean;
  grounded: boolean;
  bounds: number[][];
  combat?: Move;
  hurtboxes?: import("./engine/types").Rect[][];
}
interface Manifest {
  pivot: { x: number; y: number };
  clips: Record<string, LabClip>;
}
const element = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const select = (id: string) => element<HTMLSelectElement>(id);
const checked = (id: string) => element<HTMLInputElement>(id).checked;
const canvas = element<HTMLCanvasElement>("preview");
const context = canvas.getContext("2d")!;
const base = new URL("../sprites/samurai/", location.href);

async function startLab() {
  const arenaRenderer = new Renderer(
    canvas,
    new URL("../sprites/", location.href).href,
  );
  const response = await fetch(new URL("movement.json", base));
  if (!response.ok)
    throw new Error("Não foi possível carregar os metadados das animações.");
  const manifest: Manifest = await response.json();
  const attacksResponse = await fetch(new URL("attacks.json", base));
  if (!attacksResponse.ok)
    throw new Error("Não foi possível carregar os ataques.");
  const attacks: Manifest = await attacksResponse.json();
  const completeResponse = await fetch(new URL("complete.json", base));
  if (!completeResponse.ok)
    throw new Error("Não foi possível carregar as novas ações.");
  const complete: Manifest = await completeResponse.json();
  manifest.clips = { ...manifest.clips, ...attacks.clips, ...complete.clips };
  const fxImage = new Image();
  await new Promise<void>((resolve, reject) => {
    fxImage.onload = () => resolve();
    fxImage.onerror = () => reject(new Error("Erro ao carregar efeitos."));
    fxImage.src = new URL("../fx/samurai-fx.png", base).href;
  });
  const sheets = new Map<string, HTMLImageElement>();
  await Promise.all(
    Object.values(manifest.clips)
      .flatMap((clip) => [clip.sheet, clip.player2Sheet])
      .map(async (file) => {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(`Erro ao carregar ${file}`));
          image.src = new URL(file, base).href;
        });
        sheets.set(file, image);
      }),
  );
  for (const [key, clip] of Object.entries(manifest.clips)) {
    const option = new Option(
      `${clip.label} · ${clip.count} quadro${clip.count === 1 ? "" : "s"}`,
      key,
    );
    select("animation").add(option);
  }
  let name = "idle",
    animator = new Animator(),
    playing = true;
  type Scenario =
    | "jump"
    | "crouch"
    | "locomotion"
    | "attack"
    | "groundCombo"
    | "airCombo"
    | "draw_light"
    | "draw_medium"
    | "draw_heavy"
    | "crescent_light"
    | "crescent_medium"
    | "crescent_heavy"
    | "counterHit"
    | "counterMiss"
    | "counterLow"
    | "counterGrab"
    | "ultimateHit"
    | "ultimateBlock"
    | "ultimateMiss"
    | "grab"
    | "entrance"
    | "taunt"
    | "victory"
    | "defeat"
    | "guardStand"
    | "guardCrouch";
  let scenario: Scenario | null = null;
  let match = new Match(),
    presentation = new FighterPresentation(),
    scenarioTick = 0;
  let enemyPresentation = new FighterPresentation(),
    maxCombo = 0,
    selectedAttack = "stand_light";
  let dispatched = new Set<string>();
  let visited = new Set<string>(),
    captureSeen = false;
  let elapsed = 0,
    previous = performance.now();
  let thumbnails: HTMLButtonElement[] = [];

  function rebuildThumbnails() {
    element("strip").replaceChildren();
    thumbnails = [];
    const clip = manifest.clips[name];
    element<HTMLInputElement>("frame").max = String(clip.count - 1);
    for (let i = 0; i < clip.count; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Quadro ${i + 1}`);
      const tile = document.createElement("canvas");
      tile.width = 256;
      tile.height = 256;
      const c = tile.getContext("2d")!;
      c.imageSmoothingEnabled = false;
      c.drawImage(
        sheets.get(clip.sheet)!,
        i * 256,
        0,
        256,
        256,
        0,
        0,
        256,
        256,
      );
      button.append(tile);
      button.onclick = () => seek(i);
      element("strip").append(button);
      thumbnails.push(button);
    }
  }
  function choose(next: string) {
    name = next;
    animator = new Animator();
    animator.update(name);
    scenario = null;
    scenarioTick = 0;
    visited.clear();
    captureSeen = false;
    maxCombo = 0;
    elapsed = 0;
    playing = true;
    element<HTMLInputElement>("mirror").disabled = false;
    if (manifest.clips[name].combat) selectedAttack = name;
    select("animation").value = name;
    rebuildThumbnails();
    draw();
  }
  function seek(index: number) {
    if (scenario) {
      scenario = null;
      animator = new Animator();
      animator.update(name);
      element<HTMLInputElement>("mirror").disabled = false;
    }
    playing = false;
    animator.seekFrame(index);
    elapsed = 0;
    draw();
  }
  function beginScenario(next: Scenario) {
    arenaRenderer.resetAnimations();
    element<HTMLInputElement>("mirror").checked = false;
    element<HTMLInputElement>("mirror").disabled = true;
    match = new Match();
    match.phase = "fight";
    match.message = "";
    match.fighters[0].x = 300;
    match.fighters[1].x = 1180;
    match.fighters[1].facing = -1;
    presentation = new FighterPresentation();
    enemyPresentation = new FighterPresentation();
    maxCombo = 0;
    visited = new Set();
    captureSeen = false;
    dispatched = new Set();
    if (next === "attack" || next === "groundCombo" || next === "airCombo") {
      match.fighters[1].x = 400;
      if (next === "attack") {
        if (selectedAttack.startsWith("air_")) {
          for (const fighter of match.fighters) {
            fighter.y = FLOOR - 115;
            fighter.vy = -1;
          }
        }
        match.fighters[0].attack(selectedAttack);
        presentation.tick(match.fighters[0]);
        name = selectedAttack;
        select("animation").value = name;
        rebuildThumbnails();
      }
    }
    if (
      ![
        "jump",
        "crouch",
        "locomotion",
        "attack",
        "groundCombo",
        "airCombo",
      ].includes(next)
    )
      match.fighters[1].x = 400;
    const [player, enemy] = match.fighters;
    if (next === "attack" && selectedAttack === "throw") enemy.x = 365;
    if (next === "attack" && selectedAttack === "ultimate_start") {
      player.meter = 100;
      player.attack(selectedAttack);
    }
    if (next.startsWith("ultimate")) {
      player.meter = 100;
      enemy.x = next === "ultimateMiss" ? 900 : 430;
    }
    if (next.startsWith("draw_")) enemy.x = 470;
    if (next.startsWith("crescent_")) {
      enemy.x = 365;
      enemy.y = FLOOR - 95;
      enemy.vy = -2;
    }
    if (next.startsWith("counter")) enemy.x = 365;
    if (next === "grab") enemy.x = 365;
    if (
      next === "counterGrab" ||
      next === "guardStand" ||
      next === "guardCrouch"
    )
      player.data = { ...player.data, speed: 0 };
    if (next === "ultimateBlock") enemy.data = { ...enemy.data, speed: 0 };
    if (next === "entrance") {
      match = new Match();
      match.fighters[0].homeX = 300;
      match.fighters[1].homeX = 400;
    }
    if (next === "victory") enemy.health = 0;
    if (next === "defeat") player.health = 0;
    scenario = next;
    scenarioTick = 0;
    playing = true;
    elapsed = 0;
    draw();
  }
  function simulationInput(): InputFrame {
    const input = neutral();
    const player = match.fighters[0];
    const once = (key: string, buttons: InputFrame["pressed"]) => {
      if (!dispatched.has(key)) {
        input.pressed = buttons;
        dispatched.add(key);
      }
    };
    if (scenario === "groundCombo") {
      if (scenarioTick === 0) once("light", ["light"]);
      if (player.connected && player.moveId === "stand_light")
        once("medium", ["medium"]);
      if (player.connected && player.moveId === "stand_medium")
        once("heavy", ["heavy"]);
    }
    if (scenario === "airCombo") {
      if (scenarioTick === 0) {
        input.down = true;
        once("launcher", ["heavy"]);
      }
      if (player.connected && player.moveId === "crouch_heavy")
        once("jump", ["jump"]);
      if (player.airborne && player.state === "air")
        once("airLight", ["light"]);
      if (player.connected && player.moveId === "air_light")
        once("airMedium", ["medium"]);
      if (player.connected && player.moveId === "air_medium")
        once("airHeavy", ["heavy"]);
    }
    if (scenario === "jump" && scenarioTick === 0) input.pressed = ["jump"];
    if (
      scenario?.startsWith("draw_") ||
      scenario?.startsWith("crescent_") ||
      scenario?.startsWith("counter")
    ) {
      const pattern = scenario.startsWith("draw_")
        ? [2, 3, 6]
        : scenario.startsWith("crescent_")
          ? [6, 2, 3]
          : [2, 1, 4];
      if (scenarioTick < 6) {
        const dir = pattern[Math.floor(scenarioTick / 2)];
        input.direction =
          dir === 3 || dir === 6 ? 1 : dir === 1 || dir === 4 ? -1 : 0;
        input.down = [1, 2, 3].includes(dir);
        if (scenarioTick === 5)
          input.pressed = [
            scenario.endsWith("medium")
              ? "medium"
              : scenario.endsWith("heavy")
                ? "heavy"
                : "light",
          ];
      }
    }
    if (scenario?.startsWith("ultimate") && scenarioTick === 0)
      input.pressed = ["ultimate"];
    if (scenario === "grab" && scenarioTick === 0) input.pressed = ["throw"];
    if (scenario === "taunt" && scenarioTick === 0) input.pressed = ["taunt"];
    if (
      (scenario === "guardStand" || scenario === "guardCrouch") &&
      scenarioTick < 60
    ) {
      input.direction = -1;
      input.down = scenario === "guardCrouch";
    }
    if (scenario === "crouch") input.down = scenarioTick < 45;
    if (scenario === "locomotion") {
      if (scenarioTick < 30) input.direction = 1;
      else if (scenarioTick < 60) input.direction = -1;
      else if (scenarioTick < 73) {
        input.direction = 1;
        if (scenarioTick === 60) input.pressed = ["dash"];
      } else if (scenarioTick < 86) {
        input.direction = -1;
        if (scenarioTick === 73) input.pressed = ["dash"];
      }
    }
    return input;
  }
  function enemyInput(): InputFrame {
    const input = neutral();
    if (scenario === "ultimateBlock" && scenarioTick < 60) input.direction = 1;
    if (
      scenario === "counterHit" ||
      scenario === "counterLow" ||
      scenario === "counterGrab"
    ) {
      if (scenarioTick === 14) {
        input.down = scenario === "counterLow";
        input.pressed = [scenario === "counterGrab" ? "throw" : "light"];
      }
    }
    if (
      (scenario === "guardStand" || scenario === "guardCrouch") &&
      scenarioTick === 12
    ) {
      input.down = scenario === "guardCrouch";
      input.pressed = ["light"];
    }
    return input;
  }
  function tick() {
    if (scenario) {
      const frozen = match.hitstop > 0;
      match.step([simulationInput(), enemyInput()]);
      if (!frozen) {
        presentation.tick(match.fighters[0]);
        enemyPresentation.tick(match.fighters[1]);
        arenaRenderer.tick(match);
      }
      maxCombo = Math.max(maxCombo, match.fighters[1].combo);
      captureSeen ||= !!match.capture;
      visited.add(presentation.animator.clipName);
      visited.add(enemyPresentation.animator.clipName);
      scenarioTick++;
      const clip = presentation.animator.clipName;
      if (manifest.clips[clip] && clip !== name) {
        name = clip;
        select("animation").value = name;
        rebuildThumbnails();
      }
      if (
        (scenario === "jump" &&
          scenarioTick > 10 &&
          match.fighters[0].state === "idle") ||
        (scenario === "crouch" && scenarioTick > 58) ||
        (scenario === "locomotion" && scenarioTick > 92) ||
        (![
          "jump",
          "crouch",
          "locomotion",
          "entrance",
          "victory",
          "defeat",
        ].includes(scenario) &&
          scenarioTick > 100 &&
          match.fighters.every((f) => f.state === "idle") &&
          !match.capture) ||
        (scenario === "entrance" && match.phase === "fight") ||
        (["victory", "defeat"].includes(scenario) && scenarioTick > 120) ||
        scenarioTick > 300
      )
        playing = false;
    } else {
      animator.update(name);
      if (!manifest.clips[name].loop && animator.complete) playing = false;
    }
  }
  function draw() {
    const active = scenario ? presentation.animator : animator;
    const clip = manifest.clips[name];
    const frame = active.frame();
    const zoom = Number(select("zoom").value),
      size = 384;
    const inArena = checked("arena") && !!scenario;
    for (const id of ["zoom", "grid", "guides", "p2"])
      (element(id) as HTMLInputElement | HTMLSelectElement).disabled = inArena;
    const width = inArena ? 1280 : size * zoom,
      height = inArena ? 720 : size * zoom;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (inArena) {
      arenaRenderer.debug = checked("boxes");
      arenaRenderer.effects = checked("effects");
      arenaRenderer.draw(match);
    } else {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;
      context.save();
      context.scale(zoom, zoom);
      const rootX = 192,
        ground = 356,
        rootY = ground + (scenario ? match.fighters[0].y - FLOOR : 0);
      if (checked("guides")) {
        context.strokeStyle = "#688792";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, ground + 0.5);
        context.lineTo(size, ground + 0.5);
        context.stroke();
      }
      context.save();
      context.translate(rootX, Math.round(rootY));
      if (checked("mirror")) context.scale(-1, 1);
      const image = sheets.get(checked("p2") ? clip.player2Sheet : clip.sheet)!;
      context.drawImage(image, frame * 256, 0, 256, 256, -128, -224, 256, 256);
      if (checked("boxes")) {
        if (scenario) {
          const player = match.fighters[0];
          context.save();
          context.translate(-player.x, -player.y);
          // Undo the inspection mirror for world-coordinate boxes, then apply it
          // through the same root transform as the sprite.
          drawCombatDebug(
            context,
            player.hurtboxes(),
            player.attackShapes(),
            player.pushbox(),
          );
          context.restore();
        } else if (clip.combat?.poses) {
          const pose = clip.combat.poses?.[frame];
          if (pose)
            drawCombatDebug(
              context,
              pose.hurtboxes,
              pose.phase === "active" && pose.blade ? [pose.blade] : [],
              undefined,
              pose.blade,
            );
        } else if (clip.hurtboxes) {
          drawCombatDebug(context, clip.hurtboxes[frame], [], clip.combat?.box);
        }
      }
      if (checked("guides")) {
        context.strokeStyle = "#79dfc8";
        context.lineWidth = 1;
        context.strokeRect(-127.5, -223.5, 255, 255);
        context.beginPath();
        context.moveTo(-5, 0.5);
        context.lineTo(5, 0.5);
        context.moveTo(0.5, -5);
        context.lineTo(0.5, 5);
        context.stroke();
      }
      context.restore();
      const combatScenario =
        scenario && !["jump", "crouch", "locomotion"].includes(scenario);
      if (combatScenario) {
        const enemy = match.fighters[1],
          sprite = enemyPresentation.animator.sprite();
        const enemyImage = sheets.get(
          (checked("p2")
            ? sprite.sheet
            : (sprite.player2Sheet ?? sprite.sheet)
          ).replace("samurai/", ""),
        );
        if (enemyImage) {
          context.save();
          context.translate(
            rootX + enemy.x - match.fighters[0].x,
            Math.round(ground + enemy.y - FLOOR),
          );
          context.scale(enemy.facing, 1);
          context.drawImage(
            enemyImage,
            sprite.x,
            sprite.y,
            sprite.width,
            sprite.height,
            -sprite.pivot.x,
            -sprite.pivot.y,
            sprite.width,
            sprite.height,
          );
          context.restore();
        }
        if (checked("boxes")) {
          context.save();
          context.translate(rootX - match.fighters[0].x, ground - FLOOR);
          drawCombatDebug(
            context,
            enemy.hurtboxes(),
            enemy.attackShapes(),
            enemy.pushbox(),
          );
          context.restore();
        }
        if (checked("effects")) {
          context.save();
          context.translate(rootX - match.fighters[0].x, ground - FLOOR);
          drawEffects(context, match.events, fxImage);
          context.restore();
        }
        context.fillStyle = "#e7e5db";
        context.font = "10px monospace";
        context.fillText(
          `DANO ${1000 - enemy.health}   COMBO ${maxCombo}   HITSTOP ${match.hitstop}`,
          12,
          18,
        );
        context.fillText(
          `ALVO: ${enemy.knockedDown ? "KNOCKDOWN" : enemy.state}`,
          12,
          33,
        );
        context.fillText(
          `ENERGIA ${match.fighters[0].meter}  ${match.capture?.kind === "ultimate" ? "MIL CORTES" : ""}`,
          12,
          48,
        );
      }
      if (checked("grid") && zoom >= 3) {
        context.strokeStyle = "#d3d9ee25";
        context.lineWidth = 1 / zoom;
        for (let p = 0; p <= size; p++) {
          context.beginPath();
          context.moveTo(p, 0);
          context.lineTo(p, size);
          context.moveTo(0, p);
          context.lineTo(size, p);
          context.stroke();
        }
      }
      context.restore();
    }
    canvas.dataset.animation = name;
    canvas.dataset.frame = String(frame);
    canvas.dataset.rootY = String(scenario ? match.fighters[0].y : FLOOR);
    canvas.dataset.loaded = "true";
    canvas.dataset.playing = String(playing);
    canvas.dataset.maxCombo = String(maxCombo);
    canvas.dataset.targetHealth = String(match.fighters[1].health);
    canvas.dataset.targetKnockdown = String(match.fighters[1].knockedDown);
    canvas.dataset.hitstop = String(match.hitstop);
    canvas.dataset.meter = String(match.fighters[0].meter);
    canvas.dataset.playerHealth = String(match.fighters[0].health);
    canvas.dataset.capture = match.capture?.kind ?? "none";
    canvas.dataset.captureSeen = String(captureSeen);
    canvas.dataset.visited = JSON.stringify([...visited]);
    canvas.dataset.playerState = match.fighters[0].state;
    canvas.dataset.targetState = match.fighters[1].state;
    canvas.dataset.matchPhase = match.phase;
    canvas.dataset.phase = scenario
      ? (match.fighters[0].attackPhase ?? "none")
      : (clip.combat?.poses?.[frame]?.phase ?? "none");
    element<HTMLInputElement>("frame").value = String(frame);
    element<HTMLOutputElement>("number").value = `${frame + 1} / ${clip.count}`;
    element("play").textContent = playing ? "Pausar" : "Reproduzir";
    element("scenario").textContent = scenario
      ? `Motor real: ${scenario} · ${match.fighters[0].state}`
      : "Inspeção de clip";
    const download = element<HTMLAnchorElement>("download");
    const file = checked("p2") ? clip.player2Sheet : clip.sheet;
    download.href = new URL(file, base).href;
    download.download = file;
    download.textContent = `Spritesheet desta animação (${checked("p2") ? "P2" : "P1"})`;
    element("info").textContent =
      `${clip.label.toUpperCase()} · QUADRO ${frame + 1}/${clip.count} · ${clip.durations[frame]} ticks · ${clip.loop ? "LOOP" : "REPRODUÇÃO ÚNICA"} · PIVÔ (128, 224)`;
    const combat = clip.combat;
    element<HTMLButtonElement>("test-attack").disabled = !combat;
    element("combat-info").textContent = combat
      ? `Dano ${combat.damage} · Startup ${combat.startup} · Ativos ${combat.active} · Recuperação ${combat.recovery} · Hitstun ${combat.stun} · Blockstun ${combat.blockstun} · Hitstop ${combat.hitstop} · ${canvas.dataset.phase}`
      : "";
    thumbnails.forEach((button, i) => {
      button.classList.toggle("active", i === frame);
      button.setAttribute("aria-pressed", String(i === frame));
    });
  }
  select("animation").onchange = () => choose(select("animation").value);
  element("play").onclick = () => {
    if (
      !playing &&
      !scenario &&
      animator.complete &&
      !manifest.clips[name].loop
    )
      animator.seekFrame(0);
    playing = !playing;
    elapsed = 0;
    draw();
  };
  element("next").onclick = () =>
    seek(
      ((scenario ? presentation.animator : animator).frame() + 1) %
        manifest.clips[name].count,
    );
  element("previous").onclick = () =>
    seek(
      ((scenario ? presentation.animator : animator).frame() +
        manifest.clips[name].count -
        1) %
        manifest.clips[name].count,
    );
  element<HTMLInputElement>("frame").oninput = () =>
    seek(Number(element<HTMLInputElement>("frame").value));
  element("jump").onclick = () => beginScenario("jump");
  element("crouch").onclick = () => beginScenario("crouch");
  element("locomotion").onclick = () => beginScenario("locomotion");
  element("test-attack").onclick = () => beginScenario("attack");
  element("ground-combo").onclick = () => beginScenario("groundCombo");
  element("air-combo").onclick = () => beginScenario("airCombo");
  element("test-sequence").onclick = () =>
    beginScenario(select("sequence").value as Scenario);
  for (const id of [
    "zoom",
    "guides",
    "grid",
    "p2",
    "mirror",
    "boxes",
    "effects",
    "arena",
  ])
    element(id).onchange = draw;
  select("background").onchange = () => {
    const value = select("background").value;
    element("viewer").classList.toggle("checker", value === "checker");
    element("viewer").style.backgroundColor = value === "checker" ? "" : value;
  };
  function animate(now: number) {
    elapsed += Math.min(100, now - previous) * Number(select("speed").value);
    previous = now;
    while (elapsed >= 1000 / 60) {
      elapsed -= 1000 / 60;
      if (playing && !document.hidden) tick();
    }
    draw();
    requestAnimationFrame(animate);
  }
  choose("idle");
  requestAnimationFrame(animate);
}
startLab().catch((error: Error) => {
  element("error").textContent = error.message;
  element("info").textContent = "Prévia indisponível";
});

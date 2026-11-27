import { hazardRadius, type ArenaState } from "../engine/arenas";
import { FLOOR, type Match } from "../engine/combat";

const px = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
const wave = (t: number, period: number, size: number) => Math.round(Math.sin(t / period) * size);

/** Tiny hand-coded pixel actors: alternate limbs, look, recoil, flee and celebrate. */
type CrowdRole = "kendo" | "spectator" | "civilian" | "marine" | "passerby" | "alien" | "pirate" | "mage";
type NpcState = "idle" | "walking" | "watching" | "cheering" | "surprised" | "afraid" | "fleeing" | "returning" | "victory" | "defeat";
function npcState(a: ArenaState, index: number, role: CrowdRole): NpcState {
  const age = a.reactionUntil - a.tick;
  if (a.reactionKind === "ko" && age > 0) return index % 3 ? "victory" : "defeat";
  if (age > 35) return a.reactionKind === "super" ? "afraid" : "surprised";
  if (age > 15) return role === "civilian" || role === "passerby" || role === "marine" ? "fleeing" : "cheering";
  if (age > 0) return "returning";
  return Math.floor((a.tick + index * 53) / 130) % 4 === 0 ? "walking" : index % 3 ? "watching" : "idle";
}
function person(c: CanvasRenderingContext2D, x: number, y: number, t: number, mood: NpcState, coat: string, skin: string, role: CrowdRole) {
  const step = Math.floor(t / 12) % 4;
  const startled = mood === "surprised" || mood === "afraid";
  const recoil = startled ? (step % 2 ? -3 : 3) : mood === "cheering" || mood === "victory" ? -step % 2 * 2 : 0;
  const flee = mood === "fleeing" ? (x < 640 ? -13 : 13) : mood === "returning" ? (x < 640 ? -5 : 5) :
    mood === "walking" ? wave(t + x, 35, 4) : 0;
  x = Math.round(x + flee); y += recoil;
  px(c, "#151721", x - 5, y + 19, 11, 2);
  px(c, coat, x - 3, y + 7, 7, role === "mage" ? 12 : 9);
  px(c, skin, x - 2, y + 1, 5, 6);
  px(c, role === "marine" ? "#f1e6d3" : role === "mage" ? coat : role === "alien" ? "#6155a5" : "#282632", x - 3, y, 7, role === "marine" ? 3 : 2);
  if (role === "alien") { px(c, skin, x - 4, y - 3, 2, 4); px(c, skin, x + 3, y - 3, 2, 4); }
  if (role === "mage") { px(c, coat, x - 2, y - 3, 5, 4); px(c, "#c9ac6a", x - 1, y + 10, 3, 2); }
  if (role === "marine") { px(c, "#2273ad", x - 2, y + 7, 5, 2); px(c, "#f1e6d3", x - 5, y + 6, 11, 2); }
  if (role === "pirate") px(c, "#a93d39", x - 4, y + 7, 9, 2);
  if (role === "kendo") { px(c, "#f1e9d0", x - 4, y + 7, 9, 6); px(c, "#293c60", x - 5, y + 13, 11, 5); }
  if (role === "passerby") { px(c, "#51415f", x - 10, y - 5, 21, 2); px(c, "#51415f", x - 1, y - 4, 2, 20); }
  px(c, "#11121a", x + (startled ? -2 : 1), y + 4, 1, 1);
  const arm = startled || mood === "cheering" || mood === "victory" ? -3 : step % 2 ? 1 : 0;
  px(c, skin, x - 5, y + 9 + arm, 2, 6);
  px(c, skin, x + 5, y + 9 - arm, 2, 6);
  px(c, role === "kendo" ? "#293c60" : "#24232a", x - 3 + (step === 1 ? -1 : 0), y + 16, 2, 4);
  px(c, role === "kendo" ? "#293c60" : "#24232a", x + 2 + (step === 3 ? 1 : 0), y + 16, 2, 4);
}
function spectators(c: CanvasRenderingContext2D, a: ArenaState, spots: number[], color: string, role: CrowdRole) {
  spots.forEach((x, i) => person(c, x, 447 + (i % 3) * 4, a.tick + i * 17, npcState(a, i, role), i % 2 ? color : "#52616a", role === "alien" ? ["#9bc75e", "#c9a3eb", "#9ca8dc"][i % 3] : "#c99d79", role));
}

/** Undertown residents are drawn from distinct Omniverse silhouettes, not the shared crowd actor. */
function undertownResidents(c: CanvasRenderingContext2D, a: ArenaState) {
  const t = a.tick;
  const recoil = t < a.reactionUntil ? Math.round((a.reactionUntil - t) / 12) : 0;
  const bob = (offset: number) => Math.floor((t + offset) / 18) % 2;

  // Pakmar: small, broad green shopkeeper; lateral eyes, cheek warts, work apron.
  let x = 126 - recoil * 2, y = 439 + bob(0);
  px(c, "#242438", x - 13, y + 30, 28, 3);
  px(c, "#684663", x - 10, y + 16, 21, 14);
  px(c, "#d4a760", x - 7, y + 20, 15, 8);
  px(c, "#668b47", x - 12, y + 3, 25, 16);
  px(c, "#83aa60", x - 10, y + 1, 19, 12);
  px(c, "#b9d775", x - 14, y + 9, 6, 7);
  px(c, "#b9d775", x + 9, y + 9, 6, 7);
  px(c, "#f6e9b7", x - 14, y + 7, 5, 5);
  px(c, "#f6e9b7", x + 10, y + 7, 5, 5);
  px(c, "#202439", x - 12, y + 9, 2, 3);
  px(c, "#202439", x + 11, y + 9, 2, 3);
  px(c, "#427249", x - 4, y + 16, 10, 2);
  px(c, "#a5bd6d", x - 6, y + 4, 3, 2);
  px(c, "#a5bd6d", x + 4, y + 3, 3, 2);
  px(c, "#668b47", x + 10, y + 18 - bob(2) * 2, 8, 4);

  // Argit's quills, narrow muzzle and tail identify a different Undertown resident.
  x = 1082 + recoil * 2; y = 443 + bob(8);
  px(c, "#4b3d44", x - 4, y + 28, 12, 4);
  px(c, "#61736e", x - 8, y + 15, 18, 14);
  for (let i = 0; i < 6; i++) px(c, i % 2 ? "#7c9286" : "#414a4a", x - 8 + i * 3, y + 3 - (i % 2) * 4, 3, 15);
  px(c, "#a0ad89", x - 2, y + 8, 14, 9);
  px(c, "#d6ae99", x + 10, y + 11, 5, 3);
  px(c, "#242531", x + 4, y + 10, 2, 2);
  px(c, "#c98f9a", x - 12, y + 22, 5, 3);

  // Two elongated, warm-toned Kraaho civilians; they remain outside the fight plane.
  for (const [index, start] of [350, 905].entries()) {
    x = start + (index ? -recoil * 3 : recoil * 3); y = 424 + bob(index * 9);
    px(c, "#271d34", x - 4, y + 39, 14, 3);
    px(c, "#9b473f", x - 3, y + 14, 9, 22);
    px(c, "#d78050", x - 5, y + 2, 11, 15);
    px(c, "#efae62", x - 2, y, 5, 4);
    px(c, "#392636", x + 2, y + 8, 2, 2);
    px(c, "#d78050", x - 8 - bob(index), y + 16, 4, 17);
    px(c, "#d78050", x + 6 + bob(index), y + 16, 4, 17);
    px(c, "#6b3650", x - 3, y + 33, 3, 7);
    px(c, "#6b3650", x + 4, y + 33, 3, 7);
  }

  // Nosedeenian: small blue electrical body with irregular ear-like terminals.
  x = 797 + wave(t, 15, 5); y = 460 + wave(t, 9, 3);
  px(c, "#175767", x - 5, y + 14, 13, 3);
  px(c, "#2d8ca1", x - 6, y + 5, 15, 10);
  px(c, "#73d6cb", x - 4, y + 2, 10, 9);
  px(c, "#92f7d5", x - 7, y, 3, 6);
  px(c, "#92f7d5", x + 7, y - 2, 3, 7);
  px(c, "#203250", x - 2, y + 6, 2, 2);
  px(c, "#203250", x + 4, y + 6, 2, 2);
  if (t % 27 < 6) px(c, "#aafbf3", x - 10, y - 4, 3, 3);

  // A sponge-like child and a balloon-bodied child complete the mixed market scale.
  x = 544 + recoil; y = 454 + bob(11);
  px(c, "#adba6a", x - 6, y + 5, 14, 15);
  px(c, "#d3d978", x - 5, y + 2, 12, 12);
  px(c, "#668465", x - 2, y + 7, 2, 2);
  px(c, "#668465", x + 4, y + 8, 2, 2);
  x = 711 - recoil; y = 449 + bob(17);
  px(c, "#8666a9", x - 8, y + 4, 18, 17);
  px(c, "#ba8cc5", x - 6, y + 2, 14, 12);
  px(c, "#1d2443", x - 2, y + 8, 2, 2);
  px(c, "#1d2443", x + 4, y + 8, 2, 2);
  px(c, "#8666a9", x - 4, y + 20, 3, 5);
  px(c, "#8666a9", x + 5, y + 20, 3, 5);
}
function motes(c: CanvasRenderingContext2D, a: ArenaState, color: string, count: number, bandY: number, speed: number) {
  for (let i = 0; i < count; i++) {
    const x = ((i * 187 + a.tick * speed) % 1390 + 1390) % 1390 - 50;
    const y = bandY + (i * 73 % 115) + wave(a.tick + i * 29, 27, 4);
    px(c, color, x, y, i % 3 ? 3 : 5, i % 4 ? 2 : 3);
  }
}
function stageCracks(c: CanvasRenderingContext2D, a: ArenaState, color: string) {
  if (!a.integrity && a.phase === 0) return;
  const x = a.reactionX;
  c.strokeStyle = color; c.lineWidth = 2;
  for (let i = 0; i < Math.max(a.integrity, a.phase * 3); i++) {
    c.beginPath(); c.moveTo(x + i * 11 - 20, FLOOR + 8);
    c.lineTo(x + i * 11 - 31, FLOOR + 15);
    c.lineTo(x + i * 11 - 25, FLOOR + 23);
    c.stroke();
  }
}
function warning(c: CanvasRenderingContext2D, a: ArenaState) {
  const h = a.hazard;
  if (!h || h.phase === "cooldown") return;
  const radius = hazardRadius(a);
  const flash = h.phase === "active" || Math.floor(a.tick / 8) % 2 === 0;
  c.save();
  c.globalAlpha = flash ? 0.75 : 0.35;
  const isFloor = h.kind === "fall" || h.kind === "floor";
  const color = h.kind === "surge" ? a.id === "clover" ? "#d5a5ff" : "#65f9ee" :
    h.kind === "bombardment" ? "#ff8065" : "#f0bd59";
  px(c, color, h.x - radius, FLOOR + 3, radius * 2, 5);
  px(c, "#181822", h.x - radius + 5, FLOOR + 3, radius * 2 - 10, 2);
  for (const side of [-1, 1]) {
    const x = h.x + side * radius;
    px(c, "#fff2ba", x - 3, FLOOR - 17, 6, 15);
    px(c, "#201619", x - 1, FLOOR - 14, 2, 7);
  }
  c.globalAlpha = 1;
  c.font = "bold 12px monospace";
  c.textAlign = "center";
  c.fillStyle = color;
  c.fillText(h.kind === "fall" ? "CHÃO CEDENDO" : h.kind === "bombardment" ? "BUSTER CALL" :
    h.kind === "surge" ? "DESCARGA" : h.kind === "floor" ? "PISO INSTÁVEL" : "CUIDADO", h.x, FLOOR - 27);
  if (isFloor && (h.kind === "floor" || h.phase === "warning")) {
    const broken = h.phase === "active";
    px(c, broken ? "#141a25" : "#4b3b39", h.x - radius + 5, FLOOR + 7, radius * 2 - 10, broken ? 24 : 7);
    for (let i = 0; i < 8; i++) {
      const x = h.x - radius + 7 + i * (radius * 2 - 14) / 8;
      px(c, i % 2 ? "#8b7867" : "#bba389", x, FLOOR + (broken ? 16 + i % 3 * 7 : 9), 10, 3);
    }
  } else if (h.kind === "bombardment") {
    const progress = h.phase === "active" ? 1 : 1 - h.ticks / 100;
    const shellX = 1280 - (1280 - h.x) * progress;
    const shellY = 300 + (FLOOR - 300) * progress * progress;
    if (h.phase === "warning") {
      c.strokeStyle = "#ffad74"; c.lineWidth = 2; c.setLineDash([7, 9]);
      c.beginPath(); c.moveTo(1278, 300); c.quadraticCurveTo(h.x + 90, 260, h.x, FLOOR); c.stroke(); c.setLineDash([]);
      px(c, "#353a43", shellX - 8, shellY - 4, 17, 9);
    } else {
      c.fillStyle = "#ff9b5688"; c.beginPath(); c.arc(h.x, FLOOR - 16, 66, 0, Math.PI * 2); c.fill();
      px(c, "#ffdd91", h.x - 16, FLOOR - 59, 32, 53);
      for (let i = 0; i < 12; i++) px(c, i % 2 ? "#fbad61" : "#757c84", h.x + (i - 6) * 12, FLOOR - 8 - i % 4 * 11, 6, 5);
    }
  } else if (a.id === "cairo") {
    const tilt = h.phase === "active" ? 1.28 : Math.max(0, (70 - h.ticks) / 70) * .8;
    c.save(); c.translate(h.x - 38, FLOOR - 3); c.rotate(tilt);
    px(c, "#4c4b52", -4, -150, 8, 150); px(c, "#8d8172", -2, -148, 3, 145);
    px(c, "#d9af6b", -13, -151, 26, 8); px(c, "#fff1a4", -9, -146, 18, 6);
    c.restore();
    if (h.phase === "active") for (let i = 0; i < 7; i++) px(c, "#a3a4a8", h.x - 43 + i * 14, FLOOR + 8 + i % 3 * 4, 5, 3);
  } else if (a.id === "uchiha") {
    const progress = h.phase === "active" ? 1 : Math.max(0, (78 - h.ticks) / 78);
    px(c, "#514f4e", h.x - 60, 165, 120, 6);
    for (let i = 0; i < 3; i++) {
      const y = h.phase === "active" ? FLOOR - 13 : 178 + progress * progress * (330 + i * 22);
      px(c, i % 2 ? "#8e897b" : "#66635c", h.x - 38 + i * 28, y, 22, 13);
      px(c, "#b7ae98", h.x - 34 + i * 28, y - 3, 13, 4);
    }
  } else if (a.id === "anteiku") {
    const progress = h.phase === "active" ? 1 : Math.max(0, (70 - h.ticks) / 70);
    c.strokeStyle = "#cce2e8"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(h.x - 31, 330); c.lineTo(h.x, 390); c.lineTo(h.x + 29, 337); c.stroke();
    for (let i = 0; i < 11; i++) {
      const y = h.phase === "active" ? FLOOR + i % 3 * 4 : 387 + progress * progress * (150 + i % 3 * 13);
      px(c, i % 2 ? "#c8e6ed" : "#8fb5c4", h.x - 42 + i * 8, y, 4, 5);
    }
  } else if (a.id === "undertown") {
    const source = h.x < 640 ? 240 : 1010;
    c.strokeStyle = color; c.lineWidth = h.phase === "active" ? 5 : 2;
    c.beginPath(); c.moveTo(source, 317);
    c.lineTo((source + h.x) / 2 - 18, 380); c.lineTo((source + h.x) / 2 + 15, 440);
    c.lineTo(h.x, FLOOR - 15); c.stroke();
    if (h.phase === "active") for (let i = -3; i <= 3; i++) px(c, "#abfff0", h.x + i * 18, FLOOR - 12 - Math.abs(i) * 6, 5, 20);
  } else if (a.id === "clover") {
    const height = h.phase === "active" ? 73 : 25 + Math.round((70 - h.ticks) / 3);
    c.fillStyle = "#8251ae";
    c.beginPath(); c.moveTo(h.x - 24, FLOOR); c.lineTo(h.x, FLOOR - height); c.lineTo(h.x + 24, FLOOR); c.closePath(); c.fill();
    c.strokeStyle = color; c.lineWidth = 3; c.stroke();
    if (h.phase === "active") for (let i = -3; i <= 3; i++) px(c, "#e4c6ff", h.x + i * 18, FLOOR - height - 12 - i % 2 * 8, 5, 13);
  }
  c.restore();
}

function collapsedGround(c: CanvasRenderingContext2D, a: ArenaState, image?: HTMLImageElement) {
  if (!a.collapsed.length) return;
  const bridge = a.id === "enies";
  for (const x of a.collapsed) {
    const radius = hazardRadius(a);
    const left = Math.round(x - radius), width = radius * 2;
    const fill = c.createLinearGradient(0, FLOOR, 0, 800);
    fill.addColorStop(0, bridge ? "#145884" : "#242532");
    fill.addColorStop(1, bridge ? "#092b54" : "#101b26");
    c.fillStyle = fill; c.fillRect(left, FLOOR + 4, width, 300);
    for (let i = 0; i < 13; i++) {
      const xx = left + (i * 47 % width);
      const yy = FLOOR + 16 + (i * 31 % 120);
      px(c, bridge ? i % 2 ? "#91c8d3" : "#4488aa" : i % 2 ? "#756559" : "#4c5360", xx, yy, bridge ? 18 : 11, bridge ? 2 : 5);
    }
    px(c, bridge ? "#b4bec5" : "#8c7663", left - 8, FLOOR + 1, 13, 13);
    px(c, bridge ? "#b4bec5" : "#8c7663", left + width - 5, FLOOR + 1, 13, 13);
    const h = a.hazard;
    if (h?.kind === "fall" && h.phase === "active" && Math.abs(h.x - x) < 5) {
      const age = 28 - h.ticks;
      const drop = Math.min(270, Math.round(age * age * .72));
      if (image?.complete && image.naturalWidth) {
        c.save(); c.beginPath(); c.rect(left, FLOOR + 4 + drop, width, 145); c.clip();
        c.drawImage(image, left * image.naturalWidth / 1280, FLOOR * image.naturalHeight / 720,
          width * image.naturalWidth / 1280, 140 * image.naturalHeight / 720,
          left, FLOOR + drop, width, 140);
        c.restore();
      } else px(c, bridge ? "#a8b4bc" : "#88715e", left + 8, FLOOR + drop, width - 16, 24);
      for (let i = 0; i < 8; i++) px(c, bridge ? "#d1d0c3" : "#a79478", left + i * width / 8, FLOOR + drop + 15 + i % 3 * 11, 10, 5);
    }
  }
}

export function drawArenaLife(c: CanvasRenderingContext2D, a: ArenaState, match?: Match, image?: HTMLImageElement) {
  const t = a.tick, recent = t < a.reactionUntil;
  c.save(); c.imageSmoothingEnabled = false;
  switch (a.id) {
    case "dojo":
      spectators(c, a, [111, 145, 1145], "#e7e0c1", "kendo");
      motes(c, a, "#b96837", 12, 312, 0.6);
      if (recent) px(c, "#b08b5f", 150 + wave(t, 2, 2), 280, 4, 100);
      if (a.phase) px(c, "#171113", 199, 300, 5, 80);
      if (a.phase >= 2) for (let i = 0; i < 4; i++) px(c, "#9c7651", 205 + i * 11, 390 + i % 2 * 6, 9, 4);
      if (a.phase >= 4) { px(c, "#253b34", 205, 305, 61, 70); px(c, "#64482f", 205, 375, 61, 6); }
      break;
    case "budokai":
      spectators(c, a, [92, 129, 166, 1110, 1144, 1178], "#e6a742", "spectator");
      for (const x of [64, 1213]) px(c, "#d75843", x + wave(t, 12, 4), 132, 14, 7);
      if (recent) motes(c, a, "#d9c6a8", 8, 501, 0.9);
      if (a.mode === "caotico") for (const x of [68, 1212]) {
        px(c, "#422b23", x - 6, FLOOR - 15, 12, 31);
        px(c, "#fff1b3", x - 3, FLOOR - 13, 6, 27);
        px(c, "#c24631", x - 2, FLOOR - 1, 4, 8);
      }
      break;
    case "cairo":
      spectators(c, a, [160, 1120], "#b28c69", "civilian");
      motes(c, a, "#b8a182", 7, 402, 0.4);
      if (recent) px(c, "#ffd692", 914 + wave(t, 2, 2), 250, 8, 11);
      if (a.phase) {
        px(c, "#554238", 1024, 315, 4, 81);
        px(c, "#161928", 1030, 387, 51, 4);
        px(c, "#e7c27b", 1074 + wave(t, 5, 2), 383, 6, 5);
        for (let i = 0; i < 9; i++) px(c, "#9ca6bd", 1018 + i * 7 + wave(t + i, 9, 2), 393 + i % 3 * 5, 3, 2);
      }
      if (a.phase >= 3) { px(c, "#514944", 983, 395, 86, 7); px(c, "#e4a368", 981, 389, 7, 5); }
      break;
    case "enies":
      spectators(c, a, [154, 1129], "#f3f3f3", "marine");
      for (let i = 0; i < 8; i++) px(c, "#ecf8fa", 120 + i * 149 + wave(t + i * 17, 17, 8), 318 + i % 2 * 8, 23, 2);
      motes(c, a, "#d6dce2", 9, 220, 0.5);
      if (a.phase) for (let i = 0; i < 8; i++) px(c, "#4c5964", 580 + i * 16, FLOOR + 10 + i % 3 * 3, 10, 3);
      if (a.phase >= 2) for (let i = 0; i < a.phase * 2; i++) px(c, "#687783", 470 + i * 38, FLOOR + 17 + i % 3 * 5, 25, 4);
      break;
    case "uchiha":
      motes(c, a, "#8d8c80", 16, 210, 0.08);
      if (recent) motes(c, a, "#aaa596", 11, 370, 0.5);
      if (a.phase) motes(c, a, "#b8b3a3", 8, 440, 0.3);
      if (a.phase >= 2) for (let i = 0; i < a.phase * 3; i++) px(c, "#777068", 172 + i * 57, 441 + i % 3 * 12, 13, 5);
      if (match?.kirin) { c.fillStyle = "#a6bdff44"; c.fillRect(0, 0, 1280, 580); }
      break;
    case "anteiku":
      spectators(c, a, [91, 1172], "#6b6c7c", "passerby");
      for (let i = 0; i < 28; i++) {
        const x = (i * 137 + t * 3) % 1280;
        const y = (i * 73 + t * 7) % 570;
        px(c, "#a5b4c596", x, y, 2, 7);
      }
      if (a.phase) {
        c.strokeStyle = "#c8e0ed"; c.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          c.beginPath(); c.moveTo(535 + i * 28, 262); c.lineTo(547 + i * 28, 292 + i % 2 * 21); c.lineTo(533 + i * 28, 329); c.stroke();
          px(c, "#acc5d0", 535 + i * 32 + wave(t + i, 11, 3), 386 + i % 2 * 6, 4, 3);
        }
      }
      if (a.phase >= 3) for (let i = 0; i < 9; i++) px(c, "#b9c6c6", 482 + i * 24, FLOOR + 8 + i % 4 * 3, 8, 4);
      break;
    case "undertown":
      undertownResidents(c, a);
      for (const x of [240, 1010]) px(c, a.hazard?.phase === "warning" && Math.floor(t / 6) % 2 ? "#ffcc61" : "#69c982", x, 310, 6, 7);
      if (a.phase && Math.floor(t / 9) % 3 === 0) for (const x of [240, 1010]) px(c, "#1e1b31", x - 3, 307, 12, 13);
      if (a.phase >= 3) for (const x of [230, 997]) { px(c, "#332b43", x, 298, 27, 20); px(c, "#73eee0", x + 4, 309, 18, 3); }
      motes(c, a, "#b9c997", 8, 260, 0.35);
      break;
    case "godvalley":
      spectators(c, a, [155, 1070, 1110], "#4c6079", "pirate");
      motes(c, a, "#c7b99a", 17, 256, 0.8);
      for (let i = 0; i < 4; i++) px(c, "#6b7480", 92 + i * 318 + wave(t + i * 26, 31, 7), 185 + i % 2 * 17, 9, 5);
      if (a.phase) motes(c, a, "#7f6962", 11, 345, 1.2);
      if (a.phase >= 2) for (let i = 0; i < a.phase * 4; i++) px(c, "#5b5551", 265 + i * 37, FLOOR + 9 + i % 4 * 5, 15, 5);
      if (match?.pandemonium) { c.fillStyle = "#6a2a3440"; c.fillRect(0, 0, 1280, 580); }
      break;
    case "clover":
      spectators(c, a, [273, 329, 960, 1011], "#595e8d", "mage");
      for (const x of [185, 1097]) {
        c.globalAlpha = 0.3 + (Math.floor(t / 8) % 3) * 0.08;
        px(c, a.phase ? "#85858e" : x < 640 ? "#58d6fc" : "#d782ed", x, 110, 10, 22);
        c.globalAlpha = 1;
        if (a.phase) for (let i = 0; i < 5; i++) px(c, "#c4d8e5", x - 15 + i * 7, 137 + i % 2 * 8, 4, 3);
      }
      motes(c, a, "#c6d7e9", 7, 198, 0.15);
      if (match?.astaUnion) { c.fillStyle = "#22273366"; c.fillRect(0, 0, 1280, 580); }
      break;
  }
  if (recent) {
    const age = a.reactionUntil - t;
    for (let i = 0; i < 11; i++) {
      const x = a.reactionX + (i - 5) * (4 + (24 - Math.min(age, 24)));
      px(c, i % 2 ? "#dccfc1" : "#a09384", x, FLOOR - 4 - (i * 7 % 16), 4, 3);
    }
  }
  stageCracks(c, a, a.id === "enies" ? "#4c5964" : "#302c31");
  collapsedGround(c, a, image);
  warning(c, a);
  for (const fall of a.falling) if (fall) {
    const radius = fall.kind === "ringout" ? 28 : hazardRadius(a);
    px(c, "#151b25", fall.x - radius, FLOOR + 4, radius * 2, 18);
    for (let i = 0; i < 7; i++) px(c, "#8d8070", fall.x - radius + i * radius / 3, FLOOR + 17 + Math.min(60, fall.tick * 3) + i % 3 * 5, 9, 4);
  }
  c.restore();
}

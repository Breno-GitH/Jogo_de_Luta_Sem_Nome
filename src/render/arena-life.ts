import type { ArenaState } from "../engine/arenas";
import { FLOOR } from "../engine/combat";

const px = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
const wave = (t: number, period: number, size: number) => Math.round(Math.sin(t / period) * size);

/** Tiny hand-coded pixel actors: alternate limbs, look, recoil, flee and celebrate. */
type CrowdRole = "kendo" | "spectator" | "civilian" | "marine" | "passerby" | "alien" | "pirate" | "mage";
function person(c: CanvasRenderingContext2D, x: number, y: number, t: number, mood: number, coat: string, skin: string, role: CrowdRole) {
  const step = Math.floor(t / 12) % 4;
  const recoil = mood > 0 ? (mood % 2 ? -3 : 3) : 0;
  const flee = mood > 0 && mood < 35 ? (35 - mood) * (x < 640 ? -0.22 : 0.22) : 0;
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
  px(c, "#11121a", x + (mood > 0 ? -2 : 1), y + 4, 1, 1);
  const arm = mood > 0 ? -3 : step % 2 ? 1 : 0;
  px(c, skin, x - 5, y + 9 + arm, 2, 6);
  px(c, skin, x + 5, y + 9 - arm, 2, 6);
  px(c, role === "kendo" ? "#293c60" : "#24232a", x - 3 + (step === 1 ? -1 : 0), y + 16, 2, 4);
  px(c, role === "kendo" ? "#293c60" : "#24232a", x + 2 + (step === 3 ? 1 : 0), y + 16, 2, 4);
}
function spectators(c: CanvasRenderingContext2D, a: ArenaState, spots: number[], color: string, role: CrowdRole) {
  const mood = a.tick < a.reactionUntil ? a.reactionUntil - a.tick : 0;
  spots.forEach((x, i) => person(c, x, 447 + (i % 3) * 4, a.tick + i * 17, mood, i % 2 ? color : "#52616a", role === "alien" ? ["#9bc75e", "#c9a3eb", "#9ca8dc"][i % 3] : "#c99d79", role));
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
  const radius = h.kind === "fall" ? 65 : 78;
  const flash = h.phase === "active" || Math.floor(a.tick / 8) % 2 === 0;
  c.save();
  c.globalAlpha = flash ? 0.75 : 0.35;
  px(c, h.kind === "fall" ? "#f0bd59" : "#65f9ee", h.x - radius, FLOOR + 3, radius * 2, 5);
  px(c, "#181822", h.x - radius + 5, FLOOR + 3, radius * 2 - 10, 2);
  for (const side of [-1, 1]) {
    const x = h.x + side * radius;
    px(c, "#fff2ba", x - 3, FLOOR - 17, 6, 15);
    px(c, "#201619", x - 1, FLOOR - 14, 2, 7);
  }
  if (h.phase === "active") for (let i = 0; i < 9; i++) {
    const x = h.x - radius + i * radius / 4;
    px(c, h.kind === "fall" ? "#20181c" : "#abffeb", x, FLOOR - (i % 3) * 8 - 5, 4, 15 + (i % 3) * 8);
  }
  if (h.kind === "fall") {
    const drop = h.phase === "warning" ? Math.round((90 - h.ticks) * 2.8) : 265;
    const y = 160 + drop;
    px(c, "#302e35", h.x - 15, y, 31, 11);
    px(c, "#827b72", h.x - 11, y - 7, 23, 9);
    px(c, "#b5a99a", h.x - 7, y - 11, 13, 5);
    if (h.phase === "active") px(c, "#18212c", h.x - radius + 4, FLOOR + 4, radius * 2 - 8, 18);
  } else if (h.phase === "active") {
    for (let i = -2; i <= 2; i++) {
      const x = h.x + i * 24;
      px(c, "#273340", x, FLOOR - 43 - i % 2 * 8, 5, 28);
      px(c, "#87fff0", x + 1, FLOOR - 47 - i % 2 * 8, 3, 10);
    }
  }
  c.restore();
}

export function drawArenaLife(c: CanvasRenderingContext2D, a: ArenaState) {
  const t = a.tick, recent = t < a.reactionUntil;
  c.save(); c.imageSmoothingEnabled = false;
  switch (a.id) {
    case "dojo":
      spectators(c, a, [111, 145, 1145], "#e7e0c1", "kendo");
      motes(c, a, "#b96837", 12, 312, 0.6);
      if (recent) px(c, "#b08b5f", 150 + wave(t, 2, 2), 280, 4, 100);
      if (a.phase) px(c, "#171113", 199, 300, 5, 80);
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
      break;
    case "enies":
      spectators(c, a, [154, 1129], "#f3f3f3", "marine");
      for (let i = 0; i < 8; i++) px(c, "#ecf8fa", 120 + i * 149 + wave(t + i * 17, 17, 8), 318 + i % 2 * 8, 23, 2);
      motes(c, a, "#d6dce2", 9, 220, 0.5);
      if (a.phase) for (let i = 0; i < 8; i++) px(c, "#4c5964", 580 + i * 16, FLOOR + 10 + i % 3 * 3, 10, 3);
      break;
    case "uchiha":
      motes(c, a, "#8d8c80", 16, 210, 0.08);
      if (recent) motes(c, a, "#aaa596", 11, 370, 0.5);
      if (a.phase) motes(c, a, "#b8b3a3", 8, 440, 0.3);
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
      break;
    case "undertown":
      undertownResidents(c, a);
      for (const x of [240, 1010]) px(c, a.hazard?.phase === "warning" && Math.floor(t / 6) % 2 ? "#ffcc61" : "#69c982", x, 310, 6, 7);
      if (a.phase && Math.floor(t / 9) % 3 === 0) for (const x of [240, 1010]) px(c, "#1e1b31", x - 3, 307, 12, 13);
      motes(c, a, "#b9c997", 8, 260, 0.35);
      break;
    case "godvalley":
      spectators(c, a, [155, 1070, 1110], "#4c6079", "pirate");
      motes(c, a, "#c7b99a", 17, 256, 0.8);
      for (let i = 0; i < 4; i++) px(c, "#6b7480", 92 + i * 318 + wave(t + i * 26, 31, 7), 185 + i % 2 * 17, 9, 5);
      if (a.phase) motes(c, a, "#7f6962", 11, 345, 1.2);
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
  warning(c, a);
  c.restore();
}

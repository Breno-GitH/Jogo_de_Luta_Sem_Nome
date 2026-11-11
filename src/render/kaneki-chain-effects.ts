import type { Fighter, HitEvent } from "../engine/combat";
import { chainFinishes, type ChainRoute } from "../engine/kaneki-chain";

const impactColors: Partial<Record<ChainRoute, string>> = {
  embrace: "#ffb087",
  pendulum: "#ff786b",
  centipede: "#ffbe92",
  lasso: "#eed0fd",
  spin: "#e774ac",
  meteor: "#f88aae",
  release: "#e9b2ae",
  centipedeDrop: "#ffbc7a",
  centipedeMeteor: "#fa7fae",
  rushSlam: "#ffc7c2",
  redCatapult: "#fa9571",
  rinkakuCyclone: "#df8cdb",
};

export function drawChainEffects(
  c: CanvasRenderingContext2D,
  events: HitEvent[],
  actor?: Fighter,
  route?: ChainRoute,
  age = 0,
) {
  c.save();
  if (actor && route && chainFinishes[route].slam) {
    const impact = chainFinishes[route].hit;
    if (age >= impact - 15 && age < impact) {
      const x = Math.round(actor.x),
        y = Math.round(actor.y - 72);
      c.fillStyle = "#e59caa";
      for (let i = 0; i < 9; i++) {
        const shift = (i * 29 + age * 9) % 78;
        c.globalAlpha = 0.38 + (i % 3) * 0.15;
        c.fillRect(
          x - 59 + ((i * 49) % 114),
          y - 20 - shift,
          2,
          11 + (i % 4) * 5,
        );
      }
    }
  }
  for (const event of events) {
    if (
      event.kind !== "chainImpact" &&
      event.kind !== "chainBind" &&
      event.kind !== "chainEscape" &&
      event.kind !== "chainWhoosh"
    )
      continue;
    const t = (event.total ?? 15) - event.life;
    const x = Math.round(event.x),
      y = Math.round(event.y);
    c.globalAlpha = Math.min(1, event.life / 9);
    const slam = event.kind === "chainImpact" && event.strength === 3;
    const hue =
      event.kind === "chainEscape"
        ? "#b4f3ed"
        : event.chain
          ? (impactColors[event.chain] ?? "#f4b8a4")
          : "#f4b8a4";
    const wide = event.chain === "pendulum" || event.chain === "spin";
    const narrow = event.chain === "embrace";
    for (let i = 0; i < (slam ? 20 : 8); i++) {
      const side = i % 2 ? -1 : 1;
      const dx =
        side *
        Math.round(
          (8 + t * (2 + (i % 5)) + i * 2.5) * (wide ? 1.45 : narrow ? 0.55 : 1),
        );
      const lift = Math.round(
        (slam ? 20 : 8) + (t + 2) * (1 + (i % 4)) - t * t * 0.18,
      );
      c.fillStyle = i % 3 === 0 ? "#fff0df" : hue;
      const arc =
        event.chain === "spin"
          ? side * (i % 4) * 5
          : event.chain === "lasso"
            ? dx * 0.4
            : 0;
      c.fillRect(
        x + dx,
        Math.round(y - Math.max(-6, lift) + arc),
        slam || wide ? 5 + (i % 6) : 3 + (i % 4),
        2 + (i % 3),
      );
      if (slam) {
        c.fillStyle = "#ae969a";
        c.fillRect(
          x + dx * 2,
          y - Math.max(1, lift / 3),
          6 + (i % 7) + t,
          3 + (i % 4),
        );
      }
    }
    if (slam && t < 11) {
      const r = 17 + t * 10;
      c.fillStyle = hue;
      c.fillRect(x - r, y - 4, r * 2, 3);
      c.fillRect(x - r - 10, y - 8, 15, 2);
      c.fillRect(x + r - 3, y - 8, 15, 2);
    }
  }
  c.restore();
}

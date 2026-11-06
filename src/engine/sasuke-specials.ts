import balance from "../data/sasuke-specials.json";
import frames from "../data/sasuke-special-frames.json";
import type { CommandBuffer } from "./input";
import type { Button, Capsule, CombatPose, Move } from "./types";

export const sasukeSpecialBalance = balance;
export type SasukeSpecialId = keyof typeof balance.techniques;
type Shot = {
  at: number;
  speed: number;
  rise: number;
  radius: number;
  life: number;
};
type Technique = Omit<
  Move,
  "startup" | "active" | "recovery" | "box" | "rank" | "level" | "cancels"
> & {
  holds: number[];
  reach?: number;
  shots?: Shot[];
};
export const sasukeTechniques: Record<SasukeSpecialId, Technique> =
  balance.techniques;
export const sasukeSpecialIds = Object.keys(
  sasukeTechniques,
) as SasukeSpecialId[];
export function isSasukeSpecial(id: string): id is SasukeSpecialId {
  return Object.hasOwn(sasukeTechniques, id);
}

const commandMoves = {
  ki: { light: "senbon", medium: "eiso", heavy: "chidori" },
  kamehameha: { light: "gokakyu", medium: "hosenka", heavy: "goryuka" },
  teleport: { light: "serpents", medium: "nagashi", heavy: "curse" },
} as const;
export function sasukeSpecialCommand(buffer: CommandBuffer, button: Button) {
  if (button !== "light" && button !== "medium" && button !== "heavy") return;
  const cfg = balance.commands;
  const motion = buffer.gokuSpecial(
    button,
    cfg.motionTicks,
    cfg.finishTicks,
    cfg.doubleDownTicks,
    cfg.minimumDownGapTicks,
  );
  return motion && commandMoves[motion][button];
}

export const sasukeSpecialLabels: Record<SasukeSpecialId, string> = {
  senbon: "Chidori Senbon",
  eiso: "Chidori Eisō",
  chidori: "Chidori",
  gokakyu: "Katon: Gōkakyū",
  hosenka: "Katon: Hōsenka",
  goryuka: "Katon: Gōryūka",
  serpents: "Serpentes",
  nagashi: "Chidori Nagashi",
};

// The sprite packer measures anchors in the same pivot space as collision.
const bodyCels: Record<
  SasukeSpecialId,
  Array<Pick<CombatPose, "release" | "hurtboxes">>
> = frames;

export function sasukeSpecialContact(
  id: SasukeSpecialId,
  elapsed: number,
  facing: number,
  rootX: number,
): Capsule[] {
  const origin = bodyCels[id][2].release!;
  if (id === "eiso") {
    const tip = Math.min(
      origin.x +
        (sasukeTechniques.eiso.reach! - origin.x) *
          Math.min(1, (elapsed + 1) / 4),
      facing > 0 ? 1280 - rootX : rootX,
    );
    return [
      { a: origin, b: { x: Math.max(origin.x, tip), y: origin.y - 6 }, r: 10 },
    ];
  }
  if (id === "chidori")
    return [{ a: { x: origin.x - 15, y: origin.y + 3 }, b: origin, r: 19 }];
  if (id === "nagashi")
    return [
      { a: { x: -47, y: -53 }, b: { x: 52, y: -53 }, r: 20 },
      { a: { x: -26, y: -91 }, b: { x: 33, y: -91 }, r: 14 },
      { a: { x: -31, y: -21 }, b: { x: 37, y: -21 }, r: 16 },
    ];
  return [];
}

export function sasukeSpecialFrames(id: SasukeSpecialId) {
  const { holds } = sasukeTechniques[id];
  const first = sasukeSpecialIds.indexOf(id) * holds.length;
  return holds.map((_, i) => first + i);
}

export const sasukeSpecialMoves: Record<string, Move> = Object.fromEntries(
  sasukeSpecialIds.map((id) => {
    const {
      holds,
      shots: _shots,
      reach: _reach,
      ...stats
    } = sasukeTechniques[id];
    const [seal, gather, active, recovery] = holds;
    const poses: CombatPose[] = holds.map((ticks, index) => ({
      ticks,
      phase: index < 2 ? "startup" : index === 2 ? "active" : "recovery",
      ...bodyCels[id][index],
    }));
    return [
      id,
      {
        ...stats,
        special: id,
        startup: seal + gather,
        active,
        recovery,
        kind: "strike",
        rank: id === "senbon" || id === "hosenka" || id === "serpents" ? 1 : 2,
        level: "mid",
        box: { x: 0, y: 0, w: 0, h: 0 },
        cancels: [],
        poses,
      },
    ];
  }),
);

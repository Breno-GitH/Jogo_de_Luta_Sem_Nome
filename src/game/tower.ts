import profiles from "../data/bot-profiles.json";
import { characters, type CharacterId } from "../engine/characters";
import type { BotProfile, Difficulty } from "../engine/bot";

export const towerFloors = [
  { label: "Fácil", tier: "easy", skill: 0, palette: "cyan" },
  { label: "Fácil · reação", tier: "easy", skill: 0.1, palette: "cyan" },
  { label: "Normal", tier: "normal", skill: 0.22, palette: "cyan" },
  { label: "Normal · pressão", tier: "normal", skill: 0.33, palette: "amber" },
  {
    label: "Mini-chefe",
    tier: "normal",
    skill: 0.45,
    palette: "amber",
    boss: "mini",
  },
  { label: "Normal avançado", tier: "normal", skill: 0.53, palette: "amber" },
  { label: "Difícil", tier: "hard", skill: 0.64, palette: "violet" },
  { label: "Difícil · punição", tier: "hard", skill: 0.75, palette: "violet" },
  { label: "Muito difícil", tier: "hard", skill: 0.88, palette: "violet" },
  {
    label: "Chefe final",
    tier: "hard",
    skill: 1,
    palette: "violet",
    boss: "final",
  },
] as const satisfies readonly {
  label: string;
  tier: Difficulty;
  skill: number;
  palette: "cyan" | "amber" | "violet";
  boss?: "mini" | "final";
}[];

const levels = [
  profiles.easy,
  profiles.normal,
  {
    reaction: 6,
    decision: 4,
    jitter: 2,
    confirm: 1,
    guard: 0.93,
    punish: 0.98,
    combo: 0.995,
    airCombo: 0.97,
    special: 0.52,
    grab: 0.29,
    ultimate: 0.98,
    retreat: 0.3,
    jump: 0.16,
    range: 94,
  },
] satisfies BotProfile[];
export function towerProfile(index: number): BotProfile {
  const skill = towerFloors[index].skill;
  const upper = skill <= 0.45 ? 1 : 2;
  const fraction = upper === 1 ? skill / 0.45 : (skill - 0.45) / 0.55;
  const min = levels[upper - 1],
    max = levels[upper];
  const blend = (key: keyof BotProfile) =>
    min[key] + (max[key] - min[key]) * fraction;
  const profile = { ...min };
  for (const key of Object.keys(profile) as (keyof BotProfile)[])
    profile[key] = blend(key);
  for (const key of ["reaction", "decision", "jitter", "confirm"] as const)
    profile[key] = Math.round(profile[key]);
  return profile;
}

export type TowerAttempt = {
  schema: 1;
  fighter: CharacterId;
  route: CharacterId[];
  results: [number, number][];
  losses: number;
  ticks: number;
};
type TowerSave = { attempt: TowerAttempt | undefined; best: number };
const key = "sem-nome-arcade-tower-v1";
// Ben can be the Arcade player. Keep the established rival pool unchanged.
const playableIds: CharacterId[] = Object.keys(characters) as CharacterId[];
const ids: CharacterId[] = playableIds.filter(id => id !== "ben");
export const currentFloor = (attempt: TowerAttempt) =>
  Math.min(attempt.results.length, towerFloors.length - 1);
export const towerComplete = (attempt: TowerAttempt) =>
  attempt.results.length === towerFloors.length;
export function arcadeRoute(
  fighter: CharacterId,
  random = Math.random,
): CharacterId[] {
  const available = ids.filter((id) => id !== fighter);
  const route: CharacterId[] = [];
  while (route.length < towerFloors.length) {
    const group = available.slice();
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
    if (group[0] === route.at(-1)) [group[0], group[1]] = [group[1], group[0]];
    route.push(...group);
  }
  return route.slice(0, towerFloors.length);
}
export const newTower = (fighter: CharacterId): TowerAttempt => ({
  schema: 1,
  fighter,
  route: arcadeRoute(fighter),
  results: [],
  losses: 0,
  ticks: 0,
});

function validAttempt(value?: TowerAttempt): value is TowerAttempt {
  return (
    !!value &&
    value.schema === 1 &&
    playableIds.includes(value.fighter) &&
    Array.isArray(value.route) &&
    value.route.length === towerFloors.length &&
    value.route.every(
      (id, i) =>
        ids.includes(id) && id !== value.fighter && id !== value.route[i - 1],
    ) &&
    Array.isArray(value.results) &&
    value.results.length <= towerFloors.length &&
    value.results.every(
      (result) =>
        Array.isArray(result) &&
        result.length === 2 &&
        result[0] === 2 &&
        Number.isInteger(result[1]) &&
        result[1] >= 0 &&
        result[1] < 2,
    ) &&
    Number.isSafeInteger(value.losses) &&
    value.losses >= 0 &&
    Number.isSafeInteger(value.ticks) &&
    value.ticks >= 0
  );
}
export function readTower(): TowerSave {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "{}") as TowerSave;
    const attempt = validAttempt(saved.attempt) ? saved.attempt : undefined;
    const best = Number.isInteger(saved.best)
      ? Math.min(towerFloors.length, Math.max(0, saved.best))
      : 0;
    return { attempt, best: Math.max(best, attempt?.results.length ?? 0) };
  } catch {
    return { attempt: undefined, best: 0 };
  }
}
export function saveTower(attempt: TowerAttempt) {
  const best = Math.max(readTower().best, attempt.results.length);
  try {
    localStorage.setItem(key, JSON.stringify({ attempt, best }));
  } catch {
    // The current tower still plays when browser storage is disabled.
  }
}

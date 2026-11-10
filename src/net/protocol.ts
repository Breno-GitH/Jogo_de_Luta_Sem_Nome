import type { InputFrame } from "../engine/types";
import type { MatchState } from "../engine/state";
export const PROTOCOL = 3;
export const ONLINE_CHARACTERS = ["samurai", "dio", "goku", "luffy", "sasuke", "kaneki", "ben"] as const;
export type OnlineCharacter = (typeof ONLINE_CHARACTERS)[number];
export const INPUT_DELAY = 6;
export const MAX_AHEAD = 90;
export const CLIENT_LEAD_LIMIT = 24;
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export type Seat = 0 | 1;
export type RoomStatus =
  "lobby" | "playing" | "reconnecting" | "finished" | "closed";
export interface RoomPlayer {
  seat: Seat;
  connected: boolean;
  character: OnlineCharacter | null;
  confirmed: boolean;
  ready: boolean;
  rematch: boolean;
}
export interface RoomView {
  code: string;
  host: Seat;
  status: RoomStatus;
  players: (RoomPlayer | null)[];
  graceMs: number;
}
export interface Membership {
  room: RoomView;
  seat: Seat;
  token: string;
}
export interface StartPacket {
  matchId: string;
  tick: number;
  delay: number;
  version: string;
  state: MatchState;
  hash: string;
  reason: "start" | "rematch" | "resume" | "resync";
}
export interface StepPacket {
  matchId: string;
  tick: number;
  inputs: [InputFrame, InputFrame];
  hash: string;
  checkpoint?: MatchState;
}
export interface InputPacket {
  matchId: string;
  tick: number;
  input: InputFrame;
}
export interface EndPacket {
  matchId: string;
  tick: number;
  winner: Seat | null;
  score: [number, number];
  reason: "ko" | "time" | "disconnect" | "left" | "inputTimeout" | "desync";
}
export type Reply<T = undefined> =
  { ok: true; data: T } | { ok: false; code: string; message: string };
export function normalizeCode(code: unknown) {
  if (typeof code !== "string") return null;
  const result = code.trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{6}$/.test(result) ? result : null;
}
export function exactObject(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}
const buttons = new Set([
  "light",
  "medium",
  "heavy",
  "throw",
  "dash",
  "jump",
  "ultimate",
  "taunt",
]);
export function validInput(value: unknown): value is InputFrame {
  if (!value || typeof value !== "object") return false;
  const keys = ["direction", "down", "pressed"];
  const extended = "omnitrix" in value;
  const flying = "up" in value;
  if (extended) keys.push("omnitrix");
  if (flying) keys.push("up");
  if (!exactObject(value, keys) || (flying && typeof value.up !== "boolean")) return false;
  if (extended) {
    const control = value.omnitrix;
    if (!exactObject(control, ["held"]) || typeof control.held !== "boolean")
      return false;
  }
  return (
    [-1, 0, 1].includes(value.direction as number) &&
    typeof value.down === "boolean" &&
    Array.isArray(value.pressed) &&
    value.pressed.length <= 8 &&
    new Set(value.pressed).size === value.pressed.length &&
    value.pressed.every(
      (button) => typeof button === "string" && buttons.has(button),
    )
  );
}

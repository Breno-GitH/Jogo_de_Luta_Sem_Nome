import type { Fighter } from "./combat";
import type { Button } from "./types";
import { astaSwords, beginAstaDraw, type AstaSword } from "./asta-stances";
import { astaRelayMove } from "./asta-specials";
const clock = (f: Fighter) => f.match?.combatFrame ?? 0;
export const relayChoiceTicks = 16;
export const relayOptions = (initial: AstaSword) =>
  astaSwords.filter((x) => x !== initial) as [AstaSword, AstaSword, AstaSword];
function consumeChoices(f: Fighter) {
  for (const b of ["light", "medium", "heavy"] as Button[])
    while (f.buffer.consume(b)) {}
}
export function beginAstaRelay(f: Fighter) {
  const s = f.asta!,
    sword = s.equipped,
    m = astaRelayMove(sword);
  s.relay = {
    initial: sword,
    sword,
    options: relayOptions(sword),
    phase: "opening",
    action: 0,
    cast: s.cast,
    started: clock(f),
    deadline: clock(f) + 120,
    confirmed: false,
    windowFrom: m.startup + m.active,
    windowTo: m.startup + m.active + relayChoiceTicks,
    minSerial: f.buffer.snapshot().serial,
    contacts: [],
    lastContact: -1,
    projectileFired: false,
  };
}
/** Only ordinary, unblocked, damaging contacts confirm an opening. */
export function confirmAstaRelay(f: Fighter, projectile = false) {
  const r = f.asta?.relay;
  if (!r || f.moveId !== "astaDualBreak") return;
  // A residual projected slash may still hit after interruption. It is never
  // an opening contact for a newer Relay and cannot unlock its sword choice.
  if (
    projectile &&
    (r.phase !== "branch" || r.sword !== "dweller" || !r.projectileFired)
  )
    return;
  const key = r.action + ":" + (projectile ? "wave" : (f.hitWindow?.id ?? 0));
  if (!r.contacts.includes(key)) r.contacts.push(key);
  if (!r.confirmed && r.phase === "opening") {
    r.minSerial = f.buffer.snapshot().serial;
    consumeChoices(f);
  }
  r.confirmed = true;
  r.lastContact = clock(f);
}
function choose(f: Fighter, button: "light" | "medium" | "heavy") {
  const s = f.asta!,
    r = s.relay!,
    sword = r.options[["light", "medium", "heavy"].indexOf(button)];
  r.button = button;
  r.sword = sword;
  r.phase = "branch";
  r.action = 1;
  r.confirmed = false;
  r.minSerial = f.buffer.snapshot().serial;
  f.stateFrame = 0;
  f.connected = f.hitConfirmed = false;
  f.hitIds = [];
  f.vx = 0;
  s.attackSword = s.equipped;
  s.pending = { sword, at: 3, move: "astaDualBreak" };
  beginAstaDraw(f, sword, 3);
  consumeChoices(f);
}
/** One J/K/L choice, independent of direction. The selected mini-combo owns all subsequent input until recovery. */
export function stepAstaRelay(f: Fighter) {
  const s = f.asta,
    r = s?.relay;
  if (!s || !r) return;
  if (f.state !== "attack" || f.moveId !== "astaDualBreak") {
    delete s.relay;
    return;
  }
  if (!f.opponent || f.opponent.health <= 0 || clock(f) >= r.deadline) {
    consumeChoices(f);
    f.setState("idle");
    f.vx = 0;
    return;
  }
  if (r.phase === "branch") {
    consumeChoices(f);
    return;
  }
  if (r.confirmed && f.stateFrame >= r.windowFrom) r.phase = "choice";
  if (r.phase === "choice" && f.stateFrame <= r.windowTo) {
    const edge = f.buffer.actions.find(
      (a) =>
        (a.serial ?? 0) > r.minSerial &&
        ["light", "medium", "heavy"].includes(a.button),
    );
    if (edge) {
      choose(f, edge.button as "light" | "medium" | "heavy");
      return;
    }
  }
  // Timeout recovers the opening without an automatic finisher or sword selection.
  if (f.stateFrame >= r.windowTo || !r.confirmed) consumeChoices(f);
}

import type { Fighter } from "./combat";
import type { Button } from "./types";
import type { AstaSword, AstaRelayState } from "./asta-stances";
import { astaRelayMove } from "./asta-specials";
const clock = (f: Fighter) => f.match?.frame ?? 0;
function consumeChoices(f: Fighter) {
  for (const b of ["light", "medium", "heavy"] as Button[])
    while (f.buffer.consume(b)) {}
}
export function beginAstaRelay(f: Fighter) {
  const s = f.asta!;
  const sword = s.equipped,
    m = astaRelayMove(sword);
  s.relay = {
    initial: sword,
    sword,
    phase: "opening",
    extensions: 0,
    action: 0,
    cast: s.cast,
    started: clock(f),
    deadline: clock(f) + 150,
    confirmed: false,
    windowFrom: m.startup + m.active,
    windowTo: m.startup + m.active + 12,
    minSerial: f.buffer.snapshot().serial,
    contacts: [],
    lastContact: -1,
  };
}
/** Called only by the ordinary hit resolver. No capture, forced position or extra damage. */
export function confirmAstaRelay(f: Fighter) {
  const r = f.asta?.relay;
  if (!r || f.moveId !== "astaDualBreak") return;
  const key = r.action + ":" + (f.hitWindow?.id ?? 0);
  if (!r.contacts.includes(key)) r.contacts.push(key);
  r.confirmed = true;
  r.lastContact = clock(f);
}
function transition(
  f: Fighter,
  phase: AstaRelayState["phase"],
  sword: AstaSword,
) {
  const s = f.asta!,
    r = s.relay!;
  r.sword = sword;
  r.phase = phase;
  r.action++;
  r.confirmed = false;
  r.minSerial = f.buffer.snapshot().serial;
  delete r.choice;
  const m = astaRelayMove(sword, phase, r.extensions);
  r.windowFrom = m.startup + m.active;
  r.windowTo = r.windowFrom + 12;
  f.stateFrame = 0;
  f.connected = f.hitConfirmed = false;
  f.hitIds = [];
  f.vx = 0;
  s.attackSword = s.equipped;
  s.pending = { sword, at: 2, move: "astaDualBreak" };
  consumeChoices(f);
}
/** Owns only the player's J/K/L actions while the existing attack state is active. */
export function stepAstaRelay(f: Fighter) {
  const s = f.asta,
    r = s?.relay;
  if (!s || !r) return;
  if (f.state !== "attack" || f.moveId !== "astaDualBreak") {
    delete s.relay;
    return;
  }
  if (!f.opponent || f.opponent.health <= 0) {
    consumeChoices(f);
    f.setState("idle");
    f.vx = 0;
    return;
  }
  if (r.phase === "finish") {
    consumeChoices(f);
    return;
  }
  if (clock(f) >= r.deadline) {
    transition(f, "finish", s.equipped);
    return;
  }
  if (!r.confirmed) {
    const m = f.move!;
    if (f.stateFrame >= m.startup + m.active + m.recovery) consumeChoices(f);
    return;
  }
  if (f.stateFrame < r.windowFrom) return;
  if (r.extensions >= 2) {
    transition(f, "finish", s.equipped);
    return;
  }
  let selected: AstaSword | undefined;
  for (const a of f.buffer.actions) {
    if (
      (a.serial ?? 0) <= r.minSerial ||
      !["light", "medium"].includes(a.button)
    )
      continue;
    const d =
      f.buffer.directions
        .filter((d) => (d.serial ?? 0) <= (a.serial ?? 0))
        .at(-1)?.value ?? 5;
    if (a.button === "medium" && d === 2) {
      selected = "destroyer";
      break;
    }
    if (a.button === "light")
      selected =
        d === 6
          ? "slayer"
          : d === 4
            ? "slasher"
            : d === 2
              ? "dweller"
              : undefined;
    if (selected) break;
  }
  if (selected && f.stateFrame <= r.windowTo) {
    r.choice = selected;
    r.extensions++;
    transition(f, "link", selected);
    return;
  }
  if (f.stateFrame >= r.windowTo) {
    transition(f, "finish", s.equipped);
  }
}
/** One fresh J opts into pursuit. A complete motion still belongs to the universal special reader. */
export function stepAstaPursuit(f: Fighter) {
  const s = f.asta,
    p = s?.pursuit;
  if (!s || !p || p.used || s.relay) return;
  if (clock(f) > p.until || f.health <= 0) {
    delete s.pursuit;
    return;
  }
  if (
    f.airborne ||
    !["idle", "walk", "crouch", "attack"].includes(f.state) ||
    (f.state === "attack" && f.moveId !== "astaBlackSlash")
  )
    return;
  const edge = f.buffer.actions.find(
    (a) => a.button === "light" && (a.serial ?? 0) > p.minSerial,
  );
  if (!edge || f.buffer.gokuSpecial("light")) return;
  if (f.attack("astaBlackSlashPursuit")) {
    p.used = true;
    f.buffer.consumeSpecial("light");
  }
}

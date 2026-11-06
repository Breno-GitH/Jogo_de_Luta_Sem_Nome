import { neutral, type Button, type InputFrame } from "./types";
import { defaultBindings, type Bindings } from "../game/preferences";
export class KeyboardInput {
  private held = new Set<string>();
  private queued: Button[] = [];
  private actionContext?: { direction: -1 | 0 | 1; down: boolean };
  constructor(private options: { dashOnDirection?: boolean; bindings?: Bindings; active?: () => boolean } = {}) {
    window.addEventListener("keydown", e => {
      if (this.options.active && !this.options.active()) return;
      if (e.target instanceof HTMLElement && e.target.closest('input,select,textarea,[contenteditable="true"]')) return;
      const b = this.bindings;
      const code = e.code === "ShiftRight" && b.dash === "ShiftLeft" ? "ShiftLeft" : e.code;
      if (!Object.values(b).includes(code)) return;
      e.preventDefault();
      if (e.repeat || this.held.has(code)) return;
      this.held.add(code);
      const actions: [keyof Bindings, Button][] = [["jump","jump"],["light","light"],["medium","medium"],["heavy","heavy"],["throw","throw"],["ultimate","ultimate"],["taunt","taunt"],["dash","dash"]];
      const button = actions.find(([key]) => b[key] === code)?.[1] ?? (this.options.dashOnDirection && [b.left,b.right].includes(code) && this.held.has(b.dash) ? "dash" : undefined);
      if (button) {
        this.queued.push(button);
        this.actionContext = { direction: this.direction(), down: this.held.has(b.down) };
      }
    });
    window.addEventListener("keyup", e => this.held.delete(e.code === "ShiftRight" && this.bindings.dash === "ShiftLeft" ? "ShiftLeft" : e.code));
    window.addEventListener("blur", () => this.clear());
  }
  private get bindings() { return this.options.bindings ?? defaultBindings; }
  private direction() { return (Number(this.held.has(this.bindings.right)) - Number(this.held.has(this.bindings.left))) as -1 | 0 | 1; }
  clear() { this.held.clear(); this.queued = []; this.actionContext = undefined; }
  sample(): InputFrame {
    const i = neutral();
    i.direction = this.direction(); i.down = this.held.has(this.bindings.down);
    i.pressed = this.queued.splice(0);
    if (i.pressed.length && this.actionContext) { i.direction = this.actionContext.direction; i.down = this.actionContext.down; }
    this.actionContext = undefined;
    return i;
  }
}
// Frame-indexed command history can also be fed by a future network adapter.
export class CommandBuffer {
  private now = 0;
  private serial = 0;
  snapshot() {
    return {
      now: this.now,
      serial: this.serial,
      actions: this.actions.map((a) => ({ ...a })),
      directions: this.directions.map((d) => ({ ...d })),
    };
  }
  restore(state: ReturnType<CommandBuffer["snapshot"]>) {
    this.now = state.now;
    this.serial = state.serial ?? 0;
    this.actions = state.actions.map((a) => ({ ...a }));
    this.directions = state.directions.map((d) => ({ ...d }));
  }
  actions: {
    button: Button;
    frame: number;
    serial?: number;
  }[] = [];
  directions: {
    value: number;
    frame: number;
    serial?: number;
  }[] = [];
  push(input: InputFrame, frame: number, facing: number) {
    this.now = frame;
    this.serial++;
    this.actions = this.actions.filter((a) => frame - a.frame <= 8);
    for (const button of input.pressed)
      this.actions.push({ button, frame, serial: this.serial });
    const value = input.down
      ? input.direction === facing
        ? 3
        : input.direction === -facing
          ? 1
          : 2
      : input.direction === facing
        ? 6
        : input.direction === -facing
          ? 4
          : 5;
    if (this.directions.at(-1)?.value !== value)
      this.directions.push({ value, frame, serial: this.serial });
    this.directions = this.directions.filter((d) => frame - d.frame <= 36);
  }
  quarterCircle() {
    return this.motion([2, 3, 6]);
  }
  motion(pattern: number[]) {
    const history = this.directions.filter(
      (d) => d.value !== 5 && this.now - d.frame <= 24,
    );
    for (let end = history.length - 1; end >= 0; end--) {
      if (this.now - history[end].frame > 6) break;
      if (history[end].value !== pattern.at(-1)) continue;
      const tail = history.slice(end + 1);
      if (tail.some((d) => !(pattern[0] === 6 && d.value === 6))) continue;
      let at = pattern.length - 1,
        index = end;
      while (at >= 0 && index >= 0) {
        if (history[index].value !== pattern[at]) break;
        at--;
        index--;
      }
      if (at < 0) return true;
    }
    return false;
  }
  special(): "crescent" | "counter" | "draw" | undefined {
    return this.motion([6, 2, 3])
      ? "crescent"
      : this.motion([2, 1, 4])
        ? "counter"
        : this.motion([2, 3, 6])
          ? "draw"
          : undefined;
  }
  /** Dio's two-cardinal motions also accept the intervening diagonal. Match
   * against the button EDGE, not a direction entered after a buffered press. */
  dioSpecial(
    button: Button,
    window = 24,
    finish = 5,
  ): "knives" | "rush" | "timeStop" | undefined {
    const action = this.actions.find((a) => a.button === button);
    if (!action || !["light", "medium", "heavy"].includes(button)) return;
    const history = this.directions.filter(
      (d) =>
        d.value !== 5 &&
        d.frame <= action.frame &&
        action.frame - d.frame <= window &&
        (d.serial ?? 0) <= (action.serial ?? this.serial),
    );
    const values = history.map((d) => d.value);
    const patterns: ["knives" | "rush" | "timeStop", number[][]][] = [
      [
        "timeStop",
        [
          [6, 3, 2],
          [6, 2],
        ],
      ],
      [
        "rush",
        [
          [2, 1, 4],
          [2, 4],
        ],
      ],
      [
        "knives",
        [
          [2, 3, 6],
          [2, 6],
        ],
      ],
    ];
    for (const [name, alternatives] of patterns) {
      if (name === "timeStop" && button !== "heavy") continue;
      for (const pattern of alternatives) {
        const tail = history.slice(-pattern.length);
        if (
          tail.length === pattern.length &&
          pattern.every(
            (v, i) => v === values[values.length - pattern.length + i],
          ) &&
          action.frame - tail.at(-1)!.frame <= finish &&
          (tail[0].serial ?? 0) < (tail.at(-1)!.serial ?? this.serial)
        )
          return name;
      }
    }
  }
  consumeSpecial(button: Button) {
    const action = this.actions.find((a) => a.button === button);
    if (!action) return;
    this.actions = this.actions.filter(
      (a) =>
        !(
          ["light", "medium", "heavy"].includes(a.button) &&
          a.frame <= action.frame
        ),
    );
    this.consumeMotion();
  }
  /** Match at the button edge. Neutral releases are significant for22:
   * holding down or rolling through diagonals is never a double tap. */
  gokuSpecial(
    button: Button,
    motionTicks = 24,
    finishTicks = 6,
    doubleDownTicks = 20,
    minimumDownGapTicks = 1,
  ): "ki" | "kamehameha" | "teleport" | undefined {
    const action = this.actions.find((a) => a.button === button);
    if (!action || !["light", "medium", "heavy"].includes(button)) return;
    const history = this.directions.filter(
      (d) =>
        d.frame <= action.frame &&
        action.frame - d.frame <= Math.max(motionTicks, doubleDownTicks) &&
        (d.serial ?? 0) <= (action.serial ?? this.serial),
    );
    const tail = history.slice(-3);
    if (
      tail.length === 3 &&
      tail[0].value === 2 &&
      tail[1].value === 5 &&
      tail[2].value === 2 &&
      tail[2].frame - tail[0].frame <= doubleDownTicks &&
      (tail[2].serial ?? tail[2].frame) - (tail[1].serial ?? tail[1].frame) >=
        minimumDownGapTicks &&
      action.frame - tail[2].frame <= finishTicks
    )
      return "teleport";
    const directions = history.filter(
      (d) => d.value !== 5 && action.frame - d.frame <= motionTicks,
    );
    for (const [name, patterns] of [
      [
        "ki",
        [
          [2, 3, 6],
          [2, 6],
        ],
      ],
      [
        "kamehameha",
        [
          [2, 1, 4],
          [2, 4],
        ],
      ],
    ] as const) {
      for (const pattern of patterns) {
        const entries = directions.slice(-pattern.length);
        if (
          entries.length === pattern.length &&
          entries.every((d, i) => d.value === pattern[i]) &&
          action.frame - entries.at(-1)!.frame <= finishTicks &&
          (entries[0].serial ?? 0) < (entries.at(-1)!.serial ?? this.serial)
        )
          return name;
      }
    }
  }
  consumeMotion() {
    this.directions = [];
  }
  clear() {
    this.actions = [];
    this.directions = [];
  }
  consume(button: Button) {
    const i = this.actions.findIndex((a) => a.button === button);
    if (i < 0) return false;
    this.actions.splice(i, 1);
    return true;
  }
}

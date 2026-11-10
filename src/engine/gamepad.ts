import { neutral, type Button, type InputFrame } from "./types";

export const standardChainKeys = ["A", "X", "Y"] as const;
const actions: readonly [number, Button][] = [
  [0, "light"],
  [2, "medium"],
  [3, "heavy"],
  [5, "throw"],
  [1, "dash"],
  [4, "ultimate"],
  [6, "taunt"],
];

export class GamepadInput {
  private previous = new Set<number>();
  private index = -1;
  private up = false;
  keys: readonly string[] = standardChainKeys;

  sample(baseline = false, omnitrix = false): InputFrame {
    let pad: Gamepad | null | undefined;
    try {
      pad = Array.from(navigator.getGamepads?.() ?? []).find(
        (p) => p?.connected && p.mapping === "standard",
      );
    } catch {
      // The browser can disable controllers in embedded frames.
    }
    if (!pad) {
      this.index = -1;
      this.previous.clear();
      this.up = false;
      return neutral();
    }
    const down = (i: number) => !!pad.buttons[i]?.pressed;
    const horizontal = pad.axes[0] ?? 0;
    const vertical = pad.axes[1] ?? 0;
    const direction = (Number(down(15) || horizontal > 0.48) -
      Number(down(14) || horizontal < -0.48)) as -1 | 0 | 1;
    const up = down(12) || vertical < -0.55;
    const pressed: Button[] = [];
    if (!baseline && this.index === pad.index) {
      for (const [index, button] of actions)
        if (down(index) && !this.previous.has(index)) pressed.push(button);
      if (up && !this.up) pressed.push("jump");
    }
    this.index = pad.index;
    this.previous = new Set(actions.map(([index]) => index).filter(down));
    this.up = up;
    this.keys = /playstation|dualsense|dualshock|054c/i.test(pad.id)
      ? ["✕", "□", "△"]
      : /nintendo|057e/i.test(pad.id)
        ? ["B", "Y", "X"]
        : standardChainKeys;
    const frame: InputFrame = { direction, down: down(13) || vertical > 0.55, pressed };
    if (omnitrix) {
      frame.omnitrix = { held: down(3) };
      if (up) frame.up = true;
    }
    return frame;
  }
}

import { describe, it, expect } from "vitest";
import {
  defaults,
  readPreferences,
  bindingError,
} from "../src/game/preferences";
describe("local game preferences", () => {
  it("recovers safely from broken or unavailable local storage", () => {
    expect(readPreferences({ getItem: () => "{broken" })).toEqual(defaults());
    expect(
      readPreferences({
        getItem: () => {
          throw Error();
        },
      }),
    ).toEqual(defaults());
  });
  it("validates ranges, types, reserved keys and conflicting bindings on load", () => {
    const data = {
      ...defaults(),
      master: 3,
      music: -8,
      effects: "loud",
      shake: "off",
      scale: "3",
      bindings: { ...defaults().bindings, light: "KeyR" },
    };
    const saved = readPreferences({ getItem: () => JSON.stringify(data) });
    expect(saved.master).toBe(1);
    expect(saved.music).toBe(0);
    expect(saved.effects).toBe(0.5);
    expect(saved.shake).toBe(true);
    expect(saved.scale).toBe("fit");
    expect(saved.bindings).toEqual(defaults().bindings);
    expect(bindingError(defaults().bindings, "light", "Escape")).not.toBe("");
    expect(bindingError(defaults().bindings, "light", "KeyR")).not.toBe("");
    expect(bindingError(defaults().bindings, "light", "KeyF")).toBe("");
  });
  it("persists valid remaps and preferences without sharing object references", () => {
    const data = defaults();
    data.bindings.light = "KeyF";
    data.shake = false;
    data.music = 0;
    const loaded = readPreferences({ getItem: () => JSON.stringify(data) });
    expect(loaded).toEqual(data);
    loaded.bindings.heavy = "KeyG";
    expect(defaults().bindings.heavy).toBe("KeyL");
  });
});

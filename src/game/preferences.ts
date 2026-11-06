export const defaultBindings = {
  left: "KeyA",
  right: "KeyD",
  jump: "KeyW",
  down: "KeyS",
  light: "KeyJ",
  medium: "KeyK",
  heavy: "KeyL",
  ultimate: "KeyR",
  dash: "ShiftLeft",
  throw: "KeyU",
  taunt: "KeyT",
};
export type Bindings = typeof defaultBindings;
export interface Preferences {
  master: number;
  effects: number;
  music: number;
  muted: boolean;
  pixelPerfect: boolean;
  shake: boolean;
  fps: boolean;
  scale: "fit" | "1" | "2";
  bindings: Bindings;
}
export const defaults = (): Preferences => ({
  master: 0.5,
  effects: 0.5,
  music: 0.18,
  muted: false,
  pixelPerfect: true,
  shake: true,
  fps: false,
  scale: "fit",
  bindings: { ...defaultBindings },
});
export const preferencesKey = "sem-nome-preferences-v1";
export function keyLabel(code: string) {
  return code
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .replace("ShiftLeft", "Shift")
    .replace("ShiftRight", "Shift dir.")
    .replace("Arrow", "Seta ");
}
export function bindingError(
  bindings: Bindings,
  action: keyof Bindings,
  code: string,
) {
  if (
    !/^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Shift(Left|Right)|Space)$/.test(
      code,
    )
  )
    return "Use uma letra, número, seta, Shift ou Espaço. Esc e Enter são reservados aos menus.";
  if (Object.entries(bindings).some(([a, c]) => a !== action && c === code))
    return "Esta tecla já está atribuída a outra ação.";
  return "";
}
export function readPreferences(
  storage?: Pick<Storage, "getItem">,
): Preferences {
  const result = defaults();
  try {
    const value = JSON.parse(
      (storage ?? localStorage).getItem(preferencesKey) ?? "null",
    );
    if (!value || typeof value !== "object") return result;
    for (const key of ["master", "effects", "music"] as const)
      if (typeof value[key] === "number" && Number.isFinite(value[key]))
        result[key] = Math.max(0, Math.min(1, value[key]));
    for (const key of ["muted", "pixelPerfect", "shake", "fps"] as const)
      if (typeof value[key] === "boolean") result[key] = value[key];
    if (["fit", "1", "2"].includes(value.scale)) result.scale = value.scale;
    const candidate = value.bindings;
    if (
      candidate &&
      Object.keys(defaultBindings).every(
        (k) => typeof candidate[k] === "string",
      ) &&
      Object.keys(defaultBindings).every(
        (k) => !bindingError(candidate, k as keyof Bindings, candidate[k]),
      )
    )
      result.bindings = {
        ...defaultBindings,
        ...Object.fromEntries(
          Object.keys(defaultBindings).map((k) => [k, candidate[k]]),
        ),
      };
  } catch {
    /* Storage may be disabled or contain an older format. */
  }
  return result;
}
export function savePreferences(prefs: Preferences) {
  try {
    localStorage.setItem(preferencesKey, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

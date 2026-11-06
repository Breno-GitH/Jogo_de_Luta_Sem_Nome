import type { Match, HitEvent } from "../engine/combat";
export type Cue =
  | "swing"
  | "hit"
  | "heavy"
  | "guard"
  | "counter"
  | "power"
  | "kirinCharge"
  | "kirinThunder"
  | "round"
  | "fight"
  | "ko"
  | "menu";
export function effectCue(event: HitEvent): Cue {
  if (event.kind === "kirinCharge" || event.kind === "kirinThunder") return event.kind;
  return event.kind === "guard"
    ? "guard"
    : event.kind === "counter"
      ? "counter"
      : event.kind === "power"
        ? "power"
        : event.kind === "ultimate" ||
            event.kind === "crescent" ||
            event.kind === "roadImpact" ||
            event.kind === "roadExplosion"
          ? "heavy"
          : "hit";
}
/** Original short synthesized sounds. No downloaded samples or autoplay. */
export class Sound {
  enabled = true;
  volume = 0.25;
  lastCue: Cue | "" = "";
  private context?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private seen = new WeakSet<HitEvent>();
  private owner?: Match;
  private moves = ["", ""];
  private message = "";
  private musicGain?: GainNode;
  private musicTimer?: ReturnType<typeof setInterval>;
  private musicVolume = 0.18;
  private masterVolume = 0.5;
  private musicStep = 0;
  private bossMusic = false;
  setBossMusic(value: boolean) {
    if (value !== this.bossMusic) this.musicStep = 0;
    this.bossMusic = value;
  }
  get available() {
    return typeof AudioContext !== "undefined";
  }
  get state() {
    return !this.available ? "unavailable" : (this.context?.state ?? "locked");
  }
  async unlock() {
    if (!this.available || !this.enabled) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
        this.musicGain = this.context.createGain();
        this.musicGain.connect(this.context.destination);
        this.applyVolume();
        this.noise = this.context.createBuffer(
          1,
          Math.floor(this.context.sampleRate * 0.22),
          this.context.sampleRate,
        );
        const samples = this.noise.getChannelData(0);
        let seed = 39;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          samples[i] = ((seed / 4294967296) * 2 - 1) * (1 - i / samples.length);
        }
      }
      await this.context.resume();
      if (!this.musicTimer) {
        this.musicTimer = setInterval(() => this.musicNote(), 210);
      }
    } catch {
      /* A browser without audio still runs the whole game. */
    }
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.applyVolume();
    if (enabled) void this.unlock();
  }
  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(0.6, value));
    this.applyVolume();
  }
  private applyVolume() {
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        this.enabled ? this.volume : 0,
        this.context.currentTime,
        0.015,
      );
    if (this.musicGain && this.context)
      this.musicGain.gain.setTargetAtTime(
        this.enabled ? this.masterVolume * this.musicVolume * 0.13 : 0,
        this.context.currentTime,
        0.02,
      );
  }
  configure(master: number, effects: number, music: number, muted: boolean) {
    this.masterVolume = master;
    this.volume = master * effects;
    this.musicVolume = music;
    this.enabled = !muted;
    this.applyVolume();
  }
  /** Original quiet arcade arpeggio, a separate bus from combat sounds. */
  private musicNote() {
    const ctx = this.context,
      bus = this.musicGain;
    if (
      !ctx ||
      !bus ||
      ctx.state !== "running" ||
      document.hidden ||
      !this.enabled ||
      !this.musicVolume
    )
      return;
    const sequence = this.bossMusic ? [33, 45, 36, 45, 40, 48, 41, 47, 33, 45, 36, 48, 39, 46, 40, 47] : [
      45, 52, 57, 60, 45, 52, 59, 64, 41, 48, 53, 57, 43, 50, 55, 59,
    ];
    const osc = ctx.createOscillator(),
      env = ctx.createGain(),
      at = ctx.currentTime;
    osc.type = "triangle";
    osc.frequency.value =
      440 * 2 ** ((sequence[this.musicStep++ % sequence.length] - 69) / 12);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.4, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    osc.connect(env);
    env.connect(bus);
    osc.start(at);
    osc.stop(at + 0.2);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }
  play(cue: Cue) {
    const ctx = this.context,
      master = this.master;
    if (!this.enabled || !ctx || !master || ctx.state !== "running") return;
    this.lastCue = cue;
    const now = ctx.currentTime;
    const tone = (
      from: number,
      to: number,
      duration: number,
      type: OscillatorType = "triangle",
      gain = 0.3,
      delay = 0,
    ) => {
      const oscillator = ctx.createOscillator(),
        envelope = ctx.createGain(),
        at = now + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, at);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, to),
        at + duration,
      );
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(gain, at + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
    };
    if (
      ["swing", "hit", "heavy", "guard", "counter", "power", "kirinThunder"].includes(cue) &&
      this.noise
    ) {
      const source = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        envelope = ctx.createGain();
      const duration = cue === "swing" ? 0.085 : cue === "heavy" || cue === "kirinThunder" ? 0.18 : 0.1;
      source.buffer = this.noise;
      filter.type = cue === "swing" ? "highpass" : "lowpass";
      filter.frequency.value =
        cue === "swing" ? 1700 : cue === "guard" ? 5500 : 1700;
      envelope.gain.setValueAtTime(cue === "swing" ? 0.18 : 0.45, now);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(master);
      source.start(now);
      source.stop(now + duration);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        envelope.disconnect();
      };
    }
    if (cue === "kirinCharge") {
      tone(91, 47, .42, "triangle", .30);
      tone(330, 1150, .12, "sawtooth", .075, .12);
    } else if (cue === "kirinThunder") {
      tone(146, 34, .52, "triangle", .56);
      tone(1200, 230, .095, "square", .14);
    } else if (cue === "guard" || cue === "counter")
      tone(cue === "guard" ? 1250 : 1650, 700, 0.12, "sine", 0.2);
    else if (cue === "hit" || cue === "heavy")
      tone(
        cue === "heavy" ? 170 : 230,
        45,
        cue === "heavy" ? 0.18 : 0.1,
        "triangle",
        0.5,
      );
    else if (cue === "power") {
      tone(160, 650, 0.3, "sawtooth", 0.12);
      tone(330, 990, 0.28, "sine", 0.15);
    } else if (cue === "round") {
      tone(440, 440, 0.11);
      tone(660, 660, 0.13, "triangle", 0.3, 0.14);
    } else if (cue === "fight") {
      tone(660, 990, 0.14);
      tone(990, 1320, 0.17, "triangle", 0.3, 0.1);
    } else if (cue === "ko") {
      tone(220, 55, 0.45, "sawtooth", 0.16);
      tone(330, 110, 0.5, "triangle", 0.2, 0.07);
    } else if (cue === "menu") tone(660, 880, 0.06, "sine", 0.15);
  }
  tick(match: Match) {
    if (this.owner !== match) {
      this.owner = match;
      this.moves = ["", ""];
      this.message = "";
      this.seen = new WeakSet();
    }
    for (const event of match.events)
      if (!this.seen.has(event)) {
        this.seen.add(event);
        this.play(effectCue(event));
      }
    match.fighters.forEach((f, i) => {
      const move = f.state === "attack" ? f.moveId : "";
      if (move && move !== this.moves[i]) this.play("swing");
      this.moves[i] = move;
    });
    if (match.message !== this.message) {
      this.message = match.message;
      if (match.message.startsWith("ROUND")) this.play("round");
      else if (match.message === "LUTEM!") this.play("fight");
      else if (match.message === "K.O.") this.play("ko");
    }
  }
}

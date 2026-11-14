import type { Match, HitEvent } from "../engine/combat";
import type { CentipedeCue } from "../engine/kaneki-centipede";
import { pandemoniumConfig } from "../engine/xebec-pandemonium";
import { chainFinishes } from "../engine/kaneki-chain";
export type Cue =
  | "swing"
  | "hit"
  | "heavy"
  | "guard"
  | "counter"
  | "power"
  | "feedbackSpark"
  | "nrgImpact"
  | "nrgMetal"
  | "gravityPulse"
  | "sonicWave"
  | "kirinCharge"
  | "kirinThunder"
  | "knuckleSnap"
  | "centipede"
  | "chainBind"
  | "chainEscape"
  | "chainWhoosh"
  | "chainImpact"
  | "round"
  | "fight"
  | "ko"
  | "menu";
export function effectCue(event: HitEvent): Cue {
  if (event.centipede) return "centipede";
  if (!event.blocked && (event.ben === "electric" || event.ben === "storm") &&
      (event.kind === "hit" || event.kind === "power")) return "feedbackSpark";
  if (!event.blocked && event.ben === "thermal" && event.kind === "hit") return "nrgImpact";
  if (!event.blocked && event.ben === "gravity") return "gravityPulse";
  if (!event.blocked && event.ben === "sonic") return "sonicWave";
  if (event.ben === "metal" && (event.kind === "hit" || event.kind === "counter")) return "nrgMetal";
  if (event.kind === "kirinCharge" || event.kind === "kirinThunder" || event.kind === "knuckleSnap") return event.kind;
  if (event.kind === "chainBind" || event.kind === "chainEscape" || event.kind === "chainWhoosh" || event.kind === "chainImpact") return event.kind;
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
  private lastKnuckleFrame = -1;
  private lastCentipedeFrame = -1;
  private onlineRound?: string;
  private moves = ["", ""];
  private message = "";
  private musicGain?: GainNode;
  private musicTimer?: ReturnType<typeof setInterval>;
  private musicVolume = 0.18;
  private masterVolume = 0.5;
  private musicStep = 0;
  private bossMusic = false;
  private musicDucked = false;
  setMusicDucked(value: boolean) {
    if (this.musicDucked === value) return;
    this.musicDucked = value;
    this.applyVolume();
  }
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
        this.enabled ? this.masterVolume * this.musicVolume * (this.musicDucked ? 0.025 : 0.13) : 0,
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
  play(cue: Cue, chain?: HitEvent["chain"], centipede?: CentipedeCue) {
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
      ["swing", "hit", "heavy", "guard", "counter", "power", "kirinThunder", "knuckleSnap", "chainWhoosh", "chainImpact", "centipede"].includes(cue) &&
      this.noise
    ) {
      const source = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        envelope = ctx.createGain();
      const duration = centipede === "ground" ? .21 : centipede === "fall" ? .15 : cue === "knuckleSnap" ? 0.026 : cue === "swing" ? 0.085 : cue === "heavy" || cue === "kirinThunder" ? 0.18 : 0.1;
      source.buffer = this.noise;
      filter.type = cue === "knuckleSnap" ? "bandpass" : cue === "swing" ? "highpass" : "lowpass";
      filter.frequency.value =
        centipede === "ground" ? 580 : centipede === "grip" ? 2650 : cue === "knuckleSnap" ? 2700 : cue === "swing" ? 1700 : cue === "guard" ? 5500 : 1700;
      envelope.gain.setValueAtTime(cue === "knuckleSnap" ? 0.9 : cue === "swing" ? 0.18 : 0.45, now);
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
    if (cue === "centipede" && centipede) {
      const strokes: Record<CentipedeCue, [number, number, number, OscillatorType, number]> = {
        activation: [173,63,.22,"triangle",.36], transform: [96,179,.26,"sawtooth",.15],
        lash: [509,125,.095,"triangle",.29], launch: [212,484,.18,"square",.16],
        grip: [257,83,.12,"triangle",.32], fall: [520,59,.34,"sawtooth",.18],
        ground: [123,28,.48,"triangle",.58], release: [139,45,.19,"sine",.27],
        wall: [305,52,.15,"square",.17],
      };
      tone(...strokes[centipede]);
      if (centipede === "ground") tone(760,94,.10,"square",.15);
    } else if (cue === "knuckleSnap") {
      tone(1200, 550, .027, "triangle", .31);
    } else if (cue === "chainBind") {
      tone(310, 96, .075, "triangle", .31);
    } else if (cue === "chainEscape") {
      tone(590, 915, .12, "triangle", .26);
    } else if (cue === "chainWhoosh") {
      tone(chain === "spin" || chain === "lasso" ? 280 : 147, 420, .11, "sine", .22);
    } else if (cue === "chainImpact") {
      const slam = chain && chainFinishes[chain].slam;
      const toneStart = chain === "meteor" ? 104 : chain === "centipede" ? 128 :
        chain === "embrace" ? 225 : chain === "pendulum" ? 170 : 205;
      tone(toneStart, slam ? 39 : 72, slam ? .21 : .095, "triangle", slam ? .51 : .36);
      if (slam || chain === "spin") tone(380, 80, .08, "square", .12);
    } else if (cue === "feedbackSpark") {
      tone(620, 94, .11, "square", .13);
      tone(180, 38, .13, "triangle", .27);
    } else if (cue === "gravityPulse") {
      tone(108, 45, .17, "sine", .33);
      tone(221, 94, .12, "triangle", .19, .024);
    } else if (cue === "sonicWave") {
      tone(745, 491, .094, "triangle", .24);
      tone(520, 264, .12, "sine", .21, .04);
    } else if (cue === "nrgMetal") {
      tone(187, 48, .12, "triangle", .43);
      tone(1450, 680, .075, "square", .075);
      tone(780, 350, .14, "sine", .17);
    } else if (cue === "nrgImpact") {
      tone(172, 38, .16, "triangle", .38);
      tone(330, 87, .09, "sawtooth", .09);
    } else if (cue === "kirinCharge") {
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
  tick(match: Match, onlineRound?: string) {
    this.setMusicDucked(!!match.pandemonium && match.pandemonium.tick < pandemoniumConfig.hits[0].tick);
    if (this.owner !== match) {
      this.owner = match;
      this.moves = ["", ""];
      this.message = "";
      this.seen = new WeakSet();
      if (!onlineRound || onlineRound !== this.onlineRound) this.lastKnuckleFrame = this.lastCentipedeFrame = -1;
      this.onlineRound = onlineRound;
    }
    for (const event of match.events)
      if (!this.seen.has(event)) {
        this.seen.add(event);
        if (event.knuckleFrame !== undefined) {
          if (event.knuckleFrame <= this.lastKnuckleFrame) continue;
          this.lastKnuckleFrame = event.knuckleFrame;
        }
        if (event.centipede) {
          if (event.centipede.frame <= this.lastCentipedeFrame) continue;
          this.lastCentipedeFrame = event.centipede.frame;
        }
        this.play(effectCue(event), event.chain, event.centipede?.cue);
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

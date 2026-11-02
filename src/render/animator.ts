import metadata from "../data/animations.json";

export interface AnimationClip {
  frames: number[];
  ticks: number;
  /** Optional per-frame holds, measured in fixed presentation ticks. */
  durations?: number[];
  /** Clips can migrate to a new atlas without replacing unfinished states. */
  sheet?: string;
  player2Sheet?: string;
  frameWidth?: number;
  frameHeight?: number;
  columns?: number;
  pivot?: { x: number; y: number };
  scale?: number;
  loop?: boolean;
}

export interface AnimationData {
  sheet: string;
  frameWidth: number;
  frameHeight: number;
  columns?: number;
  pivot?: { x: number; y: number };
  scale?: number;
  clips: Record<string, AnimationClip>;
}

// Combat never reads image metadata; attack visuals may sync to simulation ticks.
export class Animator {
  private state = "idle";
  private ticks = 0;
  constructor(private readonly data: AnimationData = metadata) {}

  update(state: string, restart = false) {
    if (!this.data.clips[state]) throw new Error(`Unknown animation: ${state}`);
    if (state !== this.state || restart) {
      this.state = state;
      this.ticks = 0;
    } else this.ticks++;
  }
  get clipName() {
    return this.state;
  }
  get elapsedTicks() {return this.ticks;}
  hasClip(name: string) {
    return !!this.data.clips[name];
  }
  seekTick(tick: number) {
    this.ticks = Math.max(0, Math.floor(tick));
  }
  seekFrame(index: number) {
    const clip = this.data.clips[this.state];
    const bounded = Math.max(0, Math.min(clip.frames.length - 1, index));
    this.ticks = clip.frames
      .slice(0, bounded)
      .reduce((total, _, i) => total + (clip.durations?.[i] ?? clip.ticks), 0);
  }
  get complete() {
    const clip = this.data.clips[this.state];
    return (
      this.ticks >=
      clip.frames.reduce(
        (total, _, i) => total + (clip.durations?.[i] ?? clip.ticks),
        0,
      )
    );
  }
  /** Director checks before advancing, so transition at the next tick boundary. */
  get endsOnNextTick() {
    const clip = this.data.clips[this.state];
    const duration = clip.frames.reduce(
      (total, _, i) => total + (clip.durations?.[i] ?? clip.ticks),
      0,
    );
    return this.ticks + 1 >= duration;
  }
  frame() {
    const clip = this.data.clips[this.state];
    const durations = clip.frames.map(
      (_, i) => clip.durations?.[i] ?? clip.ticks,
    );
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    let remaining =
      clip.loop === false
        ? Math.min(this.ticks, total - 1)
        : this.ticks % total;
    for (let i = 0; i < clip.frames.length; i++) {
      if (remaining < durations[i]) return clip.frames[i];
      remaining -= durations[i];
    }
    return clip.frames[0];
  }

  /** Geometry is in source pixels; pivot is the grounded character origin. */
  sprite() {
    const clip = this.data.clips[this.state];
    const width = clip.frameWidth ?? this.data.frameWidth;
    const height = clip.frameHeight ?? this.data.frameHeight;
    const frame = this.frame();
    const columns = clip.columns ?? this.data.columns;
    return {
      sheet: clip.sheet ?? this.data.sheet,
      player2Sheet: clip.player2Sheet,
      x: columns ? (frame % columns) * width : frame * width,
      y: columns ? Math.floor(frame / columns) * height : 0,
      width,
      height,
      pivot: clip.pivot ?? this.data.pivot ?? { x: width / 2, y: height },
      scale: clip.scale ?? this.data.scale ?? 2,
    };
  }
}
export { metadata };

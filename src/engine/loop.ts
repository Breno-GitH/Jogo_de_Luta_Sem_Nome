export class FixedLoop {
  private previous = 0;
  private accumulator = 0;
  private handle = 0;
  constructor(
    private update: () => void,
    private render: () => void,
  ) {}
  start() {
    this.previous = performance.now();
    const tick = (now: number) => {
      this.accumulator += Math.min(100, now - this.previous);
      this.previous = now;
      while (this.accumulator >= 1000 / 60) {
        this.update();
        this.accumulator -= 1000 / 60;
      }
      this.render();
      this.handle = requestAnimationFrame(tick);
    };
    this.handle = requestAnimationFrame(tick);
  }
  stop() {
    cancelAnimationFrame(this.handle);
  }
}

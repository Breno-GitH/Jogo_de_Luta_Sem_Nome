/** Fixed-tick animation: a fast foreground and a delayed damage trail. */
export class HealthBar {
  value = 1;
  trail = 1;
  private target = 1;
  private hold = 0;
  reset(value = 1) {
    this.value = this.trail = this.target = value;
    this.hold = 0;
  }
  tick(value: number) {
    const target = Math.max(0, Math.min(1, value));
    if (target < this.target) this.hold = 18;
    if (target > this.target) {
      this.value = this.trail = target;
      this.hold = 0;
    }
    this.target = target;
    this.value += (target - this.value) * 0.35;
    if (Math.abs(this.value - target) < 0.0005) this.value = target;
    if (this.hold > 0) this.hold--;
    else this.trail = Math.max(this.value, this.trail - 0.009);
  }
}

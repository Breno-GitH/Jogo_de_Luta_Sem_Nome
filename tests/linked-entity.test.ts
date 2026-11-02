import { describe, it, expect } from "vitest";
import { LinkedEntity, type EntityAnchor } from "../src/engine/linked-entity";
import data from "../src/data/the-world-visual.json";
import { depthOrder, type SpriteEntity } from "../src/render/sprite-scene";
import { Animator } from "../src/render/animator";
import dio from "../src/data/dio-animations.json";
import world from "../src/data/the-world-animations.json";

describe("independent owner and companion", () => {
  const anchor = (): EntityAnchor => ({ id: "dio", x: 520, y: 580, facing: 1 });
  it("mirrors the relative position and keeps the Stand levitating behind its owner", () => {
    const owner = anchor(),
      stand = new LinkedEntity(data, owner);
    expect(stand.transform.x).toBe(490);
    owner.facing = -1;
    expect(stand.reference.x).toBe(550);
    for (let i = 0; i < data.turnTicks + 2; i++) stand.tick();
    expect(stand.transform.x).toBe(550);
    expect(stand.transform.facing).toBe(-1);
    for (let tick = 0; tick < 200; tick++) {
      stand.tick();
      expect(stand.transform.y).toBeLessThan(owner.y - 10);
      expect(Number.isInteger(stand.transform.y)).toBe(true);
      expect(stand.transform.depth).toBeLessThan(10);
    }
  });
  it("advances independently, passes in front and returns to a moved, mirrored owner", () => {
    const owner = anchor(),
      stand = new LinkedEntity(data, owner);
    expect(stand.advance()).toBe(true);
    expect(stand.advance()).toBe(false);
    for (let i = 0; i < data.advanceTicks; i++) stand.tick();
    expect(stand.state).toBe("hold");
    expect(Math.abs(stand.transform.x - (owner.x + 90))).toBeLessThanOrEqual(
      data.maxLagX,
    );
    expect(stand.transform.depth).toBeGreaterThan(10);
    owner.x = 700;
    owner.facing = -1;
    expect(stand.reference.x).toBe(610);
    for (let i = 0; i < data.holdTicks + data.returnTicks + 4; i++)
      stand.tick();
    expect(stand.state).toBe("hover");
    expect(stand.transform.x).toBe(730);
    expect(stand.transform.depth).toBe(0);
  });
  it("has independent animation clocks and stable drawing depth", () => {
    const a = new Animator(dio),
      b = new Animator(world);
    a.update("idle", true);
    b.update("hover", true);
    for (let i = 0; i < 80; i++) b.update("hover");
    expect(a.clipName).toBe("idle");
    expect(b.clipName).toBe("hover");
    expect(a.sprite().sheet).toBe("dio/idle.png");
    expect(b.sprite().sheet).toBe("the-world/floating.png");
    const entity = (id: string, depth: number): SpriteEntity => ({
      id,
      depth,
      x: 0,
      y: 0,
      facing: 1,
      animator: a,
    });
    expect(
      depthOrder([entity("dio", 10), entity("world", 0)]).map((e) => e.id),
    ).toEqual(["world", "dio"]);
    expect(
      depthOrder([entity("dio", 10), entity("world", 20)]).map((e) => e.id),
    ).toEqual(["dio", "world"]);
    expect(
      depthOrder([entity("a", 10), entity("b", 10)]).map((e) => e.id),
    ).toEqual(["a", "b"]);
  });
  it("rejects an unrelated owner and reproduces the same poses at fixed ticks", () => {
    expect(
      () => new LinkedEntity(data, { ...anchor(), id: "samurai" }),
    ).toThrow();
    const a = new LinkedEntity(data, anchor()),
      b = new LinkedEntity(data, anchor());
    a.advance();
    b.advance();
    for (let i = 0; i < 120; i++) {
      a.tick();
      b.tick();
      expect(a.transform).toEqual(b.transform);
    }
  });
});

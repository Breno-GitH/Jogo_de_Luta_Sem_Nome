import { describe, it, expect } from "vitest";
import { Rooms } from "../server/rooms";
import { neutral } from "../src/engine/types";
import { snapshot, restore, hashState } from "../src/engine/state";

describe("authoritative entrance input path", () => {
  it("preserves both skip edges through room sanitization and broadcasts one shared release", () => {
    let now = 0;
    const steps: any[] = [];
    const rooms = new Rooms(
      (ids, event, p) => {
        if (event === "match:step") steps.push(p);
      },
      () => now,
    );
    const code = rooms.create("host").room.code;
    rooms.join("guest", code);
    for (const [socket, character] of [
      ["host", "asta"],
      ["guest", "dio"],
    ]) {
      rooms.select(socket, character);
      rooms.confirm(socket);
      rooms.ready(socket, true);
    }
    rooms.startMatch("host");
    const room = rooms.rooms.get(code)!;
    const clients = [
      restore(snapshot(room.match!)),
      restore(snapshot(room.match!)),
    ];
    expect(room.match!.rules.introSkip).toBe("both");
    for (let t = 1; t <= 160; t++) {
      for (const [seat, socket] of ["host", "guest"].entries()) {
        rooms.input(socket, {
          matchId: room.matchId,
          tick: t + rooms.delay,
          input: {
            ...neutral(),
            ...(t === (seat ? 42 : 12) ? { skipIntro: true } : {}),
            pressed: ["ultimate"],
          },
        });
      }
      now += 1000 / 60 + 0.001;
      rooms.pump();
      const packet = steps.at(-1);
      for (const client of clients) {
        client.step(packet.inputs);
        expect(hashState(snapshot(client))).toBe(packet.hash);
      }
      const m = room.match!;
      if (t === 12 + rooms.delay) {
        expect(packet.inputs[0].skipIntro).toBe(true);
        expect(m.intro.skipVotes).toEqual([true, false]);
        expect(m.intro.skipped).toBe(false);
      }
      if (t === 42 + rooms.delay) {
        expect(packet.inputs[1].skipIntro).toBe(true);
        expect(m.intro.skipVotes).toEqual([true, true]);
        expect(m.intro.skipped).toBe(true);
        expect(m.phaseFrames).toBe(47);
      }
      if (t < 42 + rooms.delay + 47) {
        expect(m.phase).toBe("intro");
        expect(m.fighters.map((f) => f.health)).toEqual([1000, 1000]);
      }
      if (t === 42 + rooms.delay + 47) {
        expect(m.phase).toBe("fight");
        expect(m.fighters.map((f) => f.state)).toEqual(["idle", "idle"]);
      }
    }
  });
});

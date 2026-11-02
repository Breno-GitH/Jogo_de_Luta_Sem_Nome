import { describe, it, expect } from "vitest";
import { Rooms } from "../server/rooms";
import { ONLINE_CHARACTERS } from "../src/net/protocol";
import { snapshot, restore, hashState } from "../src/engine/state";
import { neutral } from "../src/engine/types";
describe("LAN lobby and existing character engine", () => {
  it.each(
    ONLINE_CHARACTERS.flatMap((a) => ONLINE_CHARACTERS.map((b) => ({ a, b }))),
  )(
    "$a vs $b is selected on the server and produces identical replayed ticks",
    ({ a, b }) => {
      let now = 0;
      const packets: any[] = [];
      const rooms = new Rooms(
        (ids, event, p) => {
          if (event === "match:step") packets.push(p);
        },
        () => now,
      );
      const code = rooms.create("host").room.code;
      rooms.join("guest", code);
      rooms.select("host", a);
      rooms.select("guest", b);
      expect(() => rooms.ready("host", true)).toThrow("confirme");
      rooms.confirm("host");
      rooms.confirm("guest");
      rooms.ready("host", true);
      rooms.ready("guest", true);
      expect(rooms.rooms.get(code)!.match).toBeUndefined();
      expect(() => rooms.startMatch("guest")).toThrow("anfitrião");
      rooms.startMatch("host");
      const r = rooms.rooms.get(code)!,
        client = restore(snapshot(r.match!));
      expect(r.match!.fighters.map((f) => f.data.id)).toEqual([a, b]);
      for (let t = 1; t <= 240; t++) {
        for (const socket of ["host", "guest"])
          rooms.input(socket, {
            matchId: r.matchId,
            tick: t + rooms.delay,
            input: {
              ...neutral(),
              direction: socket === "host" ? 1 : -1,
              pressed: t % 38 === 0 ? ["light"] : [],
            },
          });
        now += 1000 / 60 + 0.001;
        rooms.pump();
        const packet = packets.at(-1);
        client.step(packet.inputs);
        expect(hashState(snapshot(client))).toBe(packet.hash);
      }
    },
  );
  it("changing selection invalidates confirmation and readiness", () => {
    const r = new Rooms(() => {});
    const code = r.create("a").room.code;
    r.join("b", code);
    r.select("a", "dio");
    r.confirm("a");
    r.ready("a", true);
    r.select("a", "goku");
    const p = r.rooms.get(code)!.players[0]!;
    expect(p.confirmed).toBe(false);
    expect(p.ready).toBe(false);
    expect(() => r.startMatch("a")).toThrow("prontos");
  });
  it("room code can be reused for new opponents after a disconnect without retaining the old match", () => {
    let now = 0;
    const r = new Rooms(
      () => {},
      () => now,
      { graceMs: 1000 },
    );
    const code = r.create("a").room.code;
    r.join("b", code);
    for (const s of ["a", "b"]) {
      r.select(s, "goku");
      r.confirm(s);
      r.ready(s, true);
    }
    r.startMatch("a");
    r.disconnect("b");
    now = 1001;
    r.pump();
    expect(r.rooms.get(code)!.status).toBe("closed");
    r.lobby("a");
    expect(r.rooms.get(code)!.match).toBeUndefined();
    r.join("c", code);
    expect(r.rooms.get(code)!.players[1]!.connected).toBe(true);
  });
  it("host migrates only on departure, and recently closed codes have an explicit error", () => {
    const r = new Rooms(() => {}),
      code = r.create("a").room.code;
    r.join("b", code);
    r.leave("a");
    expect(r.view(r.rooms.get(code)!).host).toBe(1);
    r.leave("b");
    expect(() => r.join("c", code)).toThrow("encerrada");
  });
});

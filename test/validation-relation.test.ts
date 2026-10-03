import { describe, expect, it } from "vitest";

import {
  conflictingRings,
  relateRings,
  ringContainsRing,
  ringsOverlap,
} from "../src/validation/relation.js";
import type { Ring } from "../src/types.js";

const p = (x: number, y: number) => ({ x, y });

const box = (x0: number, y0: number, x1: number, y1: number): Ring => [
  p(x0, y0),
  p(x1, y0),
  p(x1, y1),
  p(x0, y1),
];

const bounds = box(0, 0, 100, 100);

describe("relateRings", () => {
  it("separates rings that share nothing", () => {
    expect(relateRings(box(0, 0, 10, 10), box(20, 20, 30, 30))).toBe("disjoint");
  });

  it("recognises rings sharing a whole edge", () => {
    expect(relateRings(box(0, 0, 10, 10), box(10, 0, 20, 10))).toBe("touching");
  });

  it("recognises rings sharing a single corner", () => {
    expect(relateRings(box(0, 0, 10, 10), box(10, 10, 20, 20))).toBe("touching");
  });

  it("recognises rings sharing part of an edge", () => {
    expect(relateRings(box(0, 0, 10, 10), box(10, 4, 20, 6))).toBe("touching");
  });

  it("recognises partial overlap", () => {
    expect(relateRings(box(0, 0, 10, 10), box(5, 5, 15, 15))).toBe("overlapping");
  });

  it("recognises a ring crossing another without any vertex inside", () => {
    const horizontal = box(0, 4, 20, 6);
    const vertical = box(8, 0, 12, 10);
    expect(relateRings(horizontal, vertical)).toBe("overlapping");
  });

  it("recognises containment in both directions", () => {
    const small = box(10, 10, 20, 20);
    expect(relateRings(bounds, small)).toBe("a-contains-b");
    expect(relateRings(small, bounds)).toBe("b-contains-a");
  });

  it("treats a contained ring resting on the boundary as contained", () => {
    expect(relateRings(bounds, box(0, 10, 20, 20))).toBe("a-contains-b");
  });

  it("recognises identical rings", () => {
    expect(relateRings(bounds, box(0, 0, 100, 100))).toBe("identical");
  });

  it("ignores the winding direction", () => {
    const reversed: Ring = [...box(10, 10, 20, 20)].reverse();
    expect(relateRings(bounds, reversed)).toBe("a-contains-b");
  });

  it("ignores the starting vertex", () => {
    const rotated: Ring = [...bounds.slice(2), ...bounds.slice(0, 2)];
    expect(relateRings(rotated, box(10, 10, 20, 20))).toBe("a-contains-b");
  });

  it("works with concave rings", () => {
    const uShape: Ring = [
      p(0, 0),
      p(30, 0),
      p(30, 30),
      p(20, 30),
      p(20, 10),
      p(10, 10),
      p(10, 30),
      p(0, 30),
    ];
    // The notch of the U is outside the ring, even though it looks enclosed.
    expect(relateRings(uShape, box(12, 15, 18, 25))).toBe("disjoint");
    expect(relateRings(uShape, box(2, 2, 8, 8))).toBe("a-contains-b");
  });

  it("uses the tolerance when deciding whether borders touch", () => {
    const nearly = box(10.005, 0, 20, 10);
    expect(relateRings(box(0, 0, 10, 10), nearly, 0.01)).toBe("touching");
    expect(relateRings(box(0, 0, 10, 10), nearly, 1e-9)).toBe("disjoint");
  });

  it("returns disjoint for rings that are not rings", () => {
    expect(relateRings([p(0, 0), p(1, 1)], bounds)).toBe("disjoint");
  });
});

describe("ringContainsRing", () => {
  it("accepts zones inside the bounds, border included", () => {
    expect(ringContainsRing(bounds, box(10, 10, 20, 20))).toBe(true);
    expect(ringContainsRing(bounds, box(0, 0, 20, 20))).toBe(true);
  });

  it("rejects zones poking outside the bounds", () => {
    expect(ringContainsRing(bounds, box(90, 90, 110, 110))).toBe(false);
    expect(ringContainsRing(bounds, box(200, 200, 210, 210))).toBe(false);
  });
});

describe("ringsOverlap", () => {
  it("counts containment as overlap and touching as not", () => {
    expect(ringsOverlap(bounds, box(10, 10, 20, 20))).toBe(true);
    expect(ringsOverlap(box(0, 0, 10, 10), box(10, 0, 20, 10))).toBe(false);
  });
});

describe("conflictingRings", () => {
  const existing = [box(0, 0, 10, 10), box(20, 0, 30, 10), box(40, 0, 50, 10)];

  it("lists the zones a candidate collides with", () => {
    expect(conflictingRings(box(5, 5, 25, 25), existing)).toEqual([0, 1]);
  });

  it("returns an empty list when the candidate fits", () => {
    expect(conflictingRings(box(60, 0, 70, 10), existing)).toEqual([]);
  });

  it("can accept zones that only share a border", () => {
    const flush = box(10, 0, 20, 10);
    expect(conflictingRings(flush, existing)).toEqual([0, 1]);
    expect(conflictingRings(flush, existing, { allowTouching: true })).toEqual([]);
  });
});

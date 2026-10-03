import { describe, expect, it } from "vitest";

import {
  ringEffectiveAreas,
  simplifyRing,
  simplifyRingTo,
} from "../src/simplify/visvalingam.js";
import { area } from "../src/core/predicates.js";
import { isSelfIntersecting } from "../src/validation/ring.js";
import type { Point, Ring } from "../src/types.js";

const p = (x: number, y: number) => ({ x, y });

const square: Ring = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];

/** A square with an extra vertex barely off the bottom edge. */
const squareWithBump: Ring = [
  p(0, 0),
  p(5, 0.01),
  p(10, 0),
  p(10, 10),
  p(0, 10),
];

const circle = (vertices: number, radius = 10): Ring =>
  Array.from({ length: vertices }, (_, i) => {
    const angle = (2 * Math.PI * i) / vertices;
    return p(radius * Math.cos(angle), radius * Math.sin(angle));
  });

/**
 * A polygon where removing the cheapest vertices folds the boundary over
 * itself. Found by generating random simple polygons and keeping one that
 * breaks the unguarded algorithm.
 */
const foldProne: Ring = [
  p(16.29, 16.6),
  p(15.86, 8.31),
  p(7.55, 1.89),
  p(4.57, 0.68),
  p(5.27, 18.16),
  p(15.12, 16.53),
  p(6.16, 11.31),
  p(12.72, 5.99),
];

describe("ringEffectiveAreas", () => {
  it("measures the triangle each vertex forms with its neighbours", () => {
    expect(ringEffectiveAreas(square)).toEqual([50, 50, 50, 50]);
  });

  it("wraps around the closing vertex", () => {
    const areas = ringEffectiveAreas(squareWithBump);
    expect(areas.length).toBe(5);
    expect(areas[1]).toBeCloseTo(0.05, 9);
  });
});

describe("simplifyRing", () => {
  it("returns the ring untouched when no criterion is given", () => {
    expect(simplifyRing(square)).toBe(square);
  });

  it("drops vertices below the area threshold", () => {
    expect(simplifyRing(squareWithBump, { minArea: 1 })).toEqual(square);
  });

  it("keeps vertices above the area threshold", () => {
    expect(simplifyRing(squareWithBump, { minArea: 0.01 }).length).toBe(5);
  });

  it("reduces to the requested vertex count", () => {
    expect(simplifyRingTo(circle(20), 8).length).toBe(8);
    expect(simplifyRingTo(circle(20), 3).length).toBe(3);
  });

  it("never goes below three vertices", () => {
    expect(simplifyRingTo(circle(12), 1).length).toBe(3);
  });

  it("respects a higher vertex floor", () => {
    expect(simplifyRing(circle(20), { maxVertices: 3, minVertices: 8 }).length).toBe(8);
  });

  it("leaves a ring alone when it is already small enough", () => {
    expect(simplifyRingTo(square, 10)).toEqual(square);
  });

  it("only ever removes vertices, never moves them", () => {
    const source = circle(24);
    const simplified = simplifyRingTo(source, 9);
    const belongs = (point: Point) =>
      source.some((original) => original.x === point.x && original.y === point.y);
    expect(simplified.every(belongs)).toBe(true);
  });

  it("keeps the overall shape close to the original", () => {
    const source = circle(40);
    const simplified = simplifyRingTo(source, 12);
    const ratio = area(simplified) / area(source);
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.05);
  });

  it("applies both criteria together", () => {
    const simplified = simplifyRing(circle(30), { maxVertices: 10, minArea: 1e9 });
    expect(simplified.length).toBe(3);
  });

  it("refuses removals that would fold the ring", () => {
    const unguarded = simplifyRing(foldProne, {
      maxVertices: 6,
      preventSelfIntersection: false,
    });
    expect(isSelfIntersecting(unguarded)).toBe(true);

    const guarded = simplifyRing(foldProne, { maxVertices: 6 });
    expect(isSelfIntersecting(guarded)).toBe(false);
  });

  it("stops early rather than folding, even under pressure", () => {
    const guarded = simplifyRing(foldProne, { maxVertices: 3 });
    expect(isSelfIntersecting(guarded)).toBe(false);
    expect(guarded.length).toBeGreaterThan(2);
  });

  it("keeps every simplification of a star polygon simple", () => {
    let seed = 42;
    const random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

    for (let attempt = 0; attempt < 60; attempt++) {
      const count = 8 + Math.floor(random() * 10);
      const ring: Ring = Array.from({ length: count }, (_, i) => {
        const angle = (2 * Math.PI * i) / count;
        const radius = 2 + random() * 18;
        return p(radius * Math.cos(angle), radius * Math.sin(angle));
      });

      for (const target of [3, 5, 7]) {
        const simplified = simplifyRingTo(ring, target);
        expect(isSelfIntersecting(simplified)).toBe(false);
        expect(simplified.length).toBeGreaterThan(2);
        expect(simplified.length).toBeLessThan(ring.length + 1);
      }
    }
  });
});

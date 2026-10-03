import { describe, expect, it } from "vitest";

import {
  isSelfIntersecting,
  isValidRing,
  validateRing,
  type RingIssue,
} from "../src/validation/ring.js";
import type { Ring } from "../src/types.js";

const p = (x: number, y: number) => ({ x, y });

const square: Ring = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];

const kinds = (ring: Ring, options = {}): RingIssue["kind"][] =>
  validateRing(ring, options).issues.map((issue) => issue.kind);

describe("validateRing", () => {
  it("accepts a plain square", () => {
    expect(validateRing(square).valid).toBe(true);
    expect(validateRing(square).issues).toEqual([]);
  });

  it("accepts a concave ring", () => {
    const l: Ring = [p(0, 0), p(4, 0), p(4, 1), p(1, 1), p(1, 4), p(0, 4)];
    expect(isValidRing(l)).toBe(true);
  });

  it("rejects rings with fewer than three vertices", () => {
    expect(kinds([p(0, 0), p(1, 1)])).toEqual(["too-few-vertices"]);
  });

  it("reports only the vertex count on a degenerate input", () => {
    expect(validateRing([]).issues.length).toBe(1);
  });

  it("flags a repeated closing vertex", () => {
    const closed: Ring = [...square, p(0, 0)];
    expect(kinds(closed)).toContain("closing-vertex-repeated");
  });

  it("flags coincident vertices", () => {
    const ring: Ring = [p(0, 0), p(10, 0), p(10, 0), p(10, 10), p(0, 10)];
    const issues = validateRing(ring).issues;
    const duplicate = issues.find((issue) => issue.kind === "coincident-vertices");
    expect(duplicate?.kind).toBe("coincident-vertices");
  });

  it("flags a bow tie as self-intersecting", () => {
    const bowTie: Ring = [p(0, 0), p(10, 10), p(10, 0), p(0, 10)];
    expect(kinds(bowTie)).toContain("self-intersection");
  });

  it("reports where the self-intersection happens", () => {
    const bowTie: Ring = [p(0, 0), p(10, 10), p(10, 0), p(0, 10)];
    const issue = validateRing(bowTie).issues.find(
      (candidate) => candidate.kind === "self-intersection",
    );
    if (issue?.kind !== "self-intersection") throw new Error("expected a self-intersection");
    expect(issue.at.x).toBeCloseTo(5, 9);
    expect(issue.at.y).toBeCloseTo(5, 9);
  });

  it("does not mistake consecutive edges for a self-intersection", () => {
    expect(kinds(square)).toEqual([]);
  });

  it("flags a spike that doubles back over its own edge", () => {
    const spike: Ring = [p(0, 0), p(10, 0), p(5, 0), p(5, 5)];
    expect(kinds(spike)).toContain("overlapping-edges");
  });

  it("flags collinear vertices as a degenerate area", () => {
    const flat: Ring = [p(0, 0), p(5, 0), p(10, 0), p(3, 0)];
    expect(kinds(flat)).toContain("degenerate-area");
  });

  it("applies the minimum area only to non-degenerate rings", () => {
    const small: Ring = [p(0, 0), p(1, 0), p(1, 1), p(0, 1)];
    expect(kinds(small, { minArea: 10 })).toEqual(["area-below-minimum"]);
    expect(kinds(small, { minArea: 0.5 })).toEqual([]);
  });

  it("applies the vertex limit", () => {
    expect(kinds(square, { maxVertices: 3 })).toContain("too-many-vertices");
    expect(kinds(square, { maxVertices: 4 })).toEqual([]);
  });

  it("uses the tolerance when deciding whether vertices coincide", () => {
    const nearly: Ring = [p(0, 0), p(10, 0), p(10.001, 0.001), p(10, 10), p(0, 10)];
    expect(kinds(nearly, { epsilon: 0.01 })).toContain("coincident-vertices");
    expect(kinds(nearly, { epsilon: 1e-9 })).toEqual([]);
  });

  it("collects several issues at once", () => {
    const bad: Ring = [p(0, 0), p(10, 10), p(10, 0), p(0, 10), p(0, 0)];
    const found = kinds(bad);
    expect(found).toContain("closing-vertex-repeated");
    expect(found).toContain("self-intersection");
  });
});

describe("isSelfIntersecting", () => {
  it("is false for simple rings", () => {
    expect(isSelfIntersecting(square)).toBe(false);
    expect(isSelfIntersecting([p(0, 0), p(4, 0), p(2, 3)])).toBe(false);
  });

  it("is true for a bow tie", () => {
    expect(isSelfIntersecting([p(0, 0), p(10, 10), p(10, 0), p(0, 10)])).toBe(true);
  });

  it("is true for a ring folding back on a far edge", () => {
    const folded: Ring = [p(0, 0), p(10, 0), p(10, 10), p(5, -5), p(0, 10)];
    expect(isSelfIntersecting(folded)).toBe(true);
  });

  it("never reports a triangle", () => {
    expect(isSelfIntersecting([p(0, 0), p(1, 0), p(0, 1)])).toBe(false);
  });
});

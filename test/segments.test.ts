import { describe, expect, it } from "vitest";

import { intersectSegments, segmentsIntersect } from "../src/core/segments.js";

const p = (x: number, y: number) => ({ x, y });

describe("intersectSegments", () => {
  it("finds a proper crossing", () => {
    const result = intersectSegments(p(0, 0), p(10, 10), p(0, 10), p(10, 0));
    expect(result.kind).toBe("point");
    if (result.kind !== "point") return;
    expect(result.proper).toBe(true);
    expect(result.point.x).toBeCloseTo(5, 12);
    expect(result.point.y).toBeCloseTo(5, 12);
  });

  it("reports parallel segments as disjoint", () => {
    expect(intersectSegments(p(0, 0), p(10, 0), p(0, 1), p(10, 1)).kind).toBe("none");
  });

  it("reports segments that would cross only if extended as disjoint", () => {
    expect(intersectSegments(p(0, 0), p(1, 1), p(5, 0), p(6, -1)).kind).toBe("none");
  });

  it("marks a T junction as a non-proper point", () => {
    const result = intersectSegments(p(5, 0), p(5, 5), p(0, 0), p(10, 0));
    expect(result.kind).toBe("point");
    if (result.kind !== "point") return;
    expect(result.proper).toBe(false);
    expect(result.point).toEqual(p(5, 0));
  });

  it("marks a shared endpoint as a non-proper point", () => {
    const result = intersectSegments(p(0, 0), p(5, 5), p(0, 0), p(5, -5));
    expect(result.kind).toBe("point");
    if (result.kind !== "point") return;
    expect(result.proper).toBe(false);
    expect(result.point).toEqual(p(0, 0));
  });

  it("finds the shared stretch of collinear segments", () => {
    const result = intersectSegments(p(0, 0), p(10, 0), p(4, 0), p(20, 0));
    expect(result.kind).toBe("overlap");
    if (result.kind !== "overlap") return;
    expect(result.from.x).toBeCloseTo(4, 12);
    expect(result.to.x).toBeCloseTo(10, 12);
  });

  it("finds the overlap when one segment contains the other", () => {
    const result = intersectSegments(p(2, 0), p(3, 0), p(0, 0), p(10, 0));
    expect(result.kind).toBe("overlap");
    if (result.kind !== "overlap") return;
    expect(result.from.x).toBeCloseTo(2, 12);
    expect(result.to.x).toBeCloseTo(3, 12);
  });

  it("finds the overlap regardless of the direction of the segments", () => {
    const result = intersectSegments(p(10, 0), p(0, 0), p(20, 0), p(4, 0));
    expect(result.kind).toBe("overlap");
    if (result.kind !== "overlap") return;
    expect(Math.min(result.from.x, result.to.x)).toBeCloseTo(4, 12);
    expect(Math.max(result.from.x, result.to.x)).toBeCloseTo(10, 12);
  });

  it("reports collinear segments meeting end to end as a single point", () => {
    const result = intersectSegments(p(0, 0), p(5, 0), p(5, 0), p(9, 0));
    expect(result.kind).toBe("point");
    if (result.kind !== "point") return;
    expect(result.point.x).toBeCloseTo(5, 12);
  });

  it("reports collinear segments that do not touch as disjoint", () => {
    expect(intersectSegments(p(0, 0), p(4, 0), p(6, 0), p(9, 0)).kind).toBe("none");
  });

  it("handles collinear diagonals", () => {
    const result = intersectSegments(p(0, 0), p(4, 4), p(2, 2), p(8, 8));
    expect(result.kind).toBe("overlap");
    if (result.kind !== "overlap") return;
    expect(result.from).toEqual(p(2, 2));
    expect(result.to.x).toBeCloseTo(4, 12);
    expect(result.to.y).toBeCloseTo(4, 12);
  });

  it("treats a zero-length segment as a point", () => {
    expect(intersectSegments(p(5, 0), p(5, 0), p(0, 0), p(10, 0)).kind).toBe("point");
    expect(intersectSegments(p(5, 1), p(5, 1), p(0, 0), p(10, 0)).kind).toBe("none");
  });

  it("handles two coincident zero-length segments", () => {
    expect(intersectSegments(p(1, 1), p(1, 1), p(1, 1), p(1, 1)).kind).toBe("point");
    expect(intersectSegments(p(1, 1), p(1, 1), p(2, 2), p(2, 2)).kind).toBe("none");
  });

  it("uses the tolerance for near misses", () => {
    expect(intersectSegments(p(5, 0.005), p(5, 5), p(0, 0), p(10, 0), 0.01).kind).toBe("point");
    expect(intersectSegments(p(5, 0.005), p(5, 5), p(0, 0), p(10, 0), 1e-9).kind).toBe("none");
  });

  it("is symmetric in its arguments", () => {
    const direct = intersectSegments(p(0, 0), p(10, 10), p(0, 10), p(10, 0));
    const swapped = intersectSegments(p(0, 10), p(10, 0), p(0, 0), p(10, 10));
    expect(direct.kind).toBe(swapped.kind);
    if (direct.kind !== "point" || swapped.kind !== "point") return;
    expect(direct.point.x).toBeCloseTo(swapped.point.x, 12);
    expect(direct.point.y).toBeCloseTo(swapped.point.y, 12);
  });
});

describe("segmentsIntersect", () => {
  it("collapses every kind of contact into a boolean", () => {
    expect(segmentsIntersect(p(0, 0), p(4, 0), p(2, -2), p(2, 2))).toBe(true);
    expect(segmentsIntersect(p(0, 0), p(4, 0), p(6, 0), p(9, 0))).toBe(false);
  });
});

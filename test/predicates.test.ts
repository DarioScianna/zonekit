import { describe, expect, it } from "vitest";

import {
  area,
  containsPoint,
  distanceToSegment,
  isPointOnSegment,
  locatePoint,
  orientation,
  perimeter,
  sideOfLine,
  signedArea,
  withOrientation,
} from "../src/core/predicates.js";
import type { Ring } from "../src/types.js";

const unitSquareCcw: Ring = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const unitSquareCw: Ring = [...unitSquareCcw].reverse();

/** An L shape, to catch tests that silently assume convexity. */
const lShape: Ring = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 4 },
  { x: 0, y: 4 },
];

describe("signedArea", () => {
  it("is positive for a counterclockwise ring", () => {
    expect(signedArea(unitSquareCcw)).toBeCloseTo(1, 12);
  });

  it("is negative for a clockwise ring", () => {
    expect(signedArea(unitSquareCw)).toBeCloseTo(-1, 12);
  });

  it("is zero for rings with fewer than three vertices", () => {
    expect(signedArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });

  it("is unaffected by the starting vertex", () => {
    const rotated: Ring = [...unitSquareCcw.slice(2), ...unitSquareCcw.slice(0, 2)];
    expect(signedArea(rotated)).toBeCloseTo(signedArea(unitSquareCcw), 12);
  });

  it("handles a concave ring", () => {
    expect(area(lShape)).toBeCloseTo(7, 12);
  });
});

describe("perimeter", () => {
  it("includes the closing edge", () => {
    expect(perimeter(unitSquareCcw)).toBeCloseTo(4, 12);
  });
});

describe("orientation", () => {
  it("reports the winding direction", () => {
    expect(orientation(unitSquareCcw)).toBe("ccw");
    expect(orientation(unitSquareCw)).toBe("cw");
  });

  it("reports collinear vertices as degenerate", () => {
    const collinear: Ring = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    expect(orientation(collinear)).toBe("degenerate");
  });

  it("reports a sliver thinner than the tolerance as degenerate", () => {
    const sliver: Ring = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0.001 },
      { x: 0, y: 0.001 },
    ];
    expect(orientation(sliver, 0.01)).toBe("degenerate");
    expect(orientation(sliver, 1e-9)).toBe("ccw");
  });

  it("scales the degeneracy threshold with the ring, not with the coordinates", () => {
    const large: Ring = [
      { x: 0, y: 0 },
      { x: 1_000_000, y: 0 },
      { x: 1_000_000, y: 1_000_000 },
    ];
    expect(orientation(large)).toBe("ccw");
  });
});

describe("withOrientation", () => {
  it("reverses a ring wound the wrong way", () => {
    expect(orientation(withOrientation(unitSquareCw, "ccw"))).toBe("ccw");
  });

  it("returns the same ring when it is already correct", () => {
    expect(withOrientation(unitSquareCcw, "ccw")).toBe(unitSquareCcw);
  });
});

describe("sideOfLine", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };

  it("tells left from right", () => {
    expect(sideOfLine(a, b, { x: 5, y: 3 })).toBe(1);
    expect(sideOfLine(a, b, { x: 5, y: -3 })).toBe(-1);
  });

  it("treats points within the tolerance as collinear", () => {
    expect(sideOfLine(a, b, { x: 5, y: 0.005 }, 0.01)).toBe(0);
    expect(sideOfLine(a, b, { x: 5, y: 0.05 }, 0.01)).toBe(1);
  });

  it("measures the tolerance as a distance, not as a cross product", () => {
    const far = { x: 1_000_000, y: 0 };
    // The cross product here is 5000, but the point is 0.005 from the line.
    expect(sideOfLine(a, far, { x: 5, y: 0.005 }, 0.01)).toBe(0);
  });

  it("returns zero for a degenerate line", () => {
    expect(sideOfLine(a, a, { x: 5, y: 5 })).toBe(0);
  });
});

describe("distanceToSegment", () => {
  it("measures perpendicular distance inside the segment", () => {
    expect(distanceToSegment({ x: 5, y: 2 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(2, 12);
  });

  it("measures distance to the nearest endpoint beyond the segment", () => {
    expect(distanceToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5, 12);
  });

  it("handles a zero-length segment", () => {
    expect(distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5, 12);
  });
});

describe("isPointOnSegment", () => {
  it("accepts endpoints", () => {
    expect(isPointOnSegment({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 4 })).toBe(true);
    expect(isPointOnSegment({ x: 4, y: 4 }, { x: 0, y: 0 }, { x: 4, y: 4 })).toBe(true);
  });

  it("rejects points beyond the endpoints even if collinear", () => {
    expect(isPointOnSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 4, y: 4 })).toBe(false);
  });
});

describe("locatePoint", () => {
  it("finds interior and exterior points", () => {
    expect(locatePoint({ x: 0.5, y: 0.5 }, unitSquareCcw)).toBe("interior");
    expect(locatePoint({ x: 1.5, y: 0.5 }, unitSquareCcw)).toBe("exterior");
  });

  it("reports points on an edge as boundary", () => {
    expect(locatePoint({ x: 0.5, y: 0 }, unitSquareCcw)).toBe("boundary");
  });

  it("reports vertices as boundary", () => {
    expect(locatePoint({ x: 0, y: 0 }, unitSquareCcw)).toBe("boundary");
    expect(locatePoint({ x: 1, y: 1 }, unitSquareCcw)).toBe("boundary");
  });

  it("reports points on the implied closing edge as boundary", () => {
    expect(locatePoint({ x: 0, y: 0.5 }, unitSquareCcw)).toBe("boundary");
  });

  it("does not double count a ray passing exactly through a vertex", () => {
    const diamond: Ring = [
      { x: 0, y: 0 },
      { x: 2, y: -2 },
      { x: 4, y: 0 },
      { x: 2, y: 2 },
    ];
    // y = 0 runs through both the left and the right vertex.
    expect(locatePoint({ x: 2, y: 0 }, diamond)).toBe("interior");
    expect(locatePoint({ x: 5, y: 0 }, diamond)).toBe("exterior");
    expect(locatePoint({ x: -1, y: 0 }, diamond)).toBe("exterior");
  });

  it("handles a ray grazing a local minimum without entering the ring", () => {
    const vShape: Ring = [
      { x: 0, y: 0 },
      { x: 2, y: 4 },
      { x: 4, y: 0 },
      { x: 4, y: 6 },
      { x: 0, y: 6 },
    ];
    expect(locatePoint({ x: 2, y: 2 }, vShape)).toBe("exterior");
    expect(locatePoint({ x: 2, y: 5 }, vShape)).toBe("interior");
  });

  it("gives the same answer whatever the winding direction", () => {
    expect(locatePoint({ x: 0.5, y: 0.5 }, unitSquareCw)).toBe("interior");
  });

  it("respects the tolerance around the boundary", () => {
    expect(locatePoint({ x: 0.5, y: -0.005 }, unitSquareCcw, 0.01)).toBe("boundary");
    expect(locatePoint({ x: 0.5, y: -0.005 }, unitSquareCcw, 1e-9)).toBe("exterior");
  });

  it("works on a concave ring", () => {
    expect(locatePoint({ x: 3, y: 3 }, lShape)).toBe("exterior");
    expect(locatePoint({ x: 0.5, y: 3 }, lShape)).toBe("interior");
    expect(locatePoint({ x: 3, y: 0.5 }, lShape)).toBe("interior");
  });

  it("treats rings with fewer than three vertices as empty", () => {
    expect(locatePoint({ x: 0, y: 0 }, [{ x: 0, y: 0 }])).toBe("exterior");
  });
});

describe("containsPoint", () => {
  it("includes the boundary", () => {
    expect(containsPoint(unitSquareCcw, { x: 0.5, y: 0 })).toBe(true);
    expect(containsPoint(unitSquareCcw, { x: 2, y: 0 })).toBe(false);
  });
});

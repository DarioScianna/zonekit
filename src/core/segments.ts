import { DEFAULT_EPSILON, type Point } from "../types.js";
import { distance, isPointOnSegment, sideOfLine } from "./predicates.js";

/**
 * How two segments meet.
 *
 * The three cases are kept distinct because callers usually care about the
 * difference: two zones sharing a border vertex is legitimate, two zones
 * crossing each other is not, and two zones sharing a stretch of border is a
 * third situation again. A boolean would collapse all three.
 */
export type SegmentIntersection =
  | { readonly kind: "none" }
  | {
      /** The segments meet at a single point. */
      readonly kind: "point";
      readonly point: Point;
      /**
       * True when the crossing happens strictly inside both segments, false
       * when at least one endpoint is involved (a touch or a T junction).
       */
      readonly proper: boolean;
    }
  | {
      /** The segments are collinear and share a stretch of length. */
      readonly kind: "overlap";
      readonly from: Point;
      readonly to: Point;
    };

const NONE: SegmentIntersection = { kind: "none" };

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/** Position of `p` along the line a -> b, where a is 0 and b is 1. */
function projectParameter(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
}

function collinearIntersection(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
  epsilon: number,
): SegmentIntersection {
  const length = distance(b1, b2);
  const epsilonT = epsilon / length;

  const ta1 = projectParameter(a1, b1, b2);
  const ta2 = projectParameter(a2, b1, b2);

  const low = Math.max(Math.min(ta1, ta2), 0);
  const high = Math.min(Math.max(ta1, ta2), 1);

  if (high < low - epsilonT) return NONE;
  if (high - low <= epsilonT) {
    return { kind: "point", point: lerp(b1, b2, low), proper: false };
  }

  return { kind: "overlap", from: lerp(b1, b2, low), to: lerp(b1, b2, high) };
}

function degenerateIntersection(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
  epsilon: number,
): SegmentIntersection | undefined {
  const aIsPoint = distance(a1, a2) <= epsilon;
  const bIsPoint = distance(b1, b2) <= epsilon;

  if (aIsPoint && bIsPoint) {
    return distance(a1, b1) <= epsilon
      ? { kind: "point", point: a1, proper: false }
      : NONE;
  }

  if (aIsPoint) {
    return isPointOnSegment(a1, b1, b2, epsilon)
      ? { kind: "point", point: a1, proper: false }
      : NONE;
  }

  if (bIsPoint) {
    return isPointOnSegment(b1, a1, a2, epsilon)
      ? { kind: "point", point: b1, proper: false }
      : NONE;
  }

  return undefined;
}

/**
 * Intersects the segments `a1`-`a2` and `b1`-`b2`.
 *
 * Zero-length segments are accepted and treated as points, which is what
 * happens in practice when a polygon arrives with two
 * coincident vertices.
 */
export function intersectSegments(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
  epsilon: number = DEFAULT_EPSILON,
): SegmentIntersection {
  const degenerate = degenerateIntersection(a1, a2, b1, b2, epsilon);
  if (degenerate) return degenerate;

  const d1 = sideOfLine(b1, b2, a1, epsilon);
  const d2 = sideOfLine(b1, b2, a2, epsilon);
  const d3 = sideOfLine(a1, a2, b1, epsilon);
  const d4 = sideOfLine(a1, a2, b2, epsilon);

  if (d1 === 0 && d2 === 0) {
    return collinearIntersection(a1, a2, b1, b2, epsilon);
  }

  if (d1 === 0 && isPointOnSegment(a1, b1, b2, epsilon)) {
    return { kind: "point", point: a1, proper: false };
  }
  if (d2 === 0 && isPointOnSegment(a2, b1, b2, epsilon)) {
    return { kind: "point", point: a2, proper: false };
  }
  if (d3 === 0 && isPointOnSegment(b1, a1, a2, epsilon)) {
    return { kind: "point", point: b1, proper: false };
  }
  if (d4 === 0 && isPointOnSegment(b2, a1, a2, epsilon)) {
    return { kind: "point", point: b2, proper: false };
  }

  if (d1 * d2 < 0 && d3 * d4 < 0) {
    const denominator =
      (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
    const t =
      ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) /
      denominator;

    return { kind: "point", point: lerp(a1, a2, t), proper: true };
  }

  return NONE;
}

/** True when the segments meet at all, whatever the kind of contact. */
export function segmentsIntersect(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
  epsilon: number = DEFAULT_EPSILON,
): boolean {
  return intersectSegments(a1, a2, b1, b2, epsilon).kind !== "none";
}

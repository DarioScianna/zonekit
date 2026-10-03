import {
  DEFAULT_EPSILON,
  type Orientation,
  type Point,
  type PointLocation,
  type Ring,
} from "../types.js";

/**
 * Cross product of the vectors (a -> b) and (a -> p).
 *
 * Positive when p lies to the left of the directed line a -> b on a y-up
 * plane, negative on the right, zero when the three points are collinear.
 * Its magnitude grows with the length of a -> b, which is why callers should
 * use {@link sideOfLine} instead of comparing this value against a tolerance.
 */
export function cross(a: Point, b: Point, p: Point): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Shortest distance from `p` to the segment `a`-`b`.
 *
 * A zero-length segment is treated as the single point `a`.
 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return distance(p, a);

  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;
  const clamped = Math.min(1, Math.max(0, t));

  return distance(p, { x: a.x + clamped * dx, y: a.y + clamped * dy });
}

/**
 * Which side of the infinite line through `a` and `b` the point `p` is on.
 *
 * Returns 1 for left, -1 for right and 0 when p is within `epsilon` of the
 * line. The comparison is done on the perpendicular distance, so `epsilon`
 * keeps its meaning regardless of how long the segment is.
 *
 * A degenerate line (a equal to b) has no sides and always returns 0.
 */
export function sideOfLine(
  a: Point,
  b: Point,
  p: Point,
  epsilon: number = DEFAULT_EPSILON,
): -1 | 0 | 1 {
  const length = distance(a, b);
  if (length === 0) return 0;

  const perpendicular = cross(a, b, p) / length;
  if (Math.abs(perpendicular) <= epsilon) return 0;

  return perpendicular > 0 ? 1 : -1;
}

/** True when `p` lies on the segment `a`-`b`, endpoints included. */
export function isPointOnSegment(
  p: Point,
  a: Point,
  b: Point,
  epsilon: number = DEFAULT_EPSILON,
): boolean {
  return distanceToSegment(p, a, b) <= epsilon;
}

/**
 * Twice the signed area of a ring (the raw shoelace sum).
 *
 * Kept separate from {@link signedArea} because the doubled value is exact for
 * integer coordinates, which makes it a better building block internally.
 */
export function doubledSignedArea(ring: Ring): number {
  if (ring.length < 3) return 0;

  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j]!.x - ring[i]!.x) * (ring[j]!.y + ring[i]!.y);
  }

  return sum;
}

/** Signed area of a ring: positive when counterclockwise on a y-up plane. */
export function signedArea(ring: Ring): number {
  return doubledSignedArea(ring) / 2;
}

/** Absolute area of a ring. */
export function area(ring: Ring): number {
  return Math.abs(signedArea(ring));
}

/** Length of the closed boundary of a ring. */
export function perimeter(ring: Ring): number {
  if (ring.length < 2) return 0;

  let total = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    total += distance(ring[j]!, ring[i]!);
  }

  return total;
}

/**
 * Winding direction of a ring.
 *
 * A ring counts as degenerate when its area is small compared to its own
 * boundary: the threshold is `epsilon * perimeter / 2`, which is the area
 * swept by moving the whole boundary sideways by `epsilon`. That keeps the
 * result scale-independent, so a long thin sliver is reported as degenerate
 * for the same reason a tiny triangle is.
 */
export function orientation(
  ring: Ring,
  epsilon: number = DEFAULT_EPSILON,
): Orientation {
  if (ring.length < 3) return "degenerate";

  const signed = signedArea(ring);
  const threshold = (epsilon * perimeter(ring)) / 2;

  if (Math.abs(signed) <= threshold) return "degenerate";

  return signed > 0 ? "ccw" : "cw";
}

/** Returns the ring wound in the requested direction, reversing it if needed. */
export function withOrientation(
  ring: Ring,
  wanted: Exclude<Orientation, "degenerate">,
  epsilon: number = DEFAULT_EPSILON,
): Ring {
  const current = orientation(ring, epsilon);
  if (current === "degenerate" || current === wanted) return ring;

  return [...ring].reverse();
}

/**
 * Locates a point relative to a ring.
 *
 * Boundary hits are resolved first, so a point lying on an edge or exactly on
 * a vertex is never misreported as interior or exterior. The interior test is
 * a ray cast using the half-open rule on each edge, which counts a vertex
 * touched by the ray once rather than twice.
 *
 * Self-intersecting rings are evaluated with the even-odd rule.
 */
export function locatePoint(
  p: Point,
  ring: Ring,
  epsilon: number = DEFAULT_EPSILON,
): PointLocation {
  if (ring.length < 3) return "exterior";

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if (isPointOnSegment(p, ring[j]!, ring[i]!, epsilon)) return "boundary";
  }

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j]!;
    const b = ring[i]!;

    if (a.y > p.y !== b.y > p.y) {
      const crossingX = a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x);
      if (p.x < crossingX) inside = !inside;
    }
  }

  return inside ? "interior" : "exterior";
}

/** Convenience wrapper: true when the point is inside or on the boundary. */
export function containsPoint(
  ring: Ring,
  p: Point,
  epsilon: number = DEFAULT_EPSILON,
): boolean {
  return locatePoint(p, ring, epsilon) !== "exterior";
}

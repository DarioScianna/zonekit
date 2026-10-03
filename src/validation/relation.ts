import { DEFAULT_EPSILON, type Point, type Ring } from "../types.js";
import { locatePoint } from "../core/predicates.js";
import { intersectSegments } from "../core/segments.js";

/**
 * How two rings sit relative to each other.
 *
 * "touching" and "overlapping" are kept apart on purpose: two zones that
 * share a border are usually fine, two zones whose interiors overlap are
 * usually a mistake. Collapsing both into "they intersect"
 * throws away the only distinction the caller cares about.
 */
export type RingRelation =
  | "disjoint"
  | "touching"
  | "overlapping"
  | "a-contains-b"
  | "b-contains-a"
  | "identical";

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Vertices plus edge midpoints.
 *
 * Vertices alone are not enough: a small square sharing a whole edge with a
 * large one has every vertex either on the boundary or outside, and the
 * midpoints are what reveal whether it actually goes inside.
 */
function samplePoints(ring: Ring): Point[] {
  const samples: Point[] = [];

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    samples.push(ring[i]!);
    samples.push(midpoint(ring[j]!, ring[i]!));
  }

  return samples;
}

interface Coverage {
  readonly hasInterior: boolean;
  readonly hasExterior: boolean;
}

function coverageOf(subject: Ring, against: Ring, epsilon: number): Coverage {
  let hasInterior = false;
  let hasExterior = false;

  for (const point of samplePoints(subject)) {
    const location = locatePoint(point, against, epsilon);
    if (location === "interior") hasInterior = true;
    else if (location === "exterior") hasExterior = true;
    if (hasInterior && hasExterior) break;
  }

  return { hasInterior, hasExterior };
}

interface BoundaryContact {
  readonly touches: boolean;
  readonly crosses: boolean;
}

function boundaryContact(a: Ring, b: Ring, epsilon: number): BoundaryContact {
  let touches = false;

  for (let i = 0; i < a.length; i++) {
    const a1 = a[i]!;
    const a2 = a[(i + 1) % a.length]!;

    for (let j = 0; j < b.length; j++) {
      const b1 = b[j]!;
      const b2 = b[(j + 1) % b.length]!;
      const hit = intersectSegments(a1, a2, b1, b2, epsilon);

      if (hit.kind === "none") continue;
      if (hit.kind === "point" && hit.proper) return { touches: true, crosses: true };
      touches = true;
    }
  }

  return { touches, crosses: false };
}

/**
 * Classifies how ring `a` and ring `b` are positioned.
 *
 * Both rings are assumed to be simple (non self-intersecting): run
 * {@link validateRing} first if that is not guaranteed. The result is
 * symmetric apart from the two containment cases, which name their rings.
 */
export function relateRings(
  a: Ring,
  b: Ring,
  epsilon: number = DEFAULT_EPSILON,
): RingRelation {
  if (a.length < 3 || b.length < 3) return "disjoint";

  const contact = boundaryContact(a, b, epsilon);
  if (contact.crosses) return "overlapping";

  const bInsideA = coverageOf(b, a, epsilon);
  const aInsideB = coverageOf(a, b, epsilon);

  // A boundary can also be crossed exactly through a vertex, which is a touch
  // edge by edge. Mixed coverage is what catches those cases.
  if (bInsideA.hasInterior && bInsideA.hasExterior) return "overlapping";
  if (aInsideB.hasInterior && aInsideB.hasExterior) return "overlapping";

  if (bInsideA.hasInterior) return "a-contains-b";
  if (aInsideB.hasInterior) return "b-contains-a";

  if (!bInsideA.hasExterior && !aInsideB.hasExterior) return "identical";

  return contact.touches ? "touching" : "disjoint";
}

/**
 * True when `inner` lies entirely within `outer`, sharing a border allowed.
 *
 * This is the outer-boundary check: a zone may run along the edge, it may not
 * poke through it.
 */
export function ringContainsRing(
  outer: Ring,
  inner: Ring,
  epsilon: number = DEFAULT_EPSILON,
): boolean {
  const relation = relateRings(outer, inner, epsilon);
  return relation === "a-contains-b" || relation === "identical";
}

/** True when the interiors of the two rings share any area. */
export function ringsOverlap(
  a: Ring,
  b: Ring,
  epsilon: number = DEFAULT_EPSILON,
): boolean {
  const relation = relateRings(a, b, epsilon);
  return relation !== "disjoint" && relation !== "touching";
}

/**
 * Checks a candidate ring against the ones already placed.
 *
 * Returns the index of every existing ring the candidate is not allowed to
 * coexist with, which the caller can use to highlight the offenders instead
 * of just refusing the edit.
 */
export function conflictingRings(
  candidate: Ring,
  existing: readonly Ring[],
  options: { readonly epsilon?: number; readonly allowTouching?: boolean } = {},
): number[] {
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const allowTouching = options.allowTouching ?? false;
  const conflicts: number[] = [];

  existing.forEach((other, index) => {
    const relation = relateRings(candidate, other, epsilon);
    if (relation === "disjoint") return;
    if (relation === "touching" && allowTouching) return;
    conflicts.push(index);
  });

  return conflicts;
}

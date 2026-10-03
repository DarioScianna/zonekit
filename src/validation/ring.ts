import {
  DEFAULT_EPSILON,
  type Point,
  type Ring,
} from "../types.js";
import { area, distance, orientation } from "../core/predicates.js";
import { intersectSegments } from "../core/segments.js";

/**
 * A single reason why a ring is not usable as a zone.
 *
 * Issues are data rather than thrown errors, because an editor needs to show
 * the user what is wrong and where, not just that something is.
 */
export type RingIssue =
  | { readonly kind: "too-few-vertices"; readonly count: number }
  | { readonly kind: "too-many-vertices"; readonly count: number; readonly maximum: number }
  /** The first vertex is repeated at the end: rings are closed implicitly. */
  | { readonly kind: "closing-vertex-repeated" }
  | { readonly kind: "coincident-vertices"; readonly indices: readonly [number, number] }
  | {
      readonly kind: "self-intersection";
      readonly edges: readonly [number, number];
      readonly at: Point;
    }
  /** Two edges run along each other instead of merely touching. */
  | { readonly kind: "overlapping-edges"; readonly edges: readonly [number, number] }
  /** The ring encloses no meaningful area: all vertices are effectively collinear. */
  | { readonly kind: "degenerate-area"; readonly area: number }
  | { readonly kind: "area-below-minimum"; readonly area: number; readonly minimum: number };

export interface ValidateRingOptions {
  /** Distance below which two positions count as the same. */
  readonly epsilon?: number;
  /** Reject rings enclosing less than this area, in squared coordinate units. */
  readonly minArea?: number;
  /** Reject rings with more than this many vertices. */
  readonly maxVertices?: number;
}

export interface RingValidation {
  readonly valid: boolean;
  readonly issues: readonly RingIssue[];
}

/** Edge `i` of a ring runs from vertex `i` to vertex `i + 1`, wrapping around. */
function edgeAt(ring: Ring, index: number): readonly [Point, Point] {
  return [ring[index]!, ring[(index + 1) % ring.length]!];
}

function areEdgesAdjacent(i: number, j: number, edgeCount: number): boolean {
  return j === i + 1 || (i === 0 && j === edgeCount - 1);
}

/**
 * Checks a ring against the rules a zone has to satisfy.
 *
 * The checks are ordered from structural to geometric, and the geometric ones
 * are skipped when the structure already makes them meaningless: reporting a
 * self-intersection on a two-vertex ring would only bury the real problem.
 */
export function validateRing(
  ring: Ring,
  options: ValidateRingOptions = {},
): RingValidation {
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const issues: RingIssue[] = [];

  if (ring.length < 3) {
    return { valid: false, issues: [{ kind: "too-few-vertices", count: ring.length }] };
  }

  if (options.maxVertices !== undefined && ring.length > options.maxVertices) {
    issues.push({
      kind: "too-many-vertices",
      count: ring.length,
      maximum: options.maxVertices,
    });
  }

  if (distance(ring[0]!, ring[ring.length - 1]!) <= epsilon) {
    issues.push({ kind: "closing-vertex-repeated" });
  }

  for (let i = 0; i < ring.length; i++) {
    for (let j = i + 1; j < ring.length; j++) {
      if (i === 0 && j === ring.length - 1) continue; // already reported above
      if (distance(ring[i]!, ring[j]!) <= epsilon) {
        issues.push({ kind: "coincident-vertices", indices: [i, j] });
      }
    }
  }

  const edgeCount = ring.length;
  for (let i = 0; i < edgeCount; i++) {
    for (let j = i + 1; j < edgeCount; j++) {
      const [a1, a2] = edgeAt(ring, i);
      const [b1, b2] = edgeAt(ring, j);
      const hit = intersectSegments(a1, a2, b1, b2, epsilon);

      if (hit.kind === "none") continue;

      if (hit.kind === "overlap") {
        issues.push({ kind: "overlapping-edges", edges: [i, j] });
        continue;
      }

      // Consecutive edges are supposed to meet at their shared vertex.
      if (areEdgesAdjacent(i, j, edgeCount)) continue;

      issues.push({ kind: "self-intersection", edges: [i, j], at: hit.point });
    }
  }

  const enclosed = area(ring);
  if (orientation(ring, epsilon) === "degenerate") {
    issues.push({ kind: "degenerate-area", area: enclosed });
  } else if (options.minArea !== undefined && enclosed < options.minArea) {
    issues.push({ kind: "area-below-minimum", area: enclosed, minimum: options.minArea });
  }

  return { valid: issues.length === 0, issues };
}

/** True when the ring passes every check. */
export function isValidRing(ring: Ring, options: ValidateRingOptions = {}): boolean {
  return validateRing(ring, options).valid;
}

/**
 * True when the ring crosses itself.
 *
 * Cheaper than a full validation when that is the only question, and it is
 * the check {@link simplifyRing} runs while removing vertices.
 */
export function isSelfIntersecting(
  ring: Ring,
  epsilon: number = DEFAULT_EPSILON,
): boolean {
  if (ring.length < 4) return false;

  const edgeCount = ring.length;
  for (let i = 0; i < edgeCount; i++) {
    for (let j = i + 1; j < edgeCount; j++) {
      const [a1, a2] = edgeAt(ring, i);
      const [b1, b2] = edgeAt(ring, j);
      const hit = intersectSegments(a1, a2, b1, b2, epsilon);

      if (hit.kind === "none") continue;
      if (hit.kind === "overlap") return true;
      if (!areEdgesAdjacent(i, j, edgeCount)) return true;
    }
  }

  return false;
}

/** Human-readable one-liner for an issue, handy in demos and error messages. */
export function describeIssue(issue: RingIssue): string {
  switch (issue.kind) {
    case "too-few-vertices":
      return `a zone needs at least 3 vertices, this one has ${issue.count}`;
    case "too-many-vertices":
      return `${issue.count} vertices, the limit is ${issue.maximum}`;
    case "closing-vertex-repeated":
      return "the first vertex is repeated at the end: rings are closed implicitly";
    case "coincident-vertices":
      return `vertices ${issue.indices[0]} and ${issue.indices[1]} are in the same place`;
    case "self-intersection":
      return `edges ${issue.edges[0]} and ${issue.edges[1]} cross each other`;
    case "overlapping-edges":
      return `edges ${issue.edges[0]} and ${issue.edges[1]} run along each other`;
    case "degenerate-area":
      return "the outline encloses no area";
    case "area-below-minimum":
      return `area ${issue.area.toFixed(2)} is below the minimum of ${issue.minimum}`;
  }
}

import { DEFAULT_EPSILON, type Point, type Ring } from "../types.js";
import { cross } from "../core/predicates.js";
import { isSelfIntersecting } from "../validation/ring.js";

export interface SimplifyRingOptions {
  /**
   * Remove vertices whose effective area is below this value, in squared
   * coordinate units. With metres, `minArea: 5` drops any vertex whose
   * removal moves the boundary by less than five square metres.
   */
  readonly minArea?: number;
  /** Keep removing vertices until at most this many remain. */
  readonly maxVertices?: number;
  /** Never go below this many vertices. Defaults to 3. */
  readonly minVertices?: number;
  readonly epsilon?: number;
  /**
   * Skip any removal that would make the ring cross itself. Defaults to true.
   *
   * Visvalingam-Whyatt has no built-in notion of topology: on a concave shape
   * it will happily fold one part of the boundary through another. For a zone
   * that then fails validation, so the safe behaviour is the default one.
   */
  readonly preventSelfIntersection?: boolean;
}

/**
 * Effective area of every vertex: the area of the triangle it forms with its
 * two neighbours, which is what the vertex would cost if removed.
 *
 * Neighbours wrap around, since the ring is closed.
 */
export function ringEffectiveAreas(ring: Ring): number[] {
  const areas: number[] = [];

  for (let i = 0; i < ring.length; i++) {
    const previous = ring[(i - 1 + ring.length) % ring.length]!;
    const current = ring[i]!;
    const next = ring[(i + 1) % ring.length]!;
    areas.push(Math.abs(cross(previous, next, current)) / 2);
  }

  return areas;
}

function without(vertices: readonly Point[], index: number): Point[] {
  return vertices.filter((_, i) => i !== index);
}

/**
 * Simplifies a closed ring with the Visvalingam-Whyatt algorithm.
 *
 * Vertices are removed one at a time, cheapest first, and the effective areas
 * of the neighbours are recomputed after each removal, so the cost of a vertex
 * always reflects the shape as it stands rather than as it started.
 *
 * Complexity is O(n²) without topology checks and O(n³) with them. That is a
 * deliberate trade: zones are edited by hand and rarely exceed a few dozen
 * vertices, and the checks are what keep the output valid.
 *
 * Returns the ring unchanged when no option asks for a removal.
 */
export function simplifyRing(
  ring: Ring,
  options: SimplifyRingOptions = {},
): Ring {
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const minVertices = Math.max(3, options.minVertices ?? 3);
  const preventSelfIntersection = options.preventSelfIntersection ?? true;

  if (options.minArea === undefined && options.maxVertices === undefined) {
    return ring;
  }

  let vertices: Point[] = [...ring];

  while (vertices.length > minVertices) {
    const areas = ringEffectiveAreas(vertices);
    const order = areas
      .map((value, index) => ({ value, index }))
      .sort((left, right) => left.value - right.value);

    const overBudget =
      options.maxVertices !== undefined && vertices.length > options.maxVertices;

    let removed = false;

    for (const candidate of order) {
      const withinThreshold =
        options.minArea !== undefined && candidate.value < options.minArea;

      if (!overBudget && !withinThreshold) break;

      const reduced = without(vertices, candidate.index);
      if (preventSelfIntersection && isSelfIntersecting(reduced, epsilon)) {
        continue;
      }

      vertices = reduced;
      removed = true;
      break;
    }

    if (!removed) break;
  }

  return vertices;
}

/** Convenience wrapper for the common "fit within N vertices" case. */
export function simplifyRingTo(
  ring: Ring,
  maxVertices: number,
  options: Omit<SimplifyRingOptions, "maxVertices"> = {},
): Ring {
  return simplifyRing(ring, { ...options, maxVertices });
}

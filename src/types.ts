/**
 * A point on a cartesian plane.
 *
 * Coordinates are unitless as far as this library is concerned: metres, pixels
 * or projected map units all work, as long as x and y share the same unit.
 * Geographic coordinates must be projected first (see the `geo` module).
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * A linear ring: an implicitly closed sequence of vertices.
 *
 * The closing edge from the last vertex back to the first is implied, so the
 * first vertex must NOT be repeated at the end. A valid ring has at least
 * three vertices.
 */
export type Ring = readonly Point[];

/** Winding direction of a ring, on a y-up plane. */
export type Orientation = "cw" | "ccw" | "degenerate";

/** Where a point sits relative to a ring. */
export type PointLocation = "interior" | "boundary" | "exterior";

/**
 * Default tolerance, expressed as a distance in coordinate units.
 *
 * Every predicate in this library takes an `epsilon` that means "two things
 * closer than this are treated as coincident". It is deliberately a distance
 * and never a raw cross-product value, so the caller can reason about it:
 * with coordinates in metres, `epsilon = 0.01` means one centimetre.
 */
export const DEFAULT_EPSILON = 1e-9;

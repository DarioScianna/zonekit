import type { Point, Ring } from "../types.js";

/** A geographic position in degrees. */
export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

/** Converts between geographic positions and a local plane in metres. */
export interface Projection {
  /** The point the plane is centred on, which maps to (0, 0). */
  readonly origin: LatLon;
  toPlane(position: LatLon): Point;
  toLatLon(point: Point): LatLon;
}

/** Mean Earth radius in metres (IUGG). */
const EARTH_RADIUS = 6_371_008.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * Builds an equirectangular projection centred on `origin`, in metres.
 *
 * Everything else in this library is planar, because the geometry only works
 * if x and y share a unit: one degree of longitude is not one degree of
 * latitude anywhere except the equator, so comparing them directly quietly
 * distorts every area and every angle.
 *
 * The approximation is good to well under a metre within a few kilometres of
 * the origin, which covers the case this exists for: one local area. It is not
 * meant for country-scale data, and it does not handle the antimeridian.
 */
export function localProjection(origin: LatLon): Projection {
  const latitudeScale = EARTH_RADIUS;
  const longitudeScale = EARTH_RADIUS * Math.cos(toRadians(origin.lat));

  return {
    origin,
    toPlane(position: LatLon): Point {
      return {
        x: toRadians(position.lon - origin.lon) * longitudeScale,
        y: toRadians(position.lat - origin.lat) * latitudeScale,
      };
    },
    toLatLon(point: Point): LatLon {
      return {
        lat: origin.lat + toDegrees(point.y / latitudeScale),
        lon:
          longitudeScale === 0
            ? origin.lon
            : origin.lon + toDegrees(point.x / longitudeScale),
      };
    },
  };
}

/** Average of a set of positions, useful as a projection origin. */
export function meanPosition(positions: readonly LatLon[]): LatLon {
  if (positions.length === 0) {
    throw new Error("meanPosition needs at least one position");
  }

  let lat = 0;
  let lon = 0;
  for (const position of positions) {
    lat += position.lat;
    lon += position.lon;
  }

  return { lat: lat / positions.length, lon: lon / positions.length };
}

/** Builds a projection centred on the given positions. */
export function projectionFor(positions: readonly LatLon[]): Projection {
  return localProjection(meanPosition(positions));
}

/** Projects a geographic ring onto the plane. */
export function toPlaneRing(
  positions: readonly LatLon[],
  projection: Projection,
): Ring {
  return positions.map((position) => projection.toPlane(position));
}

/** Brings a planar ring back to geographic coordinates. */
export function toLatLonRing(
  ring: Ring,
  projection: Projection,
): LatLon[] {
  return ring.map((point) => projection.toLatLon(point));
}

/** Great-circle distance in metres, for sanity checks against the plane. */
export function haversineDistance(a: LatLon, b: LatLon): number {
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLon = toRadians(b.lon - a.lon);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

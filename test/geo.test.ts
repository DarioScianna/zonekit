import { describe, expect, it } from "vitest";

import {
  haversineDistance,
  localProjection,
  meanPosition,
  projectionFor,
  toLatLonRing,
  toPlaneRing,
  type LatLon,
} from "../src/geo/projection.js";
import { area, distance } from "../src/core/predicates.js";

const origin: LatLon = { lat: 45, lon: 9 };

describe("localProjection", () => {
  const projection = localProjection(origin);

  it("puts the origin at zero", () => {
    expect(projection.toPlane(origin)).toEqual({ x: 0, y: 0 });
  });

  it("returns metres on the north axis", () => {
    // One thousandth of a degree of latitude is about 111 m everywhere.
    const north = projection.toPlane({ lat: origin.lat + 0.001, lon: origin.lon });
    expect(north.y).toBeCloseTo(111.19, 1);
    expect(north.x).toBeCloseTo(0, 9);
  });

  it("shrinks longitude by the cosine of the latitude", () => {
    const east = projection.toPlane({ lat: origin.lat, lon: origin.lon + 0.001 });
    const expected = 111.19 * Math.cos((origin.lat * Math.PI) / 180);
    expect(east.x).toBeCloseTo(expected, 1);
  });

  it("agrees with the great-circle distance over a few hundred metres", () => {
    const corner: LatLon = { lat: origin.lat + 0.004, lon: origin.lon + 0.006 };
    const planar = distance({ x: 0, y: 0 }, projection.toPlane(corner));
    const geodesic = haversineDistance(origin, corner);
    expect(Math.abs(planar - geodesic) / geodesic).toBeLessThan(0.001);
  });

  it("round-trips a position", () => {
    const position: LatLon = { lat: origin.lat - 0.0123, lon: origin.lon + 0.0456 };
    const back = projection.toLatLon(projection.toPlane(position));
    expect(back.lat).toBeCloseTo(position.lat, 9);
    expect(back.lon).toBeCloseTo(position.lon, 9);
  });

  it("gives a plausible area for a small geographic square", () => {
    const side = 0.0009; // roughly 100 m of latitude
    const corners: LatLon[] = [
      { lat: origin.lat, lon: origin.lon },
      { lat: origin.lat, lon: origin.lon + side / Math.cos((origin.lat * Math.PI) / 180) },
      {
        lat: origin.lat + side,
        lon: origin.lon + side / Math.cos((origin.lat * Math.PI) / 180),
      },
      { lat: origin.lat + side, lon: origin.lon },
    ];

    const planar = area(toPlaneRing(corners, projection));
    expect(planar).toBeGreaterThan(9_800);
    expect(planar).toBeLessThan(10_200);
  });

  it("survives the poles without dividing by zero", () => {
    const polar = localProjection({ lat: 90, lon: 0 });
    const back = polar.toLatLon(polar.toPlane({ lat: 89.99, lon: 30 }));
    expect(Number.isFinite(back.lat)).toBe(true);
    expect(Number.isFinite(back.lon)).toBe(true);
  });
});

describe("meanPosition", () => {
  it("averages the positions", () => {
    const mean = meanPosition([
      { lat: 44, lon: 8 },
      { lat: 46, lon: 10 },
    ]);
    expect(mean.lat).toBeCloseTo(45, 9);
    expect(mean.lon).toBeCloseTo(9, 9);
  });

  it("rejects an empty list", () => {
    expect(() => meanPosition([])).toThrow();
  });
});

describe("projectionFor", () => {
  it("centres the plane on the data", () => {
    const corners: LatLon[] = [
      { lat: 44.4, lon: 8.9 },
      { lat: 44.5, lon: 8.9 },
      { lat: 44.5, lon: 9.0 },
      { lat: 44.4, lon: 9.0 },
    ];

    const projection = projectionFor(corners);
    const plane = toPlaneRing(corners, projection);
    const back = toLatLonRing(plane, projection);

    corners.forEach((corner, index) => {
      expect(back[index]!.lat).toBeCloseTo(corner.lat, 9);
      expect(back[index]!.lon).toBeCloseTo(corner.lon, 9);
    });
  });
});

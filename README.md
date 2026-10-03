# zonekit

Small TypeScript library for checking polygons ("zones"): validation, overlap
and containment, simplification. No dependencies.

I needed to answer a few questions about hand-drawn polygons: does it cross
itself, is it inside a given boundary, does it overlap the one next to it, can I
drop some points without breaking any of that. This is the code that does it,
pulled out into its own package.

There's a [playground](https://darioscianna.github.io/zonekit/) where you can
draw two zones and see what the functions return.

```bash
npm install @darioscianna/zonekit
```

```ts
import { relateRings, ringContainsRing, simplifyRing, validateRing } from "@darioscianna/zonekit";

const bounds = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 80 },
  { x: 0, y: 80 },
];

const zone = [
  { x: 10, y: 10 },
  { x: 60, y: 12 },
  { x: 62, y: 45 },
  { x: 12, y: 44 },
];

validateRing(zone, { minArea: 25 });   // { valid: true, issues: [] }
ringContainsRing(bounds, zone);          // true
relateRings(zone, otherZone);          // "touching"
simplifyRing(zone, { maxVertices: 3 }); // drops the cheapest vertex
```

## Why not turf.js?

If you need a full GIS toolbox, use [turf](https://turfjs.org/),
[polygon-clipping](https://github.com/mfogel/polygon-clipping) or
[simplify-js](https://mourner.github.io/simplify-js/). This does less, but a few
things work differently:

- `relateRings` tells apart polygons that only share a border (`touching`) from
  ones that actually overlap. For my use case the first is fine and the second
  is an error, and a boolean "intersects" doesn't say which.
- `simplifyRing` won't fold the outline through itself (plain Visvalingam-Whyatt
  can, on concave shapes). You can turn the check off.
- Validation returns a list of issues with vertex/edge indices instead of
  throwing, so a UI can highlight what's wrong.
- `epsilon` is always a distance in your coordinate units, not a raw
  cross-product threshold.
- ~700 lines, ESM, strict TS, no deps.

## Concepts

**Rings are closed implicitly.** A ring is a list of vertices where the edge from
the last back to the first is implied. Do not repeat the first vertex at the end;
`validateRing` will tell you if you did. This differs from GeoJSON, which
requires the repeat.

**The plane is cartesian and y-up.** `signedArea` is positive counterclockwise.
Coordinates carry whatever unit you give them, as long as x and y share it.

**Geography is projected, not assumed.** A degree of longitude is not a degree of
latitude anywhere but the equator, so comparing them directly distorts every area
and angle. Project first:

```ts
import { projectionFor, toPlaneRing, validateRing } from "@darioscianna/zonekit";

const projection = projectionFor(positions);      // local plane in metres
const ring = toPlaneRing(positions, projection);
validateRing(ring, { epsilon: 0.05, minArea: 10 }); // 5 cm, 10 m²
```

The projection is equirectangular around a local origin: accurate to well under
a metre over a few kilometres, not meant for country-scale data, and it does not
handle the antimeridian.

## API

### Predicates

| Function | Purpose |
| --- | --- |
| `signedArea`, `area`, `perimeter` | Ring measurements |
| `orientation`, `withOrientation` | Winding direction, and normalising it |
| `sideOfLine`, `cross` | Which side of a line a point falls on |
| `distance`, `distanceToSegment`, `isPointOnSegment` | Distances |
| `locatePoint`, `containsPoint` | `interior`, `boundary` or `exterior` |
| `intersectSegments`, `segmentsIntersect` | `none`, `point` (with `proper`) or `overlap` |

### Validation

| Function | Purpose |
| --- | --- |
| `validateRing(ring, options)` | Full check, returns `{ valid, issues }` |
| `isValidRing`, `isSelfIntersecting` | Boolean shortcuts |
| `describeIssue(issue)` | One-line message for an issue |

Options: `epsilon`, `minArea`, `maxVertices`. Issues cover too few or too many
vertices, a repeated closing vertex, coincident vertices, self-intersections
(with the crossing point), overlapping edges, a degenerate outline and an area
below the minimum.

### Relations

| Function | Purpose |
| --- | --- |
| `relateRings(a, b)` | `disjoint`, `touching`, `overlapping`, `a-contains-b`, `b-contains-a`, `identical` |
| `ringContainsRing(outer, inner)` | Inside an outer boundary, shared border allowed |
| `ringsOverlap(a, b)` | Interiors share area |
| `conflictingRings(candidate, existing, options)` | Indices of the zones a new one collides with |

Both rings are assumed to be simple. Validate first if that is not guaranteed.

### Simplification

| Function | Purpose |
| --- | --- |
| `simplifyRing(ring, options)` | Visvalingam-Whyatt on a closed ring |
| `simplifyRingTo(ring, maxVertices)` | The common case |
| `ringEffectiveAreas(ring)` | What each vertex costs, useful for visualising |

Options: `minArea`, `maxVertices`, `minVertices` (floor, default 3), `epsilon`
and `preventSelfIntersection` (default `true`). With the guard on, a removal that
would fold the outline is skipped and the next cheapest vertex is tried; if every
candidate would fold, simplification stops early rather than returning a broken
ring.

### Geography

`localProjection`, `projectionFor`, `meanPosition`, `toPlaneRing`,
`toLatLonRing`, `haversineDistance`.

## Development

```bash
npm install
npm test          # vitest
npm run typecheck
npm run build     # dist/, ESM + .d.ts
npm run serve     # builds the playground and serves docs/ on localhost:3000
```

The demo in `docs/` imports the compiled library from `docs/lib`, which is built
by the Pages workflow and ignored in git.

## Notes on complexity

Validation and relations are O(n·m) over edges, and simplification is O(n²), or
O(n³) with the fold guard. Zones are drawn by hand and rarely pass a few dozen
vertices, so the cost buys correctness where it matters. If you need this on
geometry with thousands of vertices, an index over the edges is the first thing
to add.

## License

MIT

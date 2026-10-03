export {
  DEFAULT_EPSILON,
  type Orientation,
  type Point,
  type PointLocation,
  type Ring,
} from "./types.js";

export {
  area,
  containsPoint,
  cross,
  distance,
  distanceToSegment,
  doubledSignedArea,
  isPointOnSegment,
  locatePoint,
  orientation,
  perimeter,
  sideOfLine,
  signedArea,
  withOrientation,
} from "./core/predicates.js";

export {
  intersectSegments,
  segmentsIntersect,
  type SegmentIntersection,
} from "./core/segments.js";

export {
  describeIssue,
  isSelfIntersecting,
  isValidRing,
  validateRing,
  type RingIssue,
  type RingValidation,
  type ValidateRingOptions,
} from "./validation/ring.js";

export {
  conflictingRings,
  relateRings,
  ringContainsRing,
  ringsOverlap,
  type RingRelation,
} from "./validation/relation.js";

export {
  ringEffectiveAreas,
  simplifyRing,
  simplifyRingTo,
  type SimplifyRingOptions,
} from "./simplify/visvalingam.js";

export {
  haversineDistance,
  localProjection,
  meanPosition,
  projectionFor,
  toLatLonRing,
  toPlaneRing,
  type LatLon,
  type Projection,
} from "./geo/projection.js";

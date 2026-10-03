import {
  area,
  describeIssue,
  relateRings,
  ringContainsRing,
  ringEffectiveAreas,
  simplifyRing,
  validateRing,
} from "./lib/index.js";

const WORLD = { width: 800, height: 520 };
const BOUNDS = [
  { x: 40, y: 40 },
  { x: 760, y: 40 },
  { x: 760, y: 480 },
  { x: 40, y: 480 },
];

const EPSILON = 0.5;
const HANDLE_RADIUS = 7;

const startingZones = {
  a: [
    { x: 150, y: 120 },
    { x: 300, y: 100 },
    { x: 360, y: 190 },
    { x: 330, y: 300 },
    { x: 220, y: 330 },
    { x: 140, y: 260 },
    { x: 120, y: 190 },
  ],
  b: [
    { x: 420, y: 200 },
    { x: 600, y: 160 },
    { x: 660, y: 300 },
    { x: 520, y: 380 },
    { x: 430, y: 310 },
  ],
};

const canvas = document.getElementById("board");
const context = canvas.getContext("2d");

const elements = {
  pickA: document.getElementById("pick-a"),
  pickB: document.getElementById("pick-b"),
  budget: document.getElementById("budget"),
  budgetLabel: document.getElementById("budget-label"),
  guard: document.getElementById("guard"),
  costs: document.getElementById("costs"),
  apply: document.getElementById("apply"),
  clear: document.getElementById("clear"),
  reset: document.getElementById("reset"),
  relation: document.getElementById("relation"),
  statsA: document.getElementById("stats-a"),
  statsB: document.getElementById("stats-b"),
  issues: document.getElementById("issues"),
  okNote: document.getElementById("ok-note"),
};

const state = {
  zones: { a: [...startingZones.a], b: [...startingZones.b] },
  active: "a",
  dragging: null,
};

const activeZone = () => state.zones[state.active];

const styleOf = (key) =>
  getComputedStyle(document.documentElement)
    .getPropertyValue(key === "a" ? "--zone-a" : "--zone-b")
    .trim();

const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function toWorld(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD.width,
    y: ((event.clientY - rect.top) / rect.height) * WORLD.height,
  };
}

function vertexAt(point) {
  const ring = activeZone();
  const scale = canvas.getBoundingClientRect().width / WORLD.width || 1;
  const reach = HANDLE_RADIUS / scale + 4;

  for (let index = 0; index < ring.length; index++) {
    if (Math.hypot(ring[index].x - point.x, ring[index].y - point.y) <= reach) {
      return index;
    }
  }

  return null;
}

function simplifiedPreview() {
  const ring = activeZone();
  const budget = Number(elements.budget.value);
  if (ring.length <= budget) return null;

  return simplifyRing(ring, {
    maxVertices: budget,
    epsilon: EPSILON,
    preventSelfIntersection: elements.guard.checked,
  });
}

function drawGrid() {
  context.lineWidth = 1;

  for (let x = 0; x <= WORLD.width; x += 20) {
    context.strokeStyle = x % 100 === 0 ? cssVar("--grid-major") : cssVar("--grid");
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, WORLD.height);
    context.stroke();
  }

  for (let y = 0; y <= WORLD.height; y += 20) {
    context.strokeStyle = y % 100 === 0 ? cssVar("--grid-major") : cssVar("--grid");
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(WORLD.width, y + 0.5);
    context.stroke();
  }
}

function tracePath(ring) {
  context.beginPath();
  ring.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
}

function drawBounds() {
  context.save();
  context.setLineDash([10, 6]);
  context.strokeStyle = cssVar("--muted");
  context.lineWidth = 1.5;
  tracePath(BOUNDS);
  context.stroke();
  context.restore();
}

function drawCosts(ring) {
  if (ring.length < 3) return;
  const areas = ringEffectiveAreas(ring);
  const largest = Math.max(...areas, 1);

  context.save();
  ring.forEach((point, index) => {
    const previous = ring[(index - 1 + ring.length) % ring.length];
    const next = ring[(index + 1) % ring.length];

    context.fillStyle = cssVar("--muted");
    context.globalAlpha = 0.08 + 0.22 * (1 - areas[index] / largest);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.lineTo(next.x, next.y);
    context.closePath();
    context.fill();
  });
  context.restore();
}

function drawZone(key) {
  const ring = state.zones[key];
  if (ring.length === 0) return;

  const isActive = key === state.active;
  const validation = validateRing(ring, { epsilon: EPSILON });
  const colour = validation.valid ? styleOf(key) : cssVar("--alert");

  context.save();
  context.strokeStyle = colour;
  context.fillStyle = colour;
  context.lineWidth = isActive ? 2.5 : 1.5;
  context.lineJoin = "round";

  if (ring.length >= 3) {
    tracePath(ring);
    context.globalAlpha = isActive ? 0.16 : 0.09;
    context.fill();
    context.globalAlpha = 1;
    context.stroke();
  } else {
    context.beginPath();
    ring.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.stroke();
  }

  ring.forEach((point) => {
    context.beginPath();
    if (isActive) {
      context.rect(point.x - 3.5, point.y - 3.5, 7, 7);
    } else {
      context.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
    }
    context.fill();
  });

  for (const issue of validation.issues) {
    if (issue.kind !== "self-intersection") continue;
    context.strokeStyle = cssVar("--alert");
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(issue.at.x - 6, issue.at.y - 6);
    context.lineTo(issue.at.x + 6, issue.at.y + 6);
    context.moveTo(issue.at.x + 6, issue.at.y - 6);
    context.lineTo(issue.at.x - 6, issue.at.y + 6);
    context.stroke();
  }

  context.restore();
}

function drawPreview() {
  const preview = simplifiedPreview();
  if (!preview || preview.length < 3) return;

  context.save();
  context.setLineDash([6, 5]);
  context.lineWidth = 2;
  context.strokeStyle = cssVar("--ink");
  tracePath(preview);
  context.stroke();
  context.restore();
}

function render() {
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== WORLD.width * ratio) {
    canvas.width = WORLD.width * ratio;
    canvas.height = WORLD.height * ratio;
  }

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, WORLD.width, WORLD.height);

  drawGrid();
  drawBounds();
  if (elements.costs.checked) drawCosts(activeZone());
  drawZone(state.active === "a" ? "b" : "a");
  drawZone(state.active);
  drawPreview();

  updatePanel();
}

const relationSentences = {
  disjoint: "Zone A and zone B stay apart.",
  touching: "Zone A and zone B share a border.",
  overlapping: "Zone A and zone B overlap.",
  "a-contains-b": "Zone A contains zone B.",
  "b-contains-a": "Zone B contains zone A.",
  identical: "Zone A and zone B are the same shape.",
};

function describeZone(key) {
  const ring = state.zones[key];
  if (ring.length < 3) return `${ring.length} points`;

  const validation = validateRing(ring, { epsilon: EPSILON });
  const size = Math.round(area(ring)).toLocaleString();

  if (!validation.valid) return `${ring.length} points, invalid`;
  if (!ringContainsRing(BOUNDS, ring, EPSILON)) return `${ring.length} points, outside`;

  return `${ring.length} points, ${size} u²`;
}

function updatePanel() {
  const ring = activeZone();
  const ceiling = Math.max(3, ring.length);

  elements.budget.max = String(ceiling);
  if (ring.length >= 3 && Number(elements.budget.value) > ceiling) {
    elements.budget.value = String(ceiling);
  }

  const budget = Number(elements.budget.value);
  elements.budgetLabel.textContent =
    ring.length <= budget
      ? `Simplify to ${budget} points (nothing to drop)`
      : `Simplify to ${budget} points`;

  elements.statsA.textContent = describeZone("a");
  elements.statsB.textContent = describeZone("b");

  const a = state.zones.a;
  const b = state.zones.b;
  elements.relation.textContent =
    a.length >= 3 && b.length >= 3
      ? relationSentences[relateRings(a, b, EPSILON)]
      : "Draw two zones to compare them.";

  const validation = validateRing(ring, { epsilon: EPSILON });
  const outside = ring.length >= 3 && !ringContainsRing(BOUNDS, ring, EPSILON);

  elements.issues.innerHTML = "";
  for (const issue of validation.issues) {
    const item = document.createElement("li");
    item.textContent = describeIssue(issue);
    elements.issues.append(item);
  }
  if (outside) {
    const item = document.createElement("li");
    item.textContent = "the zone runs past the outer boundary";
    elements.issues.append(item);
  }

  elements.okNote.textContent =
    validation.valid && !outside && ring.length >= 3
      ? `Zone ${state.active.toUpperCase()} is valid and inside the boundary.`
      : "";
}

canvas.addEventListener("pointerdown", (event) => {
  const point = toWorld(event);
  const index = vertexAt(point);

  if (index !== null && event.shiftKey) {
    activeZone().splice(index, 1);
    render();
    return;
  }

  if (index !== null) {
    state.dragging = index;
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  activeZone().push(point);
  render();
});

canvas.addEventListener("pointermove", (event) => {
  if (state.dragging === null) return;
  activeZone()[state.dragging] = toWorld(event);
  render();
});

canvas.addEventListener("pointerup", () => {
  state.dragging = null;
});

function selectZone(key) {
  state.active = key;
  elements.pickA.setAttribute("aria-pressed", String(key === "a"));
  elements.pickB.setAttribute("aria-pressed", String(key === "b"));
  render();
}

elements.pickA.addEventListener("click", () => selectZone("a"));
elements.pickB.addEventListener("click", () => selectZone("b"));
elements.budget.addEventListener("input", render);
elements.guard.addEventListener("change", render);
elements.costs.addEventListener("change", render);

elements.apply.addEventListener("click", () => {
  const preview = simplifiedPreview();
  if (!preview) return;
  state.zones[state.active] = [...preview];
  render();
});

elements.clear.addEventListener("click", () => {
  state.zones[state.active] = [];
  render();
});

elements.reset.addEventListener("click", () => {
  state.zones = { a: [...startingZones.a], b: [...startingZones.b] };
  render();
});

window.addEventListener("resize", render);
render();

/**
 * Synthetic MediaPipe-style hand landmarks for unit tests.
 *
 * The hand is built in a local frame measured in "palm lengths":
 *   u = direction the fingers point, v = perpendicular.
 * It is then rotated by `angleDeg` (image coordinates: 0 = right, 90 = down,
 * -90 = up, 180 = left), scaled by `size` and centered on (cx, cy).
 */

const MCP = {
  index: [1.0, -0.35],
  middle: [1.05, -0.12],
  ring: [1.0, 0.1],
  pinky: [0.9, 0.3],
};
const SEGMENTS = { index: [0.45, 0.27, 0.22], middle: [0.5, 0.3, 0.24], ring: [0.45, 0.27, 0.22], pinky: [0.35, 0.2, 0.18] };

function rotate([x, y], deg) {
  const r = (deg * Math.PI) / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
}

/**
 * @param {object} o
 * @param {number} [o.cx] hand center x (normalized, display space unless you flip it)
 * @param {number} [o.cy] hand center y
 * @param {number} [o.angleDeg] direction the fingers point
 * @param {number} [o.size] palm length in normalized *height* units
 * @param {number} [o.aspectRatio] frame width / height
 * @param {number} [o.spreadDeg] V opening angle between index and middle
 * @param {{index?:boolean,middle?:boolean,ring?:boolean,pinky?:boolean}} [o.extended]
 */
export function makeHand({
  cx = 0.5,
  cy = 0.5,
  angleDeg = 0,
  size = 0.15,
  aspectRatio = 1,
  spreadDeg = 24,
  extended = { index: true, middle: true, ring: false, pinky: false },
} = {}) {
  const local = new Array(21);
  local[0] = [0, 0]; // wrist
  // Thumb (ignored by the classifier, but present like real data).
  local[1] = [0.2, -0.3];
  local[2] = [0.4, -0.5];
  local[3] = [0.55, -0.62];
  local[4] = [0.68, -0.7];

  const order = ['index', 'middle', 'ring', 'pinky'];
  const spreads = { index: -spreadDeg / 2, middle: spreadDeg / 2, ring: spreadDeg / 2, pinky: spreadDeg / 2 };
  order.forEach((finger, f) => {
    const base = 5 + f * 4;
    const mcp = MCP[finger];
    local[base] = mcp;
    if (extended[finger]) {
      const [dx, dy] = rotate([1, 0], spreads[finger]);
      const [s1, s2, s3] = SEGMENTS[finger];
      const pip = [mcp[0] + dx * s1, mcp[1] + dy * s1];
      const dip = [pip[0] + dx * s2, pip[1] + dy * s2];
      const tip = [dip[0] + dx * s3, dip[1] + dy * s3];
      local[base + 1] = pip;
      local[base + 2] = dip;
      local[base + 3] = tip;
    } else {
      // Curled finger seen from the front: PIP forward, tip tucked back near the palm.
      local[base + 1] = [mcp[0] + 0.3, mcp[1]];
      local[base + 2] = [mcp[0] + 0.12, mcp[1]];
      local[base + 3] = [mcp[0] - 0.05, mcp[1]];
    }
  });

  const rotated = local.map((p) => rotate(p, angleDeg));
  const mean = rotated.reduce((acc, [x, y]) => [acc[0] + x / 21, acc[1] + y / 21], [0, 0]);
  return rotated.map(([x, y]) => ({
    x: cx + ((x - mean[0]) * size) / aspectRatio,
    y: cy + (y - mean[1]) * size,
    z: 0,
  }));
}

/** Mirror landmarks horizontally (display space <-> raw camera space). */
export function flipX(hand) {
  return hand.map((p) => ({ ...p, x: 1 - p.x }));
}

/** "<": fingers pointing right. */
export const leftChevron = (o = {}) => makeHand({ cx: 0.3, angleDeg: 0, ...o });
/** ">": fingers pointing left. */
export const rightChevron = (o = {}) => makeHand({ cx: 0.7, angleDeg: 180, ...o });

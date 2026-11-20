/**
 * GDG gesture detection — pure logic, no DOM, no MediaPipe dependency.
 *
 * Input: hand landmarks as produced by MediaPipe Hand Landmarker
 * (21 points per hand, normalized x/y in [0..1] relative to the *raw* camera
 * frame, y pointing down).
 *
 * A "chevron hand" is a sideways V-sign:
 *   - index + middle fingers extended
 *   - ring + pinky folded (thumb is ignored)
 *   - the fingers point roughly horizontally (not upright like a peace sign)
 *
 * Fingers pointing to the RIGHT draw a "<" (vertex on the left, opening on the
 * right). Fingers pointing to the LEFT draw a ">".
 *
 * The GDG logo gesture = a "<" and a ">" visible together, with the "<" on the
 * left side of the displayed (possibly mirrored) frame and the ">" on the right.
 */

/** MediaPipe hand landmark indices. */
export const LM = Object.freeze({
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
});

const FINGERS = Object.freeze({
  index: [LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_TIP],
  middle: [LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_TIP],
  ring: [LM.RING_MCP, LM.RING_PIP, LM.RING_TIP],
  pinky: [LM.PINKY_MCP, LM.PINKY_PIP, LM.PINKY_TIP],
});

export const DEFAULT_CLASSIFIER_OPTIONS = Object.freeze({
  /** Display is mirrored (selfie view). Landmarks are converted to display space. */
  mirrored: true,
  /** Video width / height, so angles are measured in real pixels, not normalized units. */
  aspectRatio: 1,
  /** dist(wrist, tip) / dist(wrist, pip) above this → finger extended. */
  extendedRatio: 1.12,
  /** dist(wrist, tip) / dist(wrist, pip) below this → finger folded. */
  foldedRatio: 1.0,
  /** Max deviation (degrees) of the V's pointing direction from horizontal. */
  maxTiltDeg: 40,
  /** Minimal horizontal distance (normalized display units) between "<" and ">" hand centers. */
  minHandSeparation: 0.04,
});

const RAD2DEG = 180 / Math.PI;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function unit(dx, dy) {
  const len = Math.hypot(dx, dy);
  return len > 1e-9 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
}

/**
 * Converts raw landmarks into isotropic display-space points:
 * x is mirrored when needed and scaled by the aspect ratio so 1 unit on x
 * equals 1 unit on y in real pixels.
 */
function toDisplaySpace(landmarks, mirrored, aspectRatio) {
  return landmarks.map((p) => ({
    x: (mirrored ? 1 - p.x : p.x) * aspectRatio,
    y: p.y,
  }));
}

/**
 * Returns 'extended' | 'folded' | 'unknown' for one finger.
 * Rotation-invariant: compares how far the tip is from the wrist vs the PIP joint.
 */
export function fingerState(points, finger, opts = DEFAULT_CLASSIFIER_OPTIONS) {
  const [, pipIdx, tipIdx] = FINGERS[finger];
  const wrist = points[LM.WRIST];
  const dPip = dist(wrist, points[pipIdx]);
  if (dPip < 1e-9) return 'unknown';
  const ratio = dist(wrist, points[tipIdx]) / dPip;
  if (ratio >= opts.extendedRatio) return 'extended';
  if (ratio <= opts.foldedRatio) return 'folded';
  return 'unknown';
}

/**
 * Classifies a single hand.
 * @param {Array<{x:number,y:number,z?:number}>} landmarks 21 raw MediaPipe landmarks.
 * @param {Partial<typeof DEFAULT_CLASSIFIER_OPTIONS>} options
 * @returns {{
 *   isChevron: boolean,
 *   shape: '<' | '>' | null,
 *   reason: string,
 *   tiltDeg: number,
 *   pointing: 'left' | 'right',
 *   centerX: number,
 *   centerY: number,
 *   fingers: Record<'index'|'middle'|'ring'|'pinky', string>,
 * }}
 */
export function classifyHand(landmarks, options = {}) {
  const opts = { ...DEFAULT_CLASSIFIER_OPTIONS, ...options };
  if (!Array.isArray(landmarks) || landmarks.length < 21) {
    return {
      isChevron: false, shape: null, reason: 'invalid-landmarks', tiltDeg: NaN,
      pointing: 'right', centerX: NaN, centerY: NaN, fingers: {},
    };
  }

  const pts = toDisplaySpace(landmarks, opts.mirrored, opts.aspectRatio);

  // Hand center in normalized display coordinates (0..1 on both axes).
  let sx = 0;
  let sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  const centerX = sx / pts.length / opts.aspectRatio;
  const centerY = sy / pts.length;

  const fingers = {
    index: fingerState(pts, 'index', opts),
    middle: fingerState(pts, 'middle', opts),
    ring: fingerState(pts, 'ring', opts),
    pinky: fingerState(pts, 'pinky', opts),
  };

  // Pointing direction of the V = average direction of index & middle fingers.
  const di = unit(pts[LM.INDEX_TIP].x - pts[LM.INDEX_MCP].x, pts[LM.INDEX_TIP].y - pts[LM.INDEX_MCP].y);
  const dm = unit(pts[LM.MIDDLE_TIP].x - pts[LM.MIDDLE_MCP].x, pts[LM.MIDDLE_TIP].y - pts[LM.MIDDLE_MCP].y);
  const dir = unit(di.x + dm.x, di.y + dm.y);
  const angle = Math.atan2(dir.y, dir.x) * RAD2DEG; // 0 = right, ±180 = left, -90 = up
  const absAngle = Math.abs(angle);
  const tiltDeg = Math.min(absAngle, 180 - absAngle);
  const pointing = dir.x >= 0 ? 'right' : 'left';

  const base = { tiltDeg, pointing, centerX, centerY, fingers };

  if (fingers.index !== 'extended' || fingers.middle !== 'extended') {
    return { ...base, isChevron: false, shape: null, reason: 'index-middle-not-extended' };
  }
  if (fingers.ring !== 'folded' || fingers.pinky !== 'folded') {
    return { ...base, isChevron: false, shape: null, reason: 'ring-pinky-not-folded' };
  }
  if (tiltDeg > opts.maxTiltDeg) {
    return { ...base, isChevron: false, shape: null, reason: 'not-horizontal' };
  }
  return {
    ...base,
    isChevron: true,
    shape: pointing === 'right' ? '<' : '>',
    reason: 'ok',
  };
}

/**
 * Evaluates all hands in a frame.
 * @param {Array<Array<{x:number,y:number}>>} hands list of landmark arrays.
 * @param {Partial<typeof DEFAULT_CLASSIFIER_OPTIONS>} options
 * @returns {{ hands: ReturnType<typeof classifyHand>[], gesture: boolean, pair: [number, number] | null }}
 *   `pair` holds the indexes of the "<" and ">" hands that form the gesture.
 */
export function evaluateFrame(hands, options = {}) {
  const opts = { ...DEFAULT_CLASSIFIER_OPTIONS, ...options };
  const results = (hands || []).map((lm) => classifyHand(lm, opts));

  let pair = null;
  let bestGap = -Infinity;
  for (let i = 0; i < results.length; i++) {
    if (results[i].shape !== '<') continue;
    for (let j = 0; j < results.length; j++) {
      if (i === j || results[j].shape !== '>') continue;
      const gap = results[j].centerX - results[i].centerX;
      if (gap >= opts.minHandSeparation && gap > bestGap) {
        bestGap = gap;
        pair = [i, j];
      }
    }
  }
  return { hands: results, gesture: pair !== null, pair };
}

export const DEFAULT_TRACKER_OPTIONS = Object.freeze({
  /** How long the gesture must be held before triggering. */
  holdMs: 800,
  /** Time after a capture during which gestures are ignored. */
  cooldownMs: 4000,
  /** Short detection dropouts shorter than this do not reset the hold timer. */
  graceMs: 150,
});

/**
 * Debounces the per-frame gesture boolean into a single trigger event.
 *
 * States: 'idle' | 'holding' | 'triggered' | 'cooldown' | 'busy'
 *  - after a trigger the gesture must be released before it can trigger again.
 */
export class GestureTracker {
  constructor(options = {}) {
    this.options = { ...DEFAULT_TRACKER_OPTIONS, ...options };
    this.reset();
  }

  setOptions(options) {
    this.options = { ...this.options, ...options };
  }

  reset() {
    this.holdStart = null;
    this.lastSeen = -Infinity;
    this.cooldownUntil = -Infinity;
    this.busy = false;
    this.needsRelease = false;
  }

  /** Pause gesture tracking (e.g. while a countdown or preview is on screen). */
  setBusy(busy) {
    this.busy = Boolean(busy);
    this.holdStart = null;
  }

  /** Start the cooldown window, typically right after a photo is captured. */
  startCooldown(now) {
    this.cooldownUntil = now + this.options.cooldownMs;
    this.holdStart = null;
    this.needsRelease = true;
  }

  /**
   * @param {boolean} active whether the gesture is visible in this frame
   * @param {number} now timestamp in ms
   * @returns {{ state: string, progress: number, triggered: boolean }}
   */
  update(active, now) {
    if (!active) this.needsRelease = false;

    if (this.busy) return { state: 'busy', progress: 0, triggered: false };

    if (now < this.cooldownUntil) {
      this.holdStart = null;
      const remaining = this.cooldownUntil - now;
      return { state: 'cooldown', progress: 0, triggered: false, remainingMs: remaining };
    }

    if (this.needsRelease) return { state: 'idle', progress: 0, triggered: false };

    if (active) {
      this.lastSeen = now;
      if (this.holdStart === null) this.holdStart = now;
      const held = now - this.holdStart;
      if (held >= this.options.holdMs) {
        this.holdStart = null;
        this.needsRelease = true;
        return { state: 'triggered', progress: 1, triggered: true };
      }
      return { state: 'holding', progress: held / this.options.holdMs, triggered: false };
    }

    if (this.holdStart !== null && now - this.lastSeen <= this.options.graceMs) {
      const held = this.lastSeen - this.holdStart;
      return { state: 'holding', progress: held / this.options.holdMs, triggered: false };
    }

    this.holdStart = null;
    return { state: 'idle', progress: 0, triggered: false };
  }
}

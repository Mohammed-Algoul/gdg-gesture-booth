/**
 * Central configuration. Edit this file to rebrand the booth for another event.
 * All paths are relative so the app works from localhost and from a GitHub
 * Pages sub-path alike.
 */
export const PATHS = Object.freeze({
  model: 'models/hand_landmarker.task',
  wasm: 'vendor/mediapipe/tasks-vision/wasm',
  /** Optional full custom frame (transparent PNG). Overrides the generated SVG frame. */
  framePng: 'assets/frame.png',
  /** Optional logo used inside the generated SVG frame header. */
  logoPng: 'assets/gdg-logo.png',
});

/** Text rendered in the header of the generated frame (only used when assets/frame.png is absent). */
export const FRAME_TEXT = Object.freeze({
  title: 'Google Developer Group',
  subtitle: 'On Campus · Al-Aqsa University',
});

export const GOOGLE_COLORS = Object.freeze({
  blue: '#4285F4',
  red: '#EA4335',
  yellow: '#FBBC04',
  green: '#34A853',
});

/** Default user settings (overridable at runtime from the settings panel, key S). */
export const DEFAULT_SETTINGS = Object.freeze({
  holdMs: 800,
  cooldownMs: 4000,
  /** Used for minHandDetectionConfidence, minHandPresenceConfidence and minTrackingConfidence. */
  confidence: 0.6,
  maxTiltDeg: 40,
  countdownSeconds: 3,
  previewMs: 4000,
  mirror: true,
  sound: true,
  autoDownload: false,
  cameraId: '',
  numHands: 2,
});

/** Requested camera resolution. Browsers pick the closest supported mode. */
export const CAMERA_CONSTRAINTS = Object.freeze({
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 },
});

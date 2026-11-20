import { FilesetResolver, HandLandmarker } from '../vendor/mediapipe/tasks-vision/vision_bundle.mjs';
import { PATHS } from './config.js';

export class ModelMissingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelMissingError';
  }
}

const abs = (p) => new URL(p, document.baseURI).href;

/**
 * Loads the Hand Landmarker from local files only (no CDN).
 * Tries the GPU delegate first and falls back to CPU.
 */
export async function createHandDetector({ numHands = 2, confidence = 0.6 } = {}) {
  let res;
  try {
    res = await fetch(abs(PATHS.model));
  } catch (err) {
    throw new ModelMissingError(`Could not read model file ${PATHS.model}: ${err.message}`);
  }
  if (!res.ok) {
    throw new ModelMissingError(
      `Hand model not found: ${PATHS.model} (HTTP ${res.status}). See README → "Model file".`,
    );
  }
  const buffer = new Uint8Array(await res.arrayBuffer());
  // Catch Git LFS pointer files or HTML error pages served with 200.
  if (buffer.byteLength < 1_000_000) {
    throw new ModelMissingError(
      `Invalid model file ${PATHS.model} (${buffer.byteLength} bytes; expected ~7.8 MB). Is it a Git LFS pointer? See README.`,
    );
  }

  const fileset = await FilesetResolver.forVisionTasks(abs(PATHS.wasm));
  const options = (delegate) => ({
    baseOptions: { modelAssetBuffer: buffer, delegate },
    runningMode: 'VIDEO',
    numHands,
    minHandDetectionConfidence: confidence,
    minHandPresenceConfidence: confidence,
    minTrackingConfidence: confidence,
  });

  let landmarker;
  let delegate = 'GPU';
  try {
    landmarker = await HandLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (err) {
    console.warn('GPU delegate unavailable, falling back to CPU:', err);
    delegate = 'CPU';
    landmarker = await HandLandmarker.createFromOptions(fileset, options('CPU'));
  }

  let lastTs = -1;
  return {
    delegate,
    /** Runs detection on the current video frame. Returns MediaPipe HandLandmarkerResult. */
    detect(video, now) {
      // MediaPipe requires strictly increasing timestamps.
      const ts = now > lastTs ? now : lastTs + 1;
      lastTs = ts;
      return landmarker.detectForVideo(video, ts);
    },
    async setOptions({ numHands: n, confidence: c }) {
      const o = {};
      if (n) o.numHands = n;
      if (c) Object.assign(o, { minHandDetectionConfidence: c, minHandPresenceConfidence: c, minTrackingConfidence: c });
      await landmarker.setOptions(o);
    },
    close() {
      landmarker.close();
    },
  };
}

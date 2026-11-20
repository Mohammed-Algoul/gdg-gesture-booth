import { CAMERA_CONSTRAINTS } from './config.js';

export class CameraError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'CameraError';
    this.code = code;
    this.cause = cause;
  }
}

/** Human-readable (Arabic) explanation for a getUserMedia failure. */
function explain(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new CameraError('denied', 'تم رفض إذن الكاميرا. اسمح بالوصول إلى الكاميرا من شريط العنوان ثم أعد المحاولة.', err);
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new CameraError('not-found', 'لم يتم العثور على كاميرا. تأكد من توصيل الكاميرا.', err);
    case 'NotReadableError':
    case 'AbortError':
      return new CameraError('busy', 'الكاميرا مستخدمة من تطبيق آخر (Zoom / Teams / OBS…). أغلقه ثم أعد المحاولة.', err);
    default:
      return new CameraError('unknown', `تعذّر تشغيل الكاميرا: ${err?.message || err}`, err);
  }
}

export function isSecureEnough() {
  return window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Opens the camera and attaches it to the <video> element.
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(video, deviceId) {
  if (!isSecureEnough()) {
    throw new CameraError(
      'insecure',
      'الكاميرا تعمل فقط عبر HTTPS أو http://localhost. شغّل الخادم المحلي وافتح http://localhost:8000',
    );
  }
  const video_ = { ...CAMERA_CONSTRAINTS };
  if (deviceId) video_.deviceId = { exact: deviceId };

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: video_, audio: false });
  } catch (err) {
    // A saved camera may have been unplugged — fall back to any camera.
    if (deviceId && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
      return startCamera(video, '');
    }
    throw explain(err);
  }

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await new Promise((resolve) => {
    if (video.readyState >= 2 && video.videoWidth) resolve();
    else video.addEventListener('loadeddata', () => resolve(), { once: true });
  });
  await video.play().catch(() => {});
  return stream;
}

export function stopCamera(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Lists available video inputs (labels are only available after permission is granted). */
export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

export function currentDeviceId(stream) {
  return stream?.getVideoTracks()[0]?.getSettings().deviceId || '';
}

/**
 * GDG Gesture Photo Booth — app controller.
 * Everything runs locally: camera → MediaPipe (local wasm + model) → gesture
 * logic → countdown → canvas composite → in-memory gallery.
 */
import { evaluateFrame, GestureTracker } from './gesture.js';
import { DEFAULT_SETTINGS } from './config.js';
import { loadSettings, saveSettings } from './settings.js';
import { CameraError, currentDeviceId, listCameras, startCamera, stopCamera } from './camera.js';
import { buildFrame, capturePhoto, loadFrameAssets } from './frame.js';
import { Gallery } from './gallery.js';
import { beep, shutter, unlockAudio } from './sound.js';

const $ = (id) => document.getElementById(id);
const el = {
  app: $('app'),
  stage: $('stage'),
  video: $('video'),
  frame: $('frame'),
  debug: $('debug'),
  flash: $('flash'),
  status: $('status'),
  statusTitle: $('statusTitle'),
  statusSub: $('statusSub'),
  ring: $('ringProgress'),
  chipLeft: $('chipLeft'),
  chipRight: $('chipRight'),
  banner: $('banner'),
  bannerText: $('bannerText'),
  countdown: $('countdown'),
  preview: $('preview'),
  previewImg: $('previewImg'),
  previewTimer: $('previewTimer'),
  btnDownload: $('btnDownload'),
  btnClosePreview: $('btnClosePreview'),
  btnCapture: $('btnCapture'),
  btnGallery: $('btnGallery'),
  btnSettings: $('btnSettings'),
  btnFullscreen: $('btnFullscreen'),
  btnHelp: $('btnHelp'),
  galleryCount: $('galleryCount'),
  gallery: $('gallery'),
  galleryGrid: $('galleryGrid'),
  galleryEmpty: $('galleryEmpty'),
  galleryTitleCount: $('galleryTitleCount'),
  btnDownloadAll: $('btnDownloadAll'),
  btnClearGallery: $('btnClearGallery'),
  btnCloseGallery: $('btnCloseGallery'),
  settings: $('settings'),
  settingsForm: $('settingsForm'),
  cameraSelect: $('cameraSelect'),
  btnCloseSettings: $('btnCloseSettings'),
  btnResetSettings: $('btnResetSettings'),
  engineInfo: $('engineInfo'),
  help: $('help'),
  btnCloseHelp: $('btnCloseHelp'),
  overlay: $('overlay'),
  overlaySpinner: $('overlaySpinner'),
  overlayIcon: $('overlayIcon'),
  overlayTitle: $('overlayTitle'),
  overlayMsg: $('overlayMsg'),
  overlayDetail: $('overlayDetail'),
  overlayActions: $('overlayActions'),
  toast: $('toast'),
};

const state = {
  /** loading | live | countdown | preview | error */
  phase: 'loading',
  settings: loadSettings(),
  stream: null,
  detector: null,
  detectorStatus: 'loading', // loading | ready | error
  assets: { framePng: null, logoDataUrl: null },
  frame: null,
  debug: false,
  lastVideoTime: -1,
  countdownToken: null,
  previewPhotoId: null,
  previewTimeout: null,
  fps: 0,
  lastStatusKey: '',
};

const tracker = new GestureTracker({ holdMs: state.settings.holdMs, cooldownMs: state.settings.cooldownMs });
const gallery = new Gallery();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Overlay / banner / toast
// ---------------------------------------------------------------------------

function showOverlay({ title, message = '', detail = '', error = false, actions = [] }) {
  el.overlay.classList.remove('is-hidden');
  el.overlaySpinner.hidden = error;
  el.overlayIcon.hidden = !error;
  el.overlayTitle.textContent = title;
  el.overlayMsg.textContent = message;
  el.overlayDetail.textContent = detail;
  el.overlayActions.replaceChildren(
    ...actions.map(({ label, primary, onClick }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn${primary ? ' btn--primary' : ''}`;
      b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    }),
  );
}

function hideOverlay() {
  el.overlay.classList.add('is-hidden');
}

function showBanner(text) {
  el.bannerText.textContent = text;
  el.banner.hidden = false;
}

let toastTimer = null;
function toast(text, ms = 1800) {
  el.toast.textContent = text;
  el.toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), ms);
}

// ---------------------------------------------------------------------------
// Camera + frame
// ---------------------------------------------------------------------------

async function applyFrame() {
  const v = el.video;
  const next = await buildFrame(state.assets, v.videoWidth, v.videoHeight);
  state.frame?.dispose();
  state.frame = next;
  el.frame.src = next.image.src;
  el.frame.hidden = false;
  document.documentElement.style.setProperty('--ar', String(next.width / next.height));
  resizeDebugCanvas();
}

async function openCamera(deviceId) {
  stopCamera(state.stream);
  state.stream = await startCamera(el.video, deviceId);
  state.lastVideoTime = -1;
  const id = currentDeviceId(state.stream);
  if (id && id !== state.settings.cameraId) {
    state.settings.cameraId = id;
    saveSettings(state.settings);
  }
  await applyFrame();
  refreshCameraList();
}

async function refreshCameraList() {
  const cams = await listCameras().catch(() => []);
  const current = currentDeviceId(state.stream);
  el.cameraSelect.replaceChildren(
    ...cams.map((c, i) => {
      const o = document.createElement('option');
      o.value = c.deviceId;
      o.textContent = c.label || `Camera ${i + 1}`;
      o.selected = c.deviceId === current;
      return o;
    }),
  );
}

// Rebuild the generated frame if the camera resolution changes.
el.video.addEventListener('resize', () => {
  if (state.frame?.source === 'svg' && state.frame.width !== el.video.videoWidth) applyFrame();
});

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

async function loadDetector() {
  state.detectorStatus = 'loading';
  try {
    // Dynamic import so a broken /vendor never prevents the camera + manual capture from working.
    const { createHandDetector } = await import('./detector.js');
    state.detector = await createHandDetector({
      numHands: state.settings.numHands,
      confidence: state.settings.confidence,
    });
    state.detectorStatus = 'ready';
    el.engineInfo.textContent = `MediaPipe · ${state.detector.delegate}`;
  } catch (err) {
    console.error(err);
    state.detectorStatus = 'error';
    const missing = err?.name === 'ModelMissingError';
    const title = missing ? 'ملف نموذج تتبع اليد غير موجود' : 'تعذّر تشغيل نموذج تتبع اليد';
    showBanner(`${title} — التقاط الإيماءة متوقف. استخدم المسافة (Space) للالتقاط اليدوي.`);
    showOverlay({
      title,
      message: missing
        ? 'أضف الملف models/hand_landmarker.task (راجع README) ثم أعد تحميل الصفحة. يمكنك المتابعة بالالتقاط اليدوي بالضغط على المسافة.'
        : 'يمكنك المتابعة بالالتقاط اليدوي بالضغط على المسافة (Space).',
      detail: `${err?.message || err}`,
      error: true,
      actions: [
        { label: 'متابعة بالالتقاط اليدوي', primary: true, onClick: hideOverlay },
        { label: 'إعادة المحاولة', onClick: () => location.reload() },
      ],
    });
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

let lastFrameTs = 0;

function loop() {
  requestAnimationFrame(loop);
  const v = el.video;
  if (!state.detector || v.readyState < 2 || !v.videoWidth) {
    renderStatus(null, null);
    return;
  }
  if (v.currentTime === state.lastVideoTime) return;
  // Save CPU/GPU for the countdown & preview animations: gestures are ignored then anyway.
  if (state.phase !== 'live' && !state.debug) {
    renderStatus({ hands: [], gesture: false, pair: null }, null);
    return;
  }
  state.lastVideoTime = v.currentTime;

  const now = performance.now();
  if (lastFrameTs) state.fps = state.fps * 0.9 + (1000 / (now - lastFrameTs)) * 0.1;
  lastFrameTs = now;

  let result;
  try {
    result = state.detector.detect(v, now);
  } catch (err) {
    console.error('detect failed', err);
    return;
  }
  const landmarks = result?.landmarks || [];
  const evaluation = evaluateFrame(landmarks, {
    mirrored: state.settings.mirror,
    aspectRatio: v.videoWidth / v.videoHeight,
    maxTiltDeg: state.settings.maxTiltDeg,
  });
  const track = tracker.update(evaluation.gesture, now);
  if (track.triggered && state.phase === 'live') startCountdown();

  renderStatus(evaluation, track);
  if (state.debug) drawDebug(landmarks, evaluation);
}

function setStatus(key, stateName, title, sub, progress = 0) {
  el.ring.style.strokeDashoffset = String(100 - Math.max(0, Math.min(1, progress)) * 100);
  if (key === state.lastStatusKey) return;
  state.lastStatusKey = key;
  el.status.dataset.state = stateName;
  el.statusTitle.textContent = title;
  el.statusSub.textContent = sub;
}

function renderStatus(evaluation, track) {
  const hands = evaluation?.hands || [];
  const hasLeft = hands.some((h) => h.shape === '<');
  const hasRight = hands.some((h) => h.shape === '>');
  el.chipLeft.classList.toggle('is-on', hasLeft);
  el.chipRight.classList.toggle('is-on', hasRight);
  el.app.classList.toggle('has-hands', hands.length > 0);

  if (state.detectorStatus === 'error') {
    return setStatus('error', 'error', 'الإيماءات غير متاحة', 'اضغط Space للالتقاط اليدوي');
  }
  if (state.detectorStatus === 'loading' || !evaluation) {
    return setStatus('loading', 'loading', 'جاري تحميل النموذج…', 'Loading hand model');
  }
  if (state.phase === 'countdown' || state.phase === 'capturing') return setStatus('busy-cd', 'go', 'ابتسم! 📸', 'Smile', 1);
  if (state.phase === 'preview') return setStatus('busy-pv', 'go', 'تم التقاط الصورة', 'Photo captured', 1);

  if (track?.state === 'cooldown') {
    const s = Math.ceil((track.remainingMs || 0) / 1000);
    return setStatus(`cd${s}`, 'cooldown', 'استعدوا للصورة التالية', `Cooldown · ${s}s`, 0);
  }
  if (track?.state === 'holding' || track?.state === 'triggered') {
    return setStatus('holding', 'holding', 'ثبّت الإشارة…', 'Hold still', track.progress);
  }
  if (hasLeft || hasRight) {
    const missing = hasLeft ? '>' : '<';
    return setStatus(`half${missing}`, 'half', 'نصف الشعار ✓', `أضف اليد الأخرى \u2066${missing}\u2069`);
  }
  if (hands.length) {
    return setStatus(`hands${hands.length}`, 'hands', hands.length === 1 ? 'تم رصد يد' : `تم رصد ${hands.length} أيدٍ`, 'اصنع علامة V أفقية بكل يد');
  }
  return setStatus('none', 'idle', 'لا توجد أيدٍ', 'قف أمام الكاميرا وارفع يديك');
}

function resizeDebugCanvas() {
  const r = el.stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  el.debug.width = Math.round(r.width * dpr);
  el.debug.height = Math.round(r.height * dpr);
}
window.addEventListener('resize', resizeDebugCanvas);

function drawDebug(landmarks, evaluation) {
  const c = el.debug;
  const ctx = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  ctx.clearRect(0, 0, W, H);
  const v = el.video;
  const scale = Math.max(W / v.videoWidth, H / v.videoHeight);
  const dw = v.videoWidth * scale;
  const dh = v.videoHeight * scale;
  const ox = (W - dw) / 2;
  const oy = (H - dh) / 2;
  const mirror = state.settings.mirror;
  const px = (p) => [ox + (mirror ? 1 - p.x : p.x) * dw, oy + p.y * dh];
  const k = W / 1280;

  landmarks.forEach((hand, i) => {
    const info = evaluation.hands[i];
    const inPair = evaluation.pair?.includes(i);
    const color = inPair ? '#34A853' : info?.isChevron ? '#4285F4' : '#ffffff';
    ctx.lineWidth = 3 * k;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      const [x1, y1] = px(hand[a]);
      const [x2, y2] = px(hand[b]);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.fillStyle = '#EA4335';
    for (const p of hand) {
      const [x, y] = px(p);
      ctx.beginPath();
      ctx.arc(x, y, 4 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    if (info) {
      const [x, y] = px(hand[0]);
      const label = `${info.shape ?? '·'}  ${info.reason}  tilt ${Math.round(info.tiltDeg)}°`;
      const f = info.fingers;
      const label2 = `I:${f.index?.[0]} M:${f.middle?.[0]} R:${f.ring?.[0]} P:${f.pinky?.[0]}`;
      ctx.font = `${16 * k}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = 'left';
      ctx.direction = 'ltr';
      const w = Math.max(ctx.measureText(label).width, ctx.measureText(label2).width) + 12 * k;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x - w / 2, y + 10 * k, w, 44 * k);
      ctx.fillStyle = color;
      ctx.fillText(label, x - w / 2 + 6 * k, y + 28 * k);
      ctx.fillText(label2, x - w / 2 + 6 * k, y + 48 * k);
    }
  });

  ctx.font = `${15 * k}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(10 * k, H - 36 * k, 420 * k, 26 * k);
  ctx.fillStyle = '#fff';
  ctx.fillText(
    `DEBUG  ${state.fps.toFixed(0)} fps · ${state.detector?.delegate ?? '-'} · ${v.videoWidth}×${v.videoHeight} · gesture=${evaluation.gesture}`,
    16 * k,
    H - 18 * k,
  );
}

function setDebug(on) {
  state.debug = on;
  el.debug.hidden = !on;
  if (on) resizeDebugCanvas();
  else el.debug.getContext('2d').clearRect(0, 0, el.debug.width, el.debug.height);
  toast(on ? 'وضع التصحيح: تشغيل (Debug ON)' : 'وضع التصحيح: إيقاف (Debug OFF)');
}

// ---------------------------------------------------------------------------
// Countdown → capture → preview
// ---------------------------------------------------------------------------

function setPhase(phase) {
  state.phase = phase;
  el.app.dataset.phase = phase;
}

const COUNT_COLORS = ['#34A853', '#FBBC04', '#EA4335', '#4285F4'];

async function startCountdown() {
  if (state.phase !== 'live' || !state.frame) return;
  closePanels();
  setPhase('countdown');
  tracker.setBusy(true);
  const token = { cancelled: false };
  state.countdownToken = token;

  for (let n = state.settings.countdownSeconds; n >= 1; n--) {
    const num = document.createElement('div');
    num.className = 'countdown__num';
    num.textContent = String(n);
    num.style.setProperty('--c', COUNT_COLORS[(n - 1) % COUNT_COLORS.length]);
    el.countdown.replaceChildren(num);
    if (state.settings.sound) beep(n === 1);
    await sleep(1000);
    if (token.cancelled) return;
  }
  el.countdown.replaceChildren();
  await takePhoto();
}

function cancelCountdown() {
  if (state.phase !== 'countdown') return;
  state.countdownToken.cancelled = true;
  el.countdown.replaceChildren();
  setPhase('live');
  tracker.setBusy(false);
  tracker.startCooldown(performance.now() - state.settings.cooldownMs + 1000);
  toast('تم إلغاء العد التنازلي');
}

async function takePhoto() {
  setPhase('capturing');
  let photo;
  try {
    // capturePhoto draws the current frame synchronously, before the flash covers the view.
    const pending = capturePhoto(el.video, state.frame, { mirror: state.settings.mirror });
    el.flash.classList.remove('is-on');
    void el.flash.offsetWidth; // restart animation
    el.flash.classList.add('is-on');
    if (state.settings.sound) shutter();
    const { blob } = await pending;
    photo = gallery.add(blob);
  } catch (err) {
    console.error(err);
    toast('تعذّر حفظ الصورة');
    setPhase('live');
    tracker.setBusy(false);
    return;
  }
  tracker.startCooldown(performance.now());
  if (state.settings.autoDownload) gallery.download(photo.id);
  openPreview(photo.id, true);
}

function openPreview(id, autoClose) {
  const photo = gallery.get(id);
  if (!photo) return;
  closePanels();
  if (state.phase === 'countdown') cancelCountdown();
  state.previewPhotoId = id;
  el.previewImg.src = photo.url;
  el.preview.hidden = false;
  setPhase('preview');
  tracker.setBusy(true);
  clearTimeout(state.previewTimeout);
  el.previewTimer.classList.remove('is-running');
  el.previewTimer.parentElement.hidden = !autoClose;
  if (autoClose) {
    el.previewTimer.style.setProperty('--dur', `${state.settings.previewMs}ms`);
    void el.previewTimer.offsetWidth;
    el.previewTimer.classList.add('is-running');
    state.previewTimeout = setTimeout(closePreview, state.settings.previewMs);
  }
}

function closePreview() {
  clearTimeout(state.previewTimeout);
  el.preview.hidden = true;
  el.previewImg.removeAttribute('src');
  state.previewPhotoId = null;
  if (state.phase === 'preview') {
    setPhase('live');
    tracker.setBusy(false);
  }
}

// Stop auto-close as soon as someone interacts with the preview.
el.preview.addEventListener('pointerdown', () => {
  clearTimeout(state.previewTimeout);
  el.previewTimer.parentElement.hidden = true;
});
el.btnDownload.addEventListener('click', () => {
  if (state.previewPhotoId) gallery.download(state.previewPhotoId);
  toast('تم تحميل الصورة ✓');
});
el.btnClosePreview.addEventListener('click', closePreview);
el.preview.addEventListener('click', (e) => {
  if (e.target === el.preview) closePreview();
});

// ---------------------------------------------------------------------------
// Gallery UI
// ---------------------------------------------------------------------------

function svgIcon(id) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

function renderGallery(photos) {
  const n = photos.length;
  el.galleryCount.hidden = n === 0;
  el.galleryCount.textContent = String(n);
  el.galleryTitleCount.textContent = n ? `(${n})` : '';
  el.galleryEmpty.hidden = n > 0;
  el.btnDownloadAll.disabled = n === 0;
  el.btnClearGallery.disabled = n === 0;
  el.galleryGrid.replaceChildren(
    ...photos.map((p) => {
      const card = document.createElement('div');
      card.className = 'thumb';
      const img = document.createElement('img');
      img.src = p.url;
      img.alt = p.filename;
      img.loading = 'lazy';
      img.addEventListener('click', () => openPreview(p.id, false));
      const actions = document.createElement('div');
      actions.className = 'thumb__actions';
      const dl = document.createElement('button');
      dl.type = 'button';
      dl.title = 'تحميل';
      dl.setAttribute('aria-label', 'تحميل');
      dl.append(svgIcon('i-download'));
      dl.addEventListener('click', () => gallery.download(p.id));
      const del = document.createElement('button');
      del.type = 'button';
      del.title = 'حذف';
      del.setAttribute('aria-label', 'حذف');
      del.append(svgIcon('i-delete'));
      del.addEventListener('click', () => gallery.remove(p.id));
      actions.append(dl, del);
      card.append(img, actions);
      if (p.downloaded) {
        const done = svgIcon('i-check');
        done.classList.add('thumb__done');
        card.append(done);
      }
      return card;
    }),
  );
}
gallery.onChange(renderGallery);
renderGallery([]);

el.btnDownloadAll.addEventListener('click', async () => {
  toast('جاري تجهيز ملف ZIP…');
  await gallery.downloadAll();
});
el.btnClearGallery.addEventListener('click', () => {
  const msg = gallery.hasUndownloaded
    ? 'بعض الصور لم يتم تحميلها بعد. هل تريد مسح كل الصور؟'
    : 'مسح كل صور الجلسة؟';
  if (confirm(msg)) gallery.clear();
});

window.addEventListener('beforeunload', (e) => {
  if (gallery.hasUndownloaded) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function togglePanel(panel, force) {
  const open = force ?? panel.hidden;
  for (const p of [el.gallery, el.settings, el.help]) if (p !== panel) p.hidden = true;
  panel.hidden = !open;
  if (open && panel === el.settings) refreshCameraList();
}

function closePanels() {
  el.gallery.hidden = true;
  el.settings.hidden = true;
  el.help.hidden = true;
}

el.btnGallery.addEventListener('click', () => togglePanel(el.gallery));
el.btnCloseGallery.addEventListener('click', () => togglePanel(el.gallery, false));
el.btnSettings.addEventListener('click', () => togglePanel(el.settings));
el.btnCloseSettings.addEventListener('click', () => togglePanel(el.settings, false));
el.btnHelp.addEventListener('click', () => togglePanel(el.help));
el.btnCloseHelp.addEventListener('click', () => togglePanel(el.help, false));
el.help.addEventListener('click', (e) => {
  if (e.target === el.help) togglePanel(el.help, false);
});
el.btnCapture.addEventListener('click', () => {
  if (state.phase === 'preview') closePreview();
  startCountdown();
});
el.btnFullscreen.addEventListener('click', toggleFullscreen);

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => toast('ملء الشاشة غير متاح'));
}

// ---------------------------------------------------------------------------
// Settings form
// ---------------------------------------------------------------------------

function formatValue(name, value, unit) {
  if (unit === 'ms') return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`;
  if (name === 'confidence') return Number(value).toFixed(2);
  return `${value}${unit ? ` ${unit}` : ''}`.replace(' °', '°');
}

function syncForm() {
  const f = el.settingsForm;
  for (const [key, value] of Object.entries(state.settings)) {
    const input = f.elements.namedItem(key);
    if (!input || key === 'cameraId') continue;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = String(value);
    const out = f.querySelector(`output[data-for="${key}"]`);
    if (out) out.textContent = formatValue(key, value, out.dataset.unit);
  }
  el.app.classList.toggle('is-mirrored', state.settings.mirror);
}

let confidenceTimer = null;
async function applySetting(key) {
  const s = state.settings;
  switch (key) {
    case 'holdMs':
    case 'cooldownMs':
      tracker.setOptions({ holdMs: s.holdMs, cooldownMs: s.cooldownMs });
      break;
    case 'confidence':
      clearTimeout(confidenceTimer);
      confidenceTimer = setTimeout(() => state.detector?.setOptions({ confidence: s.confidence }).catch(console.error), 250);
      break;
    case 'mirror':
      el.app.classList.toggle('is-mirrored', s.mirror);
      break;
    case 'cameraId':
      try {
        await openCamera(s.cameraId);
        toast('تم تغيير الكاميرا');
      } catch (err) {
        toast(err.message || 'تعذّر تغيير الكاميرا', 4000);
      }
      break;
    default:
      break;
  }
}

el.settingsForm.addEventListener('input', (e) => {
  const input = e.target;
  const key = input.name;
  if (!(key in DEFAULT_SETTINGS)) return;
  const def = DEFAULT_SETTINGS[key];
  const value = typeof def === 'boolean' ? input.checked : typeof def === 'number' ? Number(input.value) : input.value;
  state.settings[key] = value;
  saveSettings(state.settings);
  syncForm();
  applySetting(key);
});
el.settingsForm.addEventListener('submit', (e) => e.preventDefault());
el.btnResetSettings.addEventListener('click', () => {
  const cameraId = state.settings.cameraId;
  state.settings = { ...DEFAULT_SETTINGS, cameraId };
  saveSettings(state.settings);
  syncForm();
  ['holdMs', 'confidence', 'mirror'].forEach(applySetting);
  toast('تمت استعادة الإعدادات الافتراضية');
});

// ---------------------------------------------------------------------------
// Keyboard (uses e.code so shortcuts work with Arabic keyboard layouts too)
// ---------------------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const inForm = e.target instanceof HTMLElement && e.target.closest('input, select, textarea');
  if (inForm && e.code !== 'Escape') return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (e.repeat) return;
      if (state.phase === 'preview') closePreview();
      else startCountdown();
      break;
    case 'KeyD':
      setDebug(!state.debug);
      break;
    case 'KeyF':
      toggleFullscreen();
      break;
    case 'KeyS':
      togglePanel(el.settings);
      break;
    case 'KeyG':
      togglePanel(el.gallery);
      break;
    case 'KeyH':
    case 'Slash':
      togglePanel(el.help);
      break;
    case 'Escape':
      if (!el.help.hidden || !el.settings.hidden || !el.gallery.hidden) closePanels();
      else if (state.phase === 'countdown') cancelCountdown();
      else if (state.phase === 'preview') closePreview();
      break;
    default:
      break;
  }
});
window.addEventListener('pointerdown', unlockAudio);

// Auto-hide the toolbar and cursor when the mouse is idle (kiosk look).
let idleTimer = null;
function wake() {
  el.app.classList.remove('is-idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => el.app.classList.add('is-idle'), 3500);
}
window.addEventListener('pointermove', wake);
window.addEventListener('pointerdown', wake);

navigator.mediaDevices?.addEventListener?.('devicechange', refreshCameraList);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  syncForm();
  wake();

  if (location.protocol === 'file:') {
    setPhase('error');
    showOverlay({
      title: 'شغّل التطبيق عبر خادم محلي',
      message: 'لا يمكن فتح الملف مباشرة (file://). افتح الطرفية داخل مجلد المشروع وشغّل: python -m http.server 8000 ثم افتح http://localhost:8000',
      detail: 'Open via http://localhost:8000 — browsers block camera access and ES modules on file://',
      error: true,
    });
    return;
  }

  showOverlay({ title: 'جاري تشغيل الكاميرا…', message: 'اسمح للمتصفح باستخدام الكاميرا عند الطلب.' });
  try {
    state.assets = await loadFrameAssets();
    await openCamera(state.settings.cameraId);
  } catch (err) {
    console.error(err);
    setPhase('error');
    showOverlay({
      title: 'تعذّر تشغيل الكاميرا',
      message: err instanceof CameraError ? err.message : String(err?.message || err),
      detail: err?.cause?.name ? `${err.cause.name}: ${err.cause.message}` : '',
      error: true,
      actions: [{ label: 'إعادة المحاولة', primary: true, onClick: () => location.reload() }],
    });
    return;
  }

  hideOverlay();
  setPhase('live');
  requestAnimationFrame(loop);
  loadDetector();
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
}

boot();

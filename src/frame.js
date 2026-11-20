/**
 * Frame overlay.
 *  - If assets/frame.png exists it is used as-is (its size defines the photo size).
 *  - Otherwise a GDG-style SVG frame is generated to match the camera resolution.
 * The same image is shown live over the camera and baked into the captured photo,
 * so what people see is exactly what they get.
 */
import { FRAME_TEXT, GOOGLE_COLORS, PATHS } from './config.js';

const FONT_STACK = '"Google Sans", "Product Sans", Roboto, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

async function fileToDataUrl(path) {
  const res = await fetch(new URL(path, document.baseURI));
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) return null;
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve(null);
    r.readAsDataURL(blob);
  });
}

/** Loads optional custom assets. Missing files are fine. */
export async function loadFrameAssets() {
  const [framePng, logoDataUrl] = await Promise.all([
    loadImage(PATHS.framePng).catch(() => null),
    fileToDataUrl(PATHS.logoPng).catch(() => null),
  ]);
  return { framePng, logoDataUrl };
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

function measure(text, font) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = font;
  return ctx.measureText(text).width;
}

/** Stylised GDG "< >" mark, drawn with Google colors, in a 100×60 box. */
function gdgMarkSvg(x, y, h) {
  const k = h / 60;
  const { red, blue, green, yellow } = GOOGLE_COLORS;
  const line = (x1, y1, x2, y2, c) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="12" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y}) scale(${k})">
    ${line(40, 9, 9, 30, red)}${line(9, 30, 40, 51, blue)}
    ${line(60, 9, 91, 30, green)}${line(91, 30, 60, 51, yellow)}
  </g>`;
}

/**
 * Builds the default GDG frame as an SVG string sized exactly W×H pixels.
 * @param {number} W
 * @param {number} H
 * @param {string|null} logoDataUrl optional logo image (data URL) for the header
 */
export function buildFrameSvg(W, H, logoDataUrl = null) {
  const s = Math.min(W, H) / 1080;
  const m = 26 * s; // outer margin
  const bw = 14 * s; // border width
  const r = 48 * s; // corner radius
  const w = W - 2 * m;
  const h = H - 2 * m;

  // Four Google-colored border segments, one per side, split at the corner midpoints.
  const T = w - 2 * r;
  const R = h - 2 * r;
  const a = (Math.PI * r) / 2; // quarter arc
  const P = 2 * T + 2 * R + 4 * a;
  const { blue, red, yellow, green } = GOOGLE_COLORS;
  const seg = (color, dash) =>
    `<rect x="${m}" y="${m}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="none" stroke="${color}" stroke-width="${bw}" stroke-dasharray="${dash}"/>`;
  // The rect stroke starts at (m + r, m) and runs clockwise.
  const blueDash = `${T + a / 2} ${P - T - a} ${a / 2} ${P}`;
  const redDash = `0 ${T + a / 2} ${R + a} ${P}`;
  const yellowDash = `0 ${T + R + 1.5 * a} ${T + a} ${P}`;
  const greenDash = `0 ${2 * T + R + 2.5 * a} ${R + a} ${P}`;

  // Header pill.
  const titleSize = 36 * s;
  const subSize = 26 * s;
  const titleFont = `500 ${titleSize}px ${FONT_STACK}`;
  const subFont = `400 ${subSize}px ${FONT_STACK}`;
  const textW = Math.max(measure(FRAME_TEXT.title, titleFont), measure(FRAME_TEXT.subtitle, subFont));
  const pillH = 112 * s;
  const logoH = 56 * s;
  const logoW = logoDataUrl ? logoH * 1.6 : (logoH * 100) / 60;
  const padX = 34 * s;
  const gap = 22 * s;
  const pillW = Math.min(W - 4 * m, padX * 2 + logoW + gap + textW);
  const pillX = (W - pillW) / 2;
  const pillY = m - pillH / 2 + bw / 2 + 30 * s;
  const contentX = pillX + padX;
  const logoY = pillY + (pillH - logoH) / 2;
  const textX = contentX + logoW + gap;

  const logo = logoDataUrl
    ? `<image href="${esc(logoDataUrl)}" x="${contentX}" y="${logoY}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>`
    : gdgMarkSvg(contentX, logoY, logoH);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="sh" x="-20%" y="-50%" width="140%" height="200%">
      <feDropShadow dx="0" dy="${4 * s}" stdDeviation="${8 * s}" flood-color="#000" flood-opacity="0.28"/>
    </filter>
    <linearGradient id="topfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${pillY + pillH + 60 * s}" fill="url(#topfade)"/>
  <rect x="${m + bw / 2 + 3 * s}" y="${m + bw / 2 + 3 * s}" width="${w - bw - 6 * s}" height="${h - bw - 6 * s}" rx="${Math.max(0, r - bw / 2 - 3 * s)}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="${2 * s}"/>
  ${seg(blue, blueDash)}${seg(red, redDash)}${seg(yellow, yellowDash)}${seg(green, greenDash)}
  <g filter="url(#sh)">
    <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="#fff"/>
  </g>
  ${logo}
  <text x="${textX}" y="${pillY + pillH / 2 - 6 * s}" font-family='${FONT_STACK}' font-size="${titleSize}" font-weight="500" fill="#202124">${esc(FRAME_TEXT.title)}</text>
  <text x="${textX}" y="${pillY + pillH / 2 + subSize + 4 * s}" font-family='${FONT_STACK}' font-size="${subSize}" fill="#5f6368">${esc(FRAME_TEXT.subtitle)}</text>
</svg>`;
}

/**
 * Produces the frame image for the current camera size.
 * @returns {Promise<{image: HTMLImageElement, width: number, height: number, source: 'png'|'svg', dispose: () => void}>}
 */
export async function buildFrame(assets, videoW, videoH) {
  if (assets.framePng) {
    const img = assets.framePng;
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, source: 'png', dispose() {} };
  }
  const W = videoW || 1280;
  const H = videoH || 720;
  const svg = buildFrameSvg(W, H, assets.logoDataUrl);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const image = await loadImage(url);
  return { image, width: W, height: H, source: 'svg', dispose: () => URL.revokeObjectURL(url) };
}

/**
 * Draws the video like CSS `object-fit: cover` into a W×H area.
 */
export function drawVideoCover(ctx, video, W, H, mirror) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.save();
  if (mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.restore();
}

/**
 * Composites the current video frame + frame overlay into a PNG.
 * The output contains ONLY the photo and the frame — no text, no timestamp, no watermark.
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function capturePhoto(video, frame, { mirror }) {
  const W = frame.width;
  const H = frame.height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  drawVideoCover(ctx, video, W, H, mirror);
  ctx.drawImage(frame.image, 0, 0, W, H);
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
  return { blob, width: W, height: H };
}

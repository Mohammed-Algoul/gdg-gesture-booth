/**
 * In-memory gallery of this session's photos. Nothing is uploaded or persisted;
 * closing the tab discards the photos (download them first).
 */
import { createZip } from './zip.js';

const pad = (n, w = 2) => String(n).padStart(w, '0');

export function photoFilename(date, index) {
  const d = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `gdg-booth-${d}-${t}-${pad(index, 3)}.png`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export class Gallery {
  constructor() {
    /** @type {Array<{id:number, blob:Blob, url:string, filename:string, date:Date, downloaded:boolean}>} */
    this.photos = [];
    this.counter = 0;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.photos);
  }

  add(blob) {
    const date = new Date();
    this.counter += 1;
    const photo = {
      id: this.counter,
      blob,
      url: URL.createObjectURL(blob),
      filename: photoFilename(date, this.counter),
      date,
      downloaded: false,
    };
    this.photos.unshift(photo);
    this.emit();
    return photo;
  }

  get(id) {
    return this.photos.find((p) => p.id === id);
  }

  download(id) {
    const p = this.get(id);
    if (!p) return;
    downloadBlob(p.blob, p.filename);
    p.downloaded = true;
    this.emit();
  }

  remove(id) {
    const i = this.photos.findIndex((p) => p.id === id);
    if (i < 0) return;
    URL.revokeObjectURL(this.photos[i].url);
    this.photos.splice(i, 1);
    this.emit();
  }

  clear() {
    for (const p of this.photos) URL.revokeObjectURL(p.url);
    this.photos = [];
    this.emit();
  }

  get hasUndownloaded() {
    return this.photos.some((p) => !p.downloaded);
  }

  async downloadAll() {
    if (!this.photos.length) return;
    const files = await Promise.all(
      [...this.photos].reverse().map(async (p) => ({
        name: p.filename,
        data: new Uint8Array(await p.blob.arrayBuffer()),
        date: p.date,
      })),
    );
    const zip = createZip(files);
    const now = new Date();
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    downloadBlob(new Blob([zip], { type: 'application/zip' }), `gdg-booth-photos-${stamp}.zip`);
    for (const p of this.photos) p.downloaded = true;
    this.emit();
  }
}

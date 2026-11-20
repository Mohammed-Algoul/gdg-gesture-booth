# Branding assets / ملفات الهوية

Both files are **optional**. Drop them here and reload the page.

| File | Effect |
|------|--------|
| `frame.png` | Full custom frame. Transparent PNG (e.g. 1920×1080). Replaces the generated frame completely; its size defines the size of the saved photo, and the camera is cropped (cover) to its aspect ratio. Keep the middle transparent. |
| `gdg-logo.png` | Logo used in the header of the generated frame (only when `frame.png` is absent). Transparent PNG, wide format works best (e.g. 400×250). |
| `icon.svg` | Browser tab icon. |

Header text of the generated frame lives in `src/config.js` → `FRAME_TEXT`.

# GDG Gesture Photo Booth

<p dir="rtl">

**كشك تصوير بالإيماءات لفعاليات GDG on Campus – Al-Aqsa University.**
افتح الكاميرا في المتصفح، اصنع شعار GDG بيديك <code dir="ltr">&lt; &gt;</code>، وسيبدأ عدّ تنازلي <code dir="ltr">3-2-1</code> ثم تُلتقط صورة بإطار GDG مدمج. يعمل بالكامل **بدون إنترنت**، ولا يرفع أي صورة، ولا يحتوي على أي تحليلات.

</p>

A gesture-triggered photo booth for GDG on Campus – Al-Aqsa University events. Make the GDG logo with your hands (sideways V-signs forming `<` and `>`), hold it for a moment, and the booth counts down 3-2-1 and captures a photo with the GDG frame baked in. Runs **fully offline**, uploads nothing, no analytics.

- [العربية](#العربية)
- [English](#english)

---

<div dir="rtl">

## العربية

### كيف يعمل؟

1. الكاميرا تُعرض بملء الشاشة (وضع المرآة) مع إطار GDG فوقها.
2. نموذج **MediaPipe Hand Landmarker** يعمل محليًا داخل المتصفح (WebAssembly + GPU) ويكتشف حتى يدين (لشخص واحد أو شخصين).
3. كل يد تُصنَّف: هل هي **علامة V جانبية** (السبابة + الوسطى ممدودتان، البنصر + الخنصر مثنيّان، والإبهام مُهمَل)، وهل الاتجاه **أفقي** وليس عموديًا مثل علامة السلام العادية؟
   - الأصابع تشير لليمين ← <code dir="ltr">&lt;</code>
   - الأصابع تشير لليسار ← <code dir="ltr">&gt;</code>
4. الشرط: <code dir="ltr">&lt;</code> على يسار الشاشة و <code dir="ltr">&gt;</code> على يمينها في نفس اللحظة (مع مراعاة المرآة).
5. يجب تثبيت الإشارة **~800ms** (قابلة للتعديل) لتجنّب الالتقاط الخاطئ، ثم عدّ تنازلي، وميض أبيض، ومعاينة للصورة.
6. بعد كل صورة توجد **فترة تهدئة ~4 ثوانٍ**، ويجب إنزال اليدين ثم إعادة الإشارة لالتقاط صورة جديدة.

الصورة النهائية = الصورة + الإطار فقط. **لا نصوص، لا تاريخ، لا علامات مائية، لا شعارات إضافية.**

### التشغيل محليًا (بدون إنترنت)

المتطلبات: Python 3 (موجود غالبًا) ومتصفح حديث (Chrome / Edge مُوصى به).

```bash
cd gdg-gesture-booth
python -m http.server 8000
```

ثم افتح: **http://localhost:8000**

> **ملاحظة لـ Windows:** إذا ظهرت صفحة فارغة، فغالبًا Windows يرسل ملفات ‎`.js`‎ بنوع MIME خاطئ. استخدم الخادم المرفق الذي يصلح ذلك ويفتح المتصفح تلقائيًا:
>
> ```bash
> python serve.py
> ```

كل الملفات المطلوبة موجودة داخل المستودع (مكتبة MediaPipe في ‎`vendor/`‎ والنموذج في ‎`models/`‎) — لا حاجة لـ npm أو إنترنت يوم الفعالية.

### إذن الكاميرا

- المتصفحات تسمح بالكاميرا فقط عبر **HTTPS** أو **http://localhost**. فتح الملف مباشرة (‎`file://`‎) أو عبر IP الشبكة (‎`http://192.168…`‎) **لن يعمل**.
- عند أول تشغيل اضغط **Allow / سماح**. إذا رفضت بالخطأ: اضغط أيقونة القفل/الكاميرا في شريط العنوان ← Camera ← Allow ثم أعد تحميل الصفحة.
- أغلق Zoom / Teams / OBS أو أي برنامج آخر يستخدم الكاميرا.
- لتجنّب طلب الإذن كل مرة: اختر «السماح دائمًا» في Chrome.

### قائمة التحقق يوم الفعالية ✅

**قبل الفعالية بيوم**
- [ ] شغّل التطبيق على اللابتوب نفسه وجرّب الإيماءة 10 مرات.
- [ ] تأكد أن التطبيق يعمل **بعد فصل الإنترنت**.
- [ ] اختر الكاميرا الصحيحة من الإعدادات (S) إذا كانت هناك كاميرا خارجية.
- [ ] جرّب «تحميل الكل» وتأكد من مكان حفظ التنزيلات.

**في القاعة**
- [ ] **الإضاءة:** الضوء يجب أن يكون **أمام** الأشخاص وليس خلفهم. تجنّب النوافذ خلف المصوَّرين (Backlight).
- [ ] **زاوية الكاميرا:** الكاميرا بمستوى الصدر/الوجه، على بُعد **1.5–2.5 متر**، بحيث تظهر اليدان والرأس داخل الإطار.
- [ ] **الخلفية:** خلفية بسيطة غير مزدحمة تحسّن الكشف.
- [ ] شغّل وضع التصحيح (D) وتأكد أن النقاط تظهر على اليدين، ثم أطفئه.
- [ ] اضبط **مدة التثبيت** و**دقة الكشف** من الإعدادات (S) حسب القاعة.
- [ ] شاشة كاملة (F)، وصل الشاحن، وأوقف وضع السكون/شاشة التوقف.
- [ ] **الخطة البديلة:** إذا لم تعمل الإيماءة، اضغط **Space** للالتقاط اليدوي (مع عد تنازلي).
- [ ] حمّل الصور دوريًا (G ← تحميل الكل ZIP) — الصور محفوظة في الذاكرة فقط وتضيع عند إغلاق الصفحة. أو فعّل «حفظ كل صورة تلقائيًا» من الإعدادات.

### اختصارات لوحة المفاتيح

| المفتاح | الوظيفة |
|---|---|
| <kbd>Space</kbd> | التقاط يدوي (بديل الإيماءة) / إغلاق المعاينة |
| <kbd>D</kbd> | إظهار/إخفاء نقاط اليد (Debug landmarks) |
| <kbd>F</kbd> | ملء الشاشة |
| <kbd>S</kbd> | الإعدادات |
| <kbd>G</kbd> | معرض صور الجلسة |
| <kbd>H</kbd> | المساعدة |
| <kbd>Esc</kbd> | إغلاق اللوحات / إلغاء العد التنازلي |

الاختصارات تعمل حتى مع لوحة المفاتيح العربية.

### الإعدادات (مفتاح S)

مدة التثبيت (Hold time)، فترة التهدئة (Cooldown)، دقة الكشف (Detection confidence)، أقصى ميل للعلامة (Max tilt)، مدة العد التنازلي، مدة المعاينة، الحفظ التلقائي، الأصوات، اختيار الكاميرا، وضع المرآة. تُحفظ الإعدادات في هذا المتصفح فقط.

### تغيير الإطار أو الشعار

- **إطار كامل جاهز:** ضع صورة PNG شفافة باسم ‎`assets/frame.png`‎ (مثلًا 1920×1080) بحيث يكون وسطها شفافًا. ستُستخدم بدل الإطار المولَّد، وحجمها يحدد حجم الصورة النهائية.
- **الشعار فقط:** ضع ‎`assets/gdg-logo.png`‎ (PNG شفاف) وسيظهر في رأس الإطار المولَّد.
- **نص الرأس:** عدّله في ‎`src/config.js`‎ ← ‎`FRAME_TEXT`‎.
- أعد تحميل الصفحة (Ctrl+Shift+R).

يمكن تصميم ‎`frame.png`‎ على Canva أو Figma: صدّره PNG بخلفية شفافة.

### ملف النموذج

النموذج موجود في المستودع: ‎`models/hand_landmarker.task`‎ (~7.8 MB). إذا كان مفقودًا سيعرض التطبيق رسالة خطأ واضحة ويبقى الالتقاط اليدوي (Space) يعمل. لإضافته:

1. نزّل الملف من:
   `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`
2. ضعه في ‎`models/hand_landmarker.task`‎ (بنفس الاسم).

أو: ‎`npm install && npm run vendor -- --model`‎.

### النشر على GitHub Pages

يوجد workflow في ‎`.github/workflows/pages.yml`‎ يشغّل الاختبارات ثم ينشر الموقع عند كل push إلى ‎`main`‎.
**مرة واحدة فقط:** Settings ← Pages ← Build and deployment ← Source: **GitHub Actions**.
بعد أول زيارة للموقع، يحفظ Service Worker الملفات ليعمل الموقع حتى لو انقطع الإنترنت.

### الخصوصية

- لا رفع للصور، لا تحليلات، لا CDN، لا طلبات خارجية.
- الصفحة محمية بـ **Content-Security-Policy** تسمح فقط بالاتصال بنفس الخادم. مكتبة MediaPipe تحاول إرسال إحصاءات استخدام إلى Google — هذا الطلب **محظور** بواسطة CSP، لذلك سترى رسالة حمراء واحدة في Console تقول إن الاتصال بـ ‎`odml.pa.googleapis.com`‎ مُنع. هذا متوقَّع ويعني أن الحماية تعمل.

</div>

---

## English

### How it works

1. Fullscreen, mirrored camera view with the GDG frame on top.
2. **MediaPipe Hand Landmarker** runs locally in the browser (WebAssembly, GPU with CPU fallback) and tracks up to 2 hands — one person or two.
3. Each hand is classified (`src/gesture.js`):
   - **chevron hand** = index + middle extended, ring + pinky folded (thumb ignored). Finger state is rotation-invariant: it compares the wrist→tip distance with the wrist→PIP distance.
   - the V must point roughly **horizontally** (default max tilt 40°), so an upright peace sign never counts. Angles are measured in real pixels (aspect-ratio aware).
   - fingers pointing right → `<`, pointing left → `>` (in mirrored display space).
4. Trigger: a `<` and a `>` visible at the same time with the `<` on the left of the screen and the `>` on the right.
5. The pose must be held **~800 ms** (configurable; short detection dropouts < 150 ms are tolerated), then 3-2-1 countdown → white flash → preview.
6. **~4 s cooldown** after each capture, and the pose must be released before it can trigger again.

The saved PNG is **photo + frame only** — no text, timestamp, watermark or extra logos.

### Run locally / offline

```bash
python -m http.server 8000
```

Open **http://localhost:8000**. Everything needed (MediaPipe runtime in `vendor/`, model in `models/`) is committed — no npm, no internet required on event day.

On Windows, if you get a blank page, Python may be serving `.js` with the wrong MIME type. Use the bundled server instead (also opens the browser):

```bash
python serve.py
```

### Camera permission

- Browsers only allow the camera on **HTTPS** or **http://localhost**. `file://` and plain `http://<LAN-IP>` will not work.
- Click **Allow** when prompted. If you blocked it: click the camera/lock icon in the address bar → Camera → Allow → reload.
- Close Zoom / Teams / OBS or anything else holding the camera.

### Event-day checklist

- [ ] Test on the exact laptop, **with Wi-Fi turned off**.
- [ ] **Lighting:** light in front of people, never a bright window behind them.
- [ ] **Camera angle:** chest/face height, people 1.5–2.5 m away, hands and heads inside the frame.
- [ ] Plain background if possible.
- [ ] Press **D** to check landmarks are tracked, then press D again.
- [ ] Tune hold time / confidence / max tilt in **S** if needed. Pick the external webcam there if you use one.
- [ ] Fullscreen (**F**), charger plugged in, sleep/screensaver disabled.
- [ ] **Fallback:** if the gesture struggles, press **Space** for a manual capture with countdown.
- [ ] Photos live in memory only — use **G → Download all (ZIP)** regularly, or enable *Auto-download* in settings.

### Keyboard shortcuts

`Space` manual capture / close preview · `D` debug landmarks · `F` fullscreen · `S` settings · `G` gallery · `H` help · `Esc` close / cancel countdown. Shortcuts use physical keys, so they also work with an Arabic keyboard layout.

### Replace the frame / logo

- `assets/frame.png` — full custom frame (transparent PNG, e.g. 1920×1080, transparent centre). Replaces the generated frame; its size defines the output photo size.
- `assets/gdg-logo.png` — logo for the generated frame header.
- Header text — `src/config.js` → `FRAME_TEXT`. Colors and default settings are in the same file.

Hard-reload (Ctrl+Shift+R) after changing assets.

### Model file

`models/hand_landmarker.task` (float16, ~7.8 MB, Apache-2.0) is committed. If it is ever missing the app shows a clear error and manual capture keeps working. To restore it, download
`https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`
into `models/hand_landmarker.task`, or run `npm install && npm run vendor -- --model`.

### Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs the unit tests and deploys on every push to `main`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
A service worker caches the app on first visit, so the hosted version keeps working if the venue loses internet.

### Privacy

No uploads, no analytics, no CDN, no external requests. A strict **Content-Security-Policy** (`connect-src 'self'`) enforces this in the browser. MediaPipe's bundle contains built-in usage logging to `odml.pa.googleapis.com`; the CSP blocks it, so you will see one red CSP message about that host in the console — that is expected and proves the block works.

### Development

```bash
npm test                 # node --test, no dependencies
npm install              # only needed to update MediaPipe
npm run vendor           # copy @mediapipe/tasks-vision into vendor/
npm run vendor -- --model   # …and download the model if missing
```

Unit tests (`tests/`) use synthetic landmark arrays: upright peace signs, open palms, fists, single hands and reversed `> <` must **not** trigger; sideways chevrons `< >` must, including mirrored input, 16:9 aspect ratio, tilt limits, and a third unrelated hand. The hold/cooldown tracker and the ZIP writer are tested too.

### Project structure

```
index.html                 page shell + strict CSP
sw.js                      offline cache (network-first)
serve.py                   local server with correct MIME types
src/
  main.js                  app controller (camera → detect → countdown → capture → gallery)
  gesture.js               pure gesture logic: classifier + hold/cooldown tracker
  detector.js              MediaPipe Hand Landmarker wrapper (local files only)
  camera.js                getUserMedia, camera list, friendly errors
  frame.js                 frame overlay (frame.png or generated SVG) + photo compositing
  gallery.js               in-memory session gallery, downloads
  zip.js                   dependency-free ZIP writer for "download all"
  sound.js                 synthesized beeps / shutter (WebAudio)
  settings.js, config.js   settings persistence, branding & defaults
  styles.css
assets/                    icon.svg, optional frame.png / gdg-logo.png
models/hand_landmarker.task
vendor/mediapipe/tasks-vision/   vendored MediaPipe runtime (v1.2.3)
scripts/vendor.mjs         re-vendor MediaPipe from node_modules
tests/                     node:test unit tests
.github/workflows/pages.yml
```

### Licenses

MediaPipe Tasks Vision and the Hand Landmarker model are © Google, Apache-2.0. GDG and Google names, logos and colors belong to Google; use them according to the GDG brand guidelines.

/**
 * Jeopardy! Bar League — Winners Graphic Generator
 *
 * Template: assets/frame.png  (~952 × 1190 px portrait)
 *
 * Measured zones (as fractions of template W × H):
 *
 *  Photo rectangle    x=0.048, y=0.345, w=0.904, h=0.415
 *  Team Name text     cx=0.360, cy=0.835   (inside left cell of bottom bar)
 *  Total Points text  cx=0.760, cy=0.835   (inside right cell of bottom bar)
 *  Bar Name text      cx=0.500, cy=0.950   (centred below the bottom bar)
 *
 * Adjust ZONES below if you swap the template for a different layout.
 */

'use strict';

// ─── Zone definitions (fractions 0–1) ───────────────────────────────────────
const ZONES = {
  // Large golden-bordered rectangle where the winner photo goes
  photo: { x: 0.052, y: 0.275, w: 0.896, h: 0.407 },

  // Bottom stats bar — left cell (Team Name) — inside bar, right of people icon
  teamName: { cx: 0.360, cy: 0.800 },

  // Bottom stats bar — right cell (Total Points) — inside bar, right of "?" icon
  totalPoints: { cx: 0.760, cy: 0.800 },

  // Below bottom bar (Bar Name)
  barName: { cx: 0.500, cy: 0.950 },
};

// Brand font stack — Swiss 911 / Swiss 921 Extra Compressed as specified in
// the Jeopardy Bar League guidelines; condensed system fonts as fallback.
const BRAND_FONT = '"Swiss 911 Extra Compressed BT", "Swiss 911 Extra Compressed", ' +
  '"Swiss 921 Extra Compressed", "Arial Narrow", Impact, "Haettenschweiler", Arial, sans-serif';

// ─── DOM refs ────────────────────────────────────────────────────────────────
const dropZone           = document.getElementById('drop-zone');
const photoInput         = document.getElementById('photo-input');
const fileNameEl         = document.getElementById('file-name');
const teamNameInput      = document.getElementById('team-name-input');
const totalPointsInput   = document.getElementById('total-points-input');
const barNameInput       = document.getElementById('bar-name-input');
const photoFitSelect     = document.getElementById('photo-fit-select');
const generateBtn        = document.getElementById('generate-btn');
const downloadBtn        = document.getElementById('download-btn');
const previewCanvas      = document.getElementById('preview-canvas');
const previewPlaceholder = document.getElementById('preview-placeholder');
const statusMsg          = document.getElementById('status-msg');

// ─── State ───────────────────────────────────────────────────────────────────
let photoObjectUrl = null;   // revokeable object URL for the uploaded photo
let frameImage     = null;   // HTMLImageElement — loaded once at startup
let composedCanvas = null;   // most recently rendered canvas (for download)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

/**
 * Draw `img` into the rectangle (rx, ry, rw, rh) on `ctx`.
 * fit = 'cover'   → fill rectangle, crop excess
 * fit = 'contain' → fit whole image inside rectangle, letterbox with black
 */
function drawImageInZone(ctx, img, rx, ry, rw, rh, fit) {
  ctx.save();

  if (fit === 'contain') {
    // Letterbox with semi-transparent black
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(rx, ry, rw, rh);
  }

  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();

  const imgAspect  = img.width / img.height;
  const zoneAspect = rw / rh;
  let sx, sy, sw, sh; // source crop rect

  if (fit === 'cover') {
    if (imgAspect > zoneAspect) {
      // image wider than zone — fit height, crop left/right
      sh = img.height;
      sw = sh * zoneAspect;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      // image taller than zone — fit width, crop top/bottom
      sw = img.width;
      sh = sw / zoneAspect;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, rx, ry, rw, rh);
  } else {
    // contain — scale to fit, centred
    const scale = Math.min(rw / img.width, rh / img.height);
    const dw = img.width  * scale;
    const dh = img.height * scale;
    const dx = rx + (rw - dw) / 2;
    const dy = ry + (rh - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  ctx.restore();
}

/**
 * Draw text centred at (cx, cy).
 * Automatically reduces fontSize until the text fits within maxWidth.
 * Draws a dark stroke first for legibility, then fills with `color`.
 */
function drawCentredText(ctx, text, cx, cy, maxWidth, fontSize, color, strokeColor) {
  if (!text || !text.trim()) return;

  ctx.font = `bold ${fontSize}px ${BRAND_FONT}`;

  // Shrink to fit
  while (ctx.measureText(text).width > maxWidth && fontSize > 6) {
    fontSize -= 1;
    ctx.font = `bold ${fontSize}px ${BRAND_FONT}`;
  }

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = Math.max(3, fontSize * 0.1);
    ctx.lineJoin    = 'round';
    ctx.strokeText(text, cx, cy);
  }

  ctx.fillStyle = color;
  ctx.fillText(text, cx, cy);
}

// ─── Core compose ─────────────────────────────────────────────────────────────

async function compose() {
  if (!frameImage)     throw new Error('Template image not loaded yet.');
  if (!photoObjectUrl) throw new Error('No winner photo selected.');

  const W = frameImage.naturalWidth;
  const H = frameImage.naturalHeight;

  const canvas  = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const pz = ZONES.photo;
  const rx = Math.round(pz.x * W);
  const ry = Math.round(pz.y * H);
  const rw = Math.round(pz.w * W);
  const rh = Math.round(pz.h * H);

  // 1 — Draw the winner photo into the photo zone first
  const photo = await loadImage(photoObjectUrl);
  drawImageInZone(ctx, photo, rx, ry, rw, rh, photoFitSelect.value);

  // 2 — Draw the template on top, but clip it so the photo zone is excluded.
  //     This keeps the border, logo, WINNERS text, and bottom bar intact
  //     while letting the photo show through the rectangle area.
  ctx.save();
  ctx.beginPath();
  // Clip region = full canvas MINUS the photo rectangle.
  // We do this with the even-odd fill rule: outer rect (whole canvas) + inner rect (photo zone).
  ctx.rect(0, 0, W, H);         // outer — whole canvas
  ctx.rect(rx, ry, rw, rh);     // inner — photo zone (will be excluded)
  ctx.clip('evenodd');
  ctx.drawImage(frameImage, 0, 0, W, H);
  ctx.restore();

  // 3 — Draw template again with no clip so the golden border strokes
  //     that sit ON the edge of the photo zone render correctly over the photo.
  //     We only need a thin strip around the rectangle, so clip to a slightly
  //     expanded ring around the photo zone (border ≈ 3% of width).
  const border = Math.round(W * 0.025);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx - border, ry - border, rw + border * 2, rh + border * 2); // ring area
  ctx.rect(rx + border, ry + border, rw - border * 2, rh - border * 2); // exclude interior
  ctx.clip('evenodd');
  ctx.drawImage(frameImage, 0, 0, W, H);
  ctx.restore();

  // 5 — Team Name  (golden yellow, condensed, dark stroke)
  const teamName = teamNameInput.value.trim();
  if (teamName) {
    drawCentredText(
      ctx, teamName.toUpperCase(),
      ZONES.teamName.cx * W,
      ZONES.teamName.cy * H,
      W * 0.28,              // max width ≈ left cell interior
      Math.round(H * 0.040), // font size ≈ 4% of height
      '#f5d76e',
      '#1a0f00'
    );
  }

  // 6 — Total Points  (golden yellow, slightly larger for the number)
  const totalPoints = totalPointsInput.value.trim();
  if (totalPoints) {
    drawCentredText(
      ctx, totalPoints,
      ZONES.totalPoints.cx * W,
      ZONES.totalPoints.cy * H,
      W * 0.24,
      Math.round(H * 0.045),
      '#f5d76e',
      '#1a0f00'
    );
  }

  // 7 — Bar Name  (white, smaller, centred below bottom bar)
  const barName = barNameInput.value.trim();
  if (barName) {
    drawCentredText(
      ctx, barName,
      ZONES.barName.cx * W,
      ZONES.barName.cy * H,
      W * 0.65,
      Math.round(H * 0.028),
      '#ffffff',
      '#000000'
    );
  }

  return canvas;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function setStatus(msg, type = '') {
  statusMsg.textContent = msg;
  statusMsg.className   = 'status-msg' + (type ? ` ${type}` : '');
}

function setPhotoFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('Please select a valid image file (JPEG, PNG, etc.).', 'error');
    return;
  }
  if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
  photoObjectUrl = URL.createObjectURL(file);
  fileNameEl.textContent = `✓ ${file.name}`;
  fileNameEl.hidden      = false;
  dropZone.classList.add('has-photo');
  generateBtn.disabled = false;
  setStatus('Photo ready — fill in the details and click Generate.');
}

async function handleGenerate() {
  if (!photoObjectUrl) {
    setStatus('Upload a winner photo first.', 'error');
    return;
  }

  generateBtn.disabled = true;
  downloadBtn.disabled = true;
  setStatus('Composing graphic…');

  try {
    composedCanvas = await compose();

    // Copy to visible preview canvas
    const ctx2 = previewCanvas.getContext('2d');
    previewCanvas.width  = composedCanvas.width;
    previewCanvas.height = composedCanvas.height;
    ctx2.drawImage(composedCanvas, 0, 0);

    previewCanvas.hidden      = false;
    previewPlaceholder.hidden = true;
    downloadBtn.disabled      = false;
    setStatus('Done! Click "Download PNG" to save.', 'success');
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, 'error');
  } finally {
    generateBtn.disabled = false;
  }
}

function handleDownload() {
  if (!composedCanvas) return;
  composedCanvas.toBlob((blob) => {
    if (!blob) { setStatus('Download failed — try again.', 'error'); return; }
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = 'jeopardy-bar-league-winners.png';
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Downloaded!', 'success');
  }, 'image/png');
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

dropZone.addEventListener('click', () => photoInput.click());
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); photoInput.click(); }
});

dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) setPhotoFile(e.dataTransfer.files[0]);
});

photoInput.addEventListener('change', () => {
  if (photoInput.files[0]) setPhotoFile(photoInput.files[0]);
});

generateBtn.addEventListener('click', handleGenerate);
downloadBtn.addEventListener('click', handleDownload);

// Re-enable Generate whenever any field changes (so edits trigger a re-render)
[teamNameInput, totalPointsInput, barNameInput, photoFitSelect].forEach((el) => {
  el.addEventListener('input', () => {
    if (photoObjectUrl) generateBtn.disabled = false;
  });
});

// ─── Load template on startup ─────────────────────────────────────────────────

loadImage('assets/frame.png')
  .then((img) => {
    frameImage = img;
    setStatus('Template loaded — upload a winner photo to begin.');
  })
  .catch(() => {
    setStatus('⚠ Could not load assets/frame.png — make sure the file is in the assets folder.', 'error');
  });

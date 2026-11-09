'use strict';

const byId = id => document.getElementById(id);
const canvas = byId('frame');
const context = canvas.getContext('2d', { willReadFrequently: true });
const storageKey = 'ewm-dock-inspection-v1';
let receipt = null;
let capture = null;
let captureVersion = 0;
let savedRecords = [];
try {
  const previous = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(previous)) savedRecords = previous;
} catch {
  byId('review-result').textContent = 'Saved records could not be read in this browser.';
}

function setReviewEnabled(enabled) {
  byId('confirm').disabled = !enabled;
  byId('clear').disabled = !enabled;
}

function clearCapture() {
  captureVersion++;
  capture = null;
  canvas.hidden = true;
  byId('placeholder').hidden = false;
  byId('note').value = '';
  byId('review-result').textContent = '';
  setReviewEnabled(false);
}

function setReceipt(next) {
  receipt = next;
  clearCapture();
  for (const button of byId('controls').querySelectorAll('button')) button.disabled = !receipt;
  byId('vision-result').className = 'muted';
  byId('vision-result').textContent = receipt ? 'Choose a sample or open a photo.' : 'Verify a scan to begin.';
  byId('scan-result').textContent = receipt
    ? `${receipt.delivery} · ${receipt.supplier} · ${receipt.cartons} cartons`
    : 'Waiting for a scan';
}

function verifyScan(event) {
  event.preventDefault();
  setReceipt(resolveScan(byId('scan').value));
  if (!receipt) byId('scan-result').textContent = 'Barcode not found. Try HU-1001.';
}

function drawSample(kind) {
  const { width, height } = canvas;
  context.fillStyle = '#273d43';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#aa8156';
  context.fillRect(102, 48, 436, 272);
  context.fillStyle = '#c9a274';
  context.fillRect(111, 56, 418, 253);
  context.fillStyle = '#60462d';
  context.fillRect(112, 179, 416, 3);
  context.fillStyle = '#ead8b7';
  context.fillRect(131, 76, 126, 60);
  context.fillStyle = '#263338';
  context.font = 'bold 18px monospace';
  context.fillText('HU-1001', 141, 99);
  for (let index = 0; index < 30; index++) {
    if (index % 5 !== 0) context.fillRect(141 + index * 3, 108, index % 3 === 0 ? 2 : 1, 17);
  }
  context.fillStyle = '#246be0';
  context.fillRect(153, 169, 334, 23);
  if (kind === 'broken') {
    context.fillStyle = '#b28a5d';
    context.beginPath();
    context.moveTo(302, 166);
    context.lineTo(343, 166);
    context.lineTo(333, 194);
    context.lineTo(296, 194);
    context.closePath();
    context.fill();
  }
  context.fillStyle = '#594128';
  context.font = 'bold 18px system-ui';
  context.fillText('BEARING CARTONS', 135, 277);
}

function inspectCapture(source) {
  const photo = canvas.toDataURL('image/jpeg', 0.88);
  const assessment = inspectSeal(context.getImageData(0, 0, canvas.width, canvas.height));
  capture = { eventId: crypto.randomUUID(), photo, assessment: { ...assessment, source } };
  const { region, gap } = assessment;
  context.lineWidth = 3;
  context.strokeStyle = '#f8f9fc';
  context.setLineDash([6, 4]);
  context.strokeRect(region.left, region.top, region.right - region.left, region.bottom - region.top);
  context.setLineDash([]);
  if (gap) {
    context.lineWidth = 4;
    context.strokeStyle = '#fc482e';
    context.strokeRect(gap.left - 3, region.top - 4, gap.width + 6, region.bottom - region.top + 8);
  }
  canvas.hidden = false;
  byId('placeholder').hidden = true;
  const result = byId('vision-result');
  if (assessment.status === 'suspected-damage') {
    result.className = 'muted alert';
    result.textContent = 'Possible broken seal. Review the highlighted gap.';
  } else if (assessment.status === 'unreadable') {
    result.className = 'muted alert';
    result.textContent = 'Seal could not be read. Retake the photo with the blue seal centered.';
  } else {
    result.className = 'muted success';
    result.textContent = 'No gap detected. Inspect the seal before marking it intact.';
  }
  setReviewEnabled(assessment.status !== 'unreadable');
}

async function loadPhoto(file) {
  if (!receipt || !file) return;
  clearCapture();
  const version = captureVersion;
  try {
    if (file.size > 12_000_000) throw new Error('Choose an image under 12 MB.');
    const image = await createImageBitmap(file);
    try {
      if (version !== captureVersion) return;
      // Preserve the photo aspect ratio and center it in the station frame.
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.fillStyle = '#273d43';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      inspectCapture('uploaded-photo');
    } finally {
      image.close();
    }
  } catch (error) {
    if (version !== captureVersion) return;
    byId('vision-result').className = 'muted alert';
    byId('vision-result').textContent = file.size > 12_000_000 ? error.message : 'Could not open this photo. Try a JPEG, PNG, or WebP image.';
  }
}

function exportEvidence(record) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `inspection-${record.receipt.hu}-${record.eventId}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderRecords() {
  const list = byId('records');
  list.replaceChildren();
  for (const record of savedRecords) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    const detail = document.createElement('p');
    const download = document.createElement('button');
    title.textContent = `${record.receipt.hu} · ${record.operatorDecision === 'damage-confirmed' ? 'Damage confirmed' : 'Marked intact'}`;
    detail.className = 'muted';
    detail.textContent = `${record.receipt.delivery} · ${new Date(record.reviewedAt).toLocaleString()}`;
    download.className = 'secondary';
    download.textContent = 'Export evidence';
    download.addEventListener('click', () => exportEvidence(record));
    item.append(title, detail, download);
    list.append(item);
  }
  if (!savedRecords.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No inspections yet.';
    empty.className = 'muted';
    list.append(empty);
  }
}

function saveDecision(decision) {
  if (!receipt || !capture || savedRecords.some(record => record.eventId === capture.eventId)) return;
  const record = createEvidence({ ...capture, receipt, decision, note: byId('note').value, reviewedAt: new Date().toISOString() });
  const updated = [record, ...savedRecords];
  try {
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch {
    byId('review-result').textContent = 'Browser storage unavailable. Downloading the evidence package instead.';
    setReviewEnabled(false);
    exportEvidence(record);
    return;
  }
  savedRecords = updated;
  byId('review-result').textContent = `Evidence saved for ${receipt.hu}.`;
  setReviewEnabled(false);
  renderRecords();
}

byId('scan-form').addEventListener('submit', verifyScan);
byId('scan').addEventListener('input', () => setReceipt(null));
byId('example').addEventListener('click', () => {
  byId('scan').value = 'HU-1001';
  byId('scan-form').requestSubmit();
});
for (const button of document.querySelectorAll('[data-sample]')) {
  button.addEventListener('click', () => {
    clearCapture();
    drawSample(button.dataset.sample);
    inspectCapture(`sample-${button.dataset.sample}`);
  });
}
byId('upload').addEventListener('click', () => byId('file').click());
byId('file').addEventListener('change', event => {
  const file = event.target.files[0];
  event.target.value = '';
  loadPhoto(file);
});
byId('confirm').addEventListener('click', () => saveDecision('damage-confirmed'));
byId('clear').addEventListener('click', () => saveDecision('marked-intact'));
renderRecords();

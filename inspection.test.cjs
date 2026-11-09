const assert = require('node:assert/strict');
const test = require('node:test');
const { inspectSeal, resolveScan, createEvidence } = require('./inspection.js');

function frame(segments) {
  const width = 640;
  const height = 360;
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [start, end] of segments) {
    for (let y = 169; y < 192; y++) {
      for (let x = start; x < end; x++) data.set([36, 107, 224, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

test('reports a substantial gap and locates it on the photo', () => {
  const result = inspectSeal(frame([[153, 300], [340, 488]]));
  assert.equal(result.status, 'suspected-damage');
  assert.deepEqual(result.gap, { left: 300, width: 40 });
});

test('accepts a continuous seal and tolerates a small break from glare', () => {
  assert.equal(inspectSeal(frame([[153, 488]])).status, 'no-gap-found');
  assert.equal(inspectSeal(frame([[153, 318], [322, 488]])).status, 'no-gap-found');
});

test('requires a retake when the seal is missing or mostly outside the expected region', () => {
  assert.equal(inspectSeal(frame([])).status, 'unreadable');
  assert.equal(inspectSeal(frame([[153, 220]])).status, 'unreadable');
});

test('matches a known barcode and rejects unknown or inherited keys', () => {
  assert.equal(resolveScan(' hu-1001 ').delivery, 'DEMO-180002142');
  assert.equal(resolveScan('HU-9999'), null);
  assert.equal(resolveScan('constructor'), null);
});

test('preserves the inspected receipt, evidence and independent operator decision', () => {
  const input = {
    eventId: 'test-event', receipt: resolveScan('HU-1001'), photo: 'data:image/jpeg;base64,example',
    assessment: inspectSeal(frame([[153, 300], [340, 488]])), decision: 'marked-intact',
    note: ' Reflection on seal ', reviewedAt: '2026-11-10T09:00:00Z',
  };
  const record = createEvidence(input);
  assert.equal(record.receipt.hu, 'HU-1001');
  assert.equal(record.assessment.status, 'suspected-damage');
  assert.equal(record.operatorDecision, 'marked-intact');
  assert.equal(record.evidenceImage, input.photo);
  assert.equal(record.note, 'Reflection on seal');
  assert.throws(() => createEvidence({ ...input, assessment: { status: 'unreadable' } }));
});

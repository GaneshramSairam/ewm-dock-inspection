'use strict';

// A controlled station expects a horizontal blue seal in this region.
function inspectSeal({ data, width, height }) {
  const left = Math.round(width * 0.24);
  const right = Math.round(width * 0.76);
  const top = Math.round(height * 0.45);
  const bottom = Math.round(height * 0.55);
  const region = { left, right, top, bottom };
  const present = [];
  for (let x = left; x < right; x++) {
    let bluePixels = 0;
    for (let y = top; y < bottom; y++) {
      const offset = (y * width + x) * 4;
      const [red, green, blue] = [data[offset], data[offset + 1], data[offset + 2]];
      if (blue >= 95 && blue > red * 1.6 && blue > green * 1.25) bluePixels++;
    }
    present.push(bluePixels >= Math.max(1, Math.ceil((bottom - top) * 0.18)));
  }
  const first = present.indexOf(true);
  const last = present.lastIndexOf(true);
  if (first < 0 || (last - first + 1) / present.length < 0.80) {
    return { status: 'unreadable', region, gap: null };
  }
  let longest = 0;
  let gapStart = 0;
  let run = 0;
  for (let index = first; index <= last; index++) {
    run = present[index] ? 0 : run + 1;
    if (run > longest) {
      longest = run;
      gapStart = index - run + 1;
    }
  }
  const damaged = longest / present.length >= 0.06;
  return {
    status: damaged ? 'suspected-damage' : 'no-gap-found',
    region,
    gap: damaged ? { left: left + gapStart, width: longest } : null,
  };
}

const receipts = Object.freeze({
  'HU-1001': Object.freeze({ hu: 'HU-1001', delivery: 'DEMO-180002142', supplier: 'Example Bearings', item: 'Bearing cartons', cartons: 20 }),
});

function resolveScan(value) {
  const key = value.trim().toUpperCase();
  return Object.hasOwn(receipts, key) ? receipts[key] : null;
}

function createEvidence({ eventId, receipt, photo, assessment, decision, note, reviewedAt }) {
  if (!eventId || !receipt || !photo || assessment?.status === 'unreadable' || !assessment) {
    throw new Error('A verified handling unit and readable capture are required.');
  }
  if (!['damage-confirmed', 'marked-intact'].includes(decision)) throw new Error('Operator decision required.');
  return {
    schemaVersion: 1, eventId, reviewedAt, station: 'DEMO-LANE-01',
    receipt, assessment, operatorDecision: decision, note: note.trim(),
    evidenceImage: photo, sapIntegration: 'mock',
  };
}

if (typeof module !== 'undefined') module.exports = { inspectSeal, resolveScan, createEvidence };

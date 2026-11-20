import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { classifyHand, evaluateFrame, fingerState, GestureTracker, LM } from '../src/gesture.js';
import { makeHand, flipX, leftChevron, rightChevron } from './helpers/hands.js';

// Hands built by the helper are in display space, so most tests use mirrored: false.
const DISPLAY = { mirrored: false };

describe('fingerState', () => {
  test('detects extended and folded fingers', () => {
    const hand = makeHand();
    const pts = hand.map((p) => ({ x: p.x, y: p.y }));
    assert.equal(fingerState(pts, 'index'), 'extended');
    assert.equal(fingerState(pts, 'middle'), 'extended');
    assert.equal(fingerState(pts, 'ring'), 'folded');
    assert.equal(fingerState(pts, 'pinky'), 'folded');
  });

  test('is rotation invariant', () => {
    for (const angleDeg of [0, 45, 90, 135, 180, -45, -90, -135]) {
      const pts = makeHand({ angleDeg });
      assert.equal(fingerState(pts, 'index'), 'extended', `index @ ${angleDeg}°`);
      assert.equal(fingerState(pts, 'ring'), 'folded', `ring @ ${angleDeg}°`);
    }
  });
});

describe('classifyHand', () => {
  test('sideways V pointing right is "<"', () => {
    const r = classifyHand(makeHand({ angleDeg: 0 }), DISPLAY);
    assert.equal(r.isChevron, true);
    assert.equal(r.shape, '<');
    assert.equal(r.reason, 'ok');
  });

  test('sideways V pointing left is ">"', () => {
    const r = classifyHand(makeHand({ angleDeg: 180 }), DISPLAY);
    assert.equal(r.isChevron, true);
    assert.equal(r.shape, '>');
  });

  test('upright peace sign is NOT a chevron', () => {
    const r = classifyHand(makeHand({ angleDeg: -90 }), DISPLAY);
    assert.equal(r.isChevron, false);
    assert.equal(r.shape, null);
    assert.equal(r.reason, 'not-horizontal');
  });

  test('upside-down V is NOT a chevron', () => {
    assert.equal(classifyHand(makeHand({ angleDeg: 90 }), DISPLAY).isChevron, false);
  });

  test('slightly tilted chevron (25°) still counts, steep tilt (60°) does not', () => {
    assert.equal(classifyHand(makeHand({ angleDeg: -25 }), DISPLAY).shape, '<');
    assert.equal(classifyHand(makeHand({ angleDeg: 180 + 25 }), DISPLAY).shape, '>');
    assert.equal(classifyHand(makeHand({ angleDeg: -60 }), DISPLAY).isChevron, false);
  });

  test('maxTiltDeg is configurable', () => {
    const hand = makeHand({ angleDeg: -50 });
    assert.equal(classifyHand(hand, DISPLAY).isChevron, false);
    assert.equal(classifyHand(hand, { ...DISPLAY, maxTiltDeg: 55 }).isChevron, true);
  });

  test('sideways open palm is NOT a chevron', () => {
    const r = classifyHand(
      makeHand({ extended: { index: true, middle: true, ring: true, pinky: true } }),
      DISPLAY,
    );
    assert.equal(r.isChevron, false);
    assert.equal(r.reason, 'ring-pinky-not-folded');
  });

  test('sideways fist / single pointing finger is NOT a chevron', () => {
    const fist = classifyHand(makeHand({ extended: {} }), DISPLAY);
    assert.equal(fist.isChevron, false);
    const point = classifyHand(makeHand({ extended: { index: true } }), DISPLAY);
    assert.equal(point.isChevron, false);
    assert.equal(point.reason, 'index-middle-not-extended');
  });

  test('mirroring converts raw camera coordinates to display coordinates', () => {
    // In the raw (un-mirrored) camera frame the fingers point right…
    const raw = makeHand({ cx: 0.3, angleDeg: 0 });
    // …but on a mirrored screen they point left and sit on the right side.
    const r = classifyHand(raw, { mirrored: true });
    assert.equal(r.shape, '>');
    assert.ok(Math.abs(r.centerX - 0.7) < 1e-9);
    assert.equal(classifyHand(raw, { mirrored: false }).shape, '<');
  });

  test('aspect ratio is respected (16:9 frame)', () => {
    const aspectRatio = 16 / 9;
    // Horizontal in real pixels.
    const hand = makeHand({ angleDeg: 0, aspectRatio });
    assert.equal(classifyHand(hand, { ...DISPLAY, aspectRatio }).shape, '<');
    // 35° in real pixels: fine with the correct aspect ratio…
    const tilted = makeHand({ angleDeg: -35, aspectRatio });
    assert.equal(classifyHand(tilted, { ...DISPLAY, aspectRatio }).isChevron, true);
    // …but would look like ~51° if the aspect ratio were ignored.
    assert.equal(classifyHand(tilted, { ...DISPLAY, aspectRatio: 1 }).isChevron, false);
  });

  test('rejects malformed input', () => {
    assert.equal(classifyHand([], DISPLAY).isChevron, false);
    assert.equal(classifyHand(null, DISPLAY).reason, 'invalid-landmarks');
  });

  test('ignores the thumb', () => {
    const hand = makeHand();
    // Move the thumb tip somewhere absurd.
    hand[LM.THUMB_TIP] = { x: 0.9, y: 0.05, z: 0 };
    assert.equal(classifyHand(hand, DISPLAY).shape, '<');
  });
});

describe('evaluateFrame (trigger condition)', () => {
  test('"<" on the left + ">" on the right triggers', () => {
    const r = evaluateFrame([leftChevron(), rightChevron()], DISPLAY);
    assert.equal(r.gesture, true);
    assert.deepEqual(r.pair, [0, 1]);
  });

  test('hand order in the result list does not matter', () => {
    const r = evaluateFrame([rightChevron(), leftChevron()], DISPLAY);
    assert.equal(r.gesture, true);
    assert.deepEqual(r.pair, [1, 0]);
  });

  test('works with mirrored (raw camera) landmarks', () => {
    const raw = [flipX(leftChevron()), flipX(rightChevron())];
    const r = evaluateFrame(raw, { mirrored: true });
    assert.equal(r.gesture, true);
    assert.deepEqual(r.hands.map((h) => h.shape).sort(), ['<', '>']);
  });

  test('single chevron hand does NOT trigger', () => {
    assert.equal(evaluateFrame([leftChevron()], DISPLAY).gesture, false);
    assert.equal(evaluateFrame([rightChevron()], DISPLAY).gesture, false);
  });

  test('no hands does NOT trigger', () => {
    assert.equal(evaluateFrame([], DISPLAY).gesture, false);
    assert.equal(evaluateFrame(undefined, DISPLAY).gesture, false);
  });

  test('two upright peace signs do NOT trigger', () => {
    const r = evaluateFrame(
      [makeHand({ cx: 0.3, angleDeg: -90 }), makeHand({ cx: 0.7, angleDeg: -90 })],
      DISPLAY,
    );
    assert.equal(r.gesture, false);
  });

  test('two chevrons pointing the same way do NOT trigger', () => {
    const r = evaluateFrame([leftChevron(), makeHand({ cx: 0.7, angleDeg: 0 })], DISPLAY);
    assert.equal(r.gesture, false);
  });

  test('reversed "> <" (pointing outward) does NOT trigger', () => {
    const r = evaluateFrame(
      [makeHand({ cx: 0.3, angleDeg: 180 }), makeHand({ cx: 0.7, angleDeg: 0 })],
      DISPLAY,
    );
    assert.equal(r.hands[0].shape, '>');
    assert.equal(r.hands[1].shape, '<');
    assert.equal(r.gesture, false);
  });

  test('one chevron + one peace sign does NOT trigger', () => {
    const r = evaluateFrame([leftChevron(), makeHand({ cx: 0.7, angleDeg: -90 })], DISPLAY);
    assert.equal(r.gesture, false);
  });

  test('two people: works with a third, unrelated hand in view', () => {
    const r = evaluateFrame(
      [makeHand({ cx: 0.5, angleDeg: -90 }), leftChevron({ cx: 0.2 }), rightChevron({ cx: 0.85 })],
      DISPLAY,
    );
    assert.equal(r.gesture, true);
    assert.deepEqual(r.pair, [1, 2]);
  });

  test('overlapping hands (too close) do NOT trigger', () => {
    const r = evaluateFrame([leftChevron({ cx: 0.5 }), rightChevron({ cx: 0.51 })], DISPLAY);
    assert.equal(r.gesture, false);
  });
});

describe('GestureTracker', () => {
  test('triggers only after the gesture is held for holdMs', () => {
    const t = new GestureTracker({ holdMs: 800, cooldownMs: 4000 });
    assert.equal(t.update(true, 0).state, 'holding');
    assert.equal(t.update(true, 400).triggered, false);
    const mid = t.update(true, 400);
    assert.ok(Math.abs(mid.progress - 0.5) < 1e-9);
    assert.equal(t.update(true, 799).triggered, false);
    const r = t.update(true, 800);
    assert.equal(r.triggered, true);
    assert.equal(r.state, 'triggered');
  });

  test('losing the gesture resets the hold timer (beyond the grace period)', () => {
    const t = new GestureTracker({ holdMs: 800, graceMs: 150 });
    t.update(true, 0);
    t.update(true, 500);
    assert.equal(t.update(false, 900).state, 'idle');
    t.update(true, 1000);
    assert.equal(t.update(true, 1700).triggered, false);
    assert.equal(t.update(true, 1800).triggered, true);
  });

  test('a short dropout inside the grace period does not reset', () => {
    const t = new GestureTracker({ holdMs: 800, graceMs: 150 });
    t.update(true, 0);
    t.update(true, 500);
    assert.equal(t.update(false, 600).state, 'holding');
    assert.equal(t.update(true, 650).state, 'holding');
    assert.equal(t.update(true, 800).triggered, true);
  });

  test('cooldown blocks triggers, then requires release', () => {
    const t = new GestureTracker({ holdMs: 800, cooldownMs: 4000 });
    t.update(true, 0);
    assert.equal(t.update(true, 800).triggered, true);
    t.startCooldown(1000);
    assert.equal(t.update(true, 2000).state, 'cooldown');
    assert.equal(t.update(true, 4999).state, 'cooldown');
    // Cooldown over, but the gesture was never released → no new trigger.
    assert.equal(t.update(true, 5000).state, 'idle');
    assert.equal(t.update(true, 6000).triggered, false);
    // Release, then hold again.
    t.update(false, 6100);
    t.update(true, 6200);
    assert.equal(t.update(true, 7000).triggered, true);
  });

  test('busy state pauses tracking', () => {
    const t = new GestureTracker({ holdMs: 100 });
    t.setBusy(true);
    assert.equal(t.update(true, 0).state, 'busy');
    assert.equal(t.update(true, 500).triggered, false);
    t.setBusy(false);
    t.update(false, 600);
    t.update(true, 700);
    assert.equal(t.update(true, 800).triggered, true);
  });

  test('options can be changed at runtime', () => {
    const t = new GestureTracker({ holdMs: 800 });
    t.setOptions({ holdMs: 200 });
    t.update(true, 0);
    assert.equal(t.update(true, 200).triggered, true);
  });
});

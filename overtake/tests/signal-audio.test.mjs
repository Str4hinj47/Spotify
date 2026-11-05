import test from 'node:test';
import assert from 'node:assert/strict';
import { signalAudioTransition } from '../src/signal-audio.mjs';

test('indicator relay clicks once per visual phase, follows side changes and stops on cancel', () => {
  let state = { side:null, lit:false };
  const update = (side, lit, active = true) => {
    const next = signalAudioTransition(state.side, state.lit, side, lit, active);
    state = next; return next.click;
  };
  assert.equal(update('left', true), 'on');
  assert.equal(update('left', true), null);
  assert.equal(update('left', false), 'off');
  assert.equal(update('left', false), null);
  assert.equal(update('left', true), 'on');
  assert.equal(update('right', true), 'on');
  assert.equal(update(null, false), null);
  assert.equal(update(null, false), null);
});

test('pause clears the clock and resuming mid-off does not invent a click', () => {
  const paused = signalAudioTransition('left', true, 'left', true, false);
  assert.deepEqual(paused, {side:null, lit:false, click:null});
  const resumedOff = signalAudioTransition(paused.side, paused.lit, 'left', false, true);
  assert.equal(resumedOff.click, null);
  assert.equal(signalAudioTransition(resumedOff.side, resumedOff.lit, 'left', true, true).click, 'on');
});

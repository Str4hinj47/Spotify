import test from 'node:test';
import assert from 'node:assert/strict';
import { assessOvertake } from '../src/overtake-coach.mjs';

const player = { s: 0, offset: 2.1, speed: 30, length: 4.5 };
const car = (s, speed, dir = 1, offset = 2.1, length = 4.5) => ({ s, speed, dir, offset, length });

test('coach hides when there is no slower leader', () => {
  assert.equal(assessOvertake(player, []).state, 'clear');
  assert.equal(assessOvertake(player, [car(60, 32)]).state, 'clear');
});

test('coach offers a pass window when oncoming is far enough away', () => {
  const c = assessOvertake(player, [car(45, 18), car(500, 28, -1, -2.1)]);
  assert.equal(c.state, 'go');
  assert.ok(c.seconds > 0);
});

test('coach waits when an oncoming car closes the window', () => {
  const c = assessOvertake(player, [car(45, 18), car(110, 28, -1, -2.1)]);
  assert.equal(c.state, 'wait');
});

test('coach asks the player to return after clearing the target', () => {
  const p = { ...player, offset: -1.2 };
  assert.equal(assessOvertake(p, [car(-12, 18)]).state, 'return');
});

test('coach escalates to return-now when oncoming is close in the pass lane', () => {
  const p = { ...player, offset: -1.2 };
  const c = assessOvertake(p, [car(45, 18), car(80, 28, -1, -2.1)]);
  assert.equal(c.state, 'danger');
});

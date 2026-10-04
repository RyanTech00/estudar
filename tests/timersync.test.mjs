import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSharedTimer, newerTimer, timerKey, drivesTimer } from '../public/js/timersync.js';
import { cleanDocument } from '../public/js/backup.js';

const PC = { phase: 'work', state: 'running', endsAt: 2_000_000, remainingMs: 2_400_000, sessionsCompleted: 1, subject: 'ed', probe: null, device: 'pc01', at: 1_000_000 };

test('shared timer: the phone picks up the computer\'s running block, from the same end time', () => {
  const t = cleanSharedTimer(PC);
  assert.deepEqual(t, PC);
  assert.equal(cleanSharedTimer({ ...PC, state: 'exploding' }), null);
  assert.equal(cleanSharedTimer({ ...PC, at: 'x' }), null);
  assert.equal(cleanSharedTimer({ ...PC, subject: '<img src=x>' }).subject, null);
  assert.deepEqual(cleanSharedTimer({ ...PC, probe: { minutes: 30 } }).probe, { minutes: 30 });
  // It travels inside the synced document, so the document cleaner keeps it.
  assert.deepEqual(cleanDocument({ timer: PC }).timer, PC);
  assert.equal(cleanDocument({}).timer, null);
});

test('shared timer: the latest change wins; only the device driving it logs the block', () => {
  const paused = { ...PC, state: 'paused', remainingMs: 600_000, device: 'phone1', at: 1_000_500 };
  assert.equal(newerTimer(PC, paused), paused);
  assert.equal(newerTimer(paused, PC), paused);
  assert.equal(newerTimer(null, PC), PC);
  assert.equal(drivesTimer(paused, 'phone1'), true);
  assert.equal(drivesTimer(paused, 'pc01'), false);
  assert.equal(drivesTimer(null, 'pc01'), true);
  // Same state seen again (our own change coming back) has the same key, whoever sent it.
  assert.equal(timerKey({ ...PC, device: 'x', at: 9 }), timerKey(PC));
  assert.notEqual(timerKey(paused), timerKey(PC));
});

test('shared timer: clocks a second apart still end the block on the same instant', async () => {
  const { clockOffset, toServerClock, toLocalClock } = await import('../public/js/timersync.js');
  // The phone's clock is 1.3 s behind the server; the trip with the shortest round trip is trusted.
  assert.equal(clockOffset([[1000, 2400, 1200], [5000, 6340, 5080], [9000, 10900, 9600]]), 1300);
  assert.equal(clockOffset([]), 0);
  assert.equal(clockOffset([[5, 'x', 6]]), 0);
  // The computer (clock 0.4 s ahead) shares a block; the phone (1.3 s behind) shows the same instant.
  const pcOffset = -400, phoneOffset = 1300;
  const pcEnds = 10_000_400;
  const shared = toServerClock({ state: 'running', endsAt: pcEnds }, pcOffset);
  assert.equal(shared.endsAt, 10_000_000);
  assert.equal(toLocalClock(shared, phoneOffset).endsAt, 9_998_700);
  assert.equal(toLocalClock({ state: 'paused', endsAt: 0 }, phoneOffset).endsAt, 0);
});

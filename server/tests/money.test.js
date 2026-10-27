import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scaleAmounts, sum } from '../src/utils/money.js';
import { canGigTransition, canMilestoneTransition } from '../src/services/stateMachine.js';

describe('scaleAmounts', () => {
  it('keeps proportions and always sums to the new total', () => {
    assert.deepEqual(scaleAmounts([1000, 1000, 1000], 2700), [900, 900, 900]);
    assert.equal(sum(scaleAmounts([333, 333, 334], 1001)), 1001);
    assert.equal(sum(scaleAmounts([1, 1, 998], 5)), 5);
    for (const a of scaleAmounts([1, 1, 998], 5)) assert.ok(a >= 1);
  });

  it('refuses totals too small for the milestone count', () => {
    assert.throws(() => scaleAmounts([10, 10, 10], 2));
  });
});

describe('state machine', () => {
  it('allows the happy path and blocks illegal jumps', () => {
    assert.ok(canGigTransition('open', 'accepted'));
    assert.ok(canGigTransition('accepted', 'in_progress'));
    assert.ok(!canGigTransition('in_progress', 'cancelled'));
    assert.ok(!canGigTransition('open', 'in_progress'));
    assert.ok(canMilestoneTransition('funded', 'submitted'));
    assert.ok(!canMilestoneTransition('funded', 'released'));
    assert.ok(!canMilestoneTransition('released', 'released'));
    assert.ok(!canMilestoneTransition('pending', 'submitted'));
  });
});

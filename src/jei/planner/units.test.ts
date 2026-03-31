import { describe, expect, it } from 'vitest';
import { rational } from './rational';
import { ObjectiveUnit } from './types';
import { convertFromPerSecond, convertToPerSecond } from './units';

describe('planner units', () => {
  it('treats item-count objectives like per-minute values for LP conversion', () => {
    expect(convertToPerSecond(rational(60), ObjectiveUnit.Items).toNumber()).toBe(1);
    expect(convertFromPerSecond(rational(1), ObjectiveUnit.Items).toNumber()).toBe(60);
  });
});

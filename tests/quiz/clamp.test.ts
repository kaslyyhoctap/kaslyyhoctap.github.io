import { describe, it, expect } from 'vitest';
import { clampInt } from '@/lib/quiz/pool';

// B06 regression: the clamp must assert real VALUES, not just "doesn't
// crash" — count=-5 selected 85 questions and time=-5 instant-submitted
// before the clamp. Page bounds: count 1–100 (default 20), time 1–180
// (default 20); values arrive from the URL as strings.

describe('clampInt — count bounds (1–100, default 20)', () => {
  it('negative clamps up to the minimum', () => {
    expect(clampInt(-5, 1, 100, 20)).toBe(1);
    expect(clampInt('-5', 1, 100, 20)).toBe(1);
    expect(clampInt(0, 1, 100, 20)).toBe(1);
  });

  it('huge values clamp down to the maximum', () => {
    expect(clampInt(1000000, 1, 100, 20)).toBe(100);
    expect(clampInt(101, 1, 100, 20)).toBe(100);
  });

  it('non-numeric / missing falls back to the default', () => {
    expect(clampInt('x', 1, 100, 20)).toBe(20);
    expect(clampInt(undefined, 1, 100, 20)).toBe(20);
    expect(clampInt(NaN, 1, 100, 20)).toBe(20);
  });

  it('in-range values pass through (floored, not rounded)', () => {
    expect(clampInt(20, 1, 100, 20)).toBe(20);
    expect(clampInt('20', 1, 100, 20)).toBe(20);
    expect(clampInt(20.9, 1, 100, 20)).toBe(20);
  });
});

describe('clampInt — time bounds (1–180, default 20)', () => {
  it('negative clamps up to the minimum', () => {
    expect(clampInt(-5, 1, 180, 20)).toBe(1);
    expect(clampInt('-5', 1, 180, 20)).toBe(1);
  });

  it('huge values clamp down to the maximum', () => {
    expect(clampInt(1000000, 1, 180, 20)).toBe(180);
    expect(clampInt(181, 1, 180, 20)).toBe(180);
  });

  it('non-numeric / missing falls back to the default', () => {
    expect(clampInt('x', 1, 180, 20)).toBe(20);
    expect(clampInt(undefined, 1, 180, 20)).toBe(20);
  });

  it('in-range values pass through', () => {
    expect(clampInt(45, 1, 180, 20)).toBe(45);
    expect(clampInt('45', 1, 180, 20)).toBe(45);
  });
});

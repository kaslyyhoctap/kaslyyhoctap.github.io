/**
 * chemFormat — chemistry subscripts + math superscripts.
 * Legacy data stores formulas as plain text (C6H12O6, 2^k); rendering
 * applies this transform project-wide (quiz, bank, result, theory .fx).
 */
import { describe, it, expect } from 'vitest';
import { chemFormat } from '@/lib/quiz/render';

describe('chemFormat chemistry', () => {
  it('subscripts letters followed by digits', () => {
    expect(chemFormat('C6H12O6')).toBe('C<sub>6</sub>H<sub>12</sub>O<sub>6</sub>');
  });
  it('subscripts after closing paren', () => {
    expect(chemFormat('(CH3)2')).toBe('(CH<sub>3</sub>)<sub>2</sub>');
  });
  it('keeps leading coefficients upright', () => {
    expect(chemFormat('2C2H5OH')).toBe('2C<sub>2</sub>H<sub>5</sub>OH');
  });
  it('escapes HTML before formatting', () => {
    expect(chemFormat('<b>C6</b>')).toBe('&lt;b&gt;C<sub>6</sub>&lt;/b&gt;');
  });
});

describe('chemFormat math', () => {
  it('caret exponent becomes superscript', () => {
    expect(chemFormat('2^k')).toBe('2<sup>k</sup>');
  });
  it('double-star exponent becomes superscript', () => {
    expect(chemFormat('2**k')).toBe('2<sup>k</sup>');
  });
  it('multi-char exponent in braces', () => {
    expect(chemFormat('x^{n+1}')).toBe('x<sup>n+1</sup>');
  });
  it('does not treat Vietnamese đ/caret prose as math', () => {
    expect(chemFormat('Số DNA con')).toBe('Số DNA con');
  });
});

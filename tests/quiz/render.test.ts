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

describe('chemFormat biology gene-math', () => {
  it('`nu N` becomes n with subscript N', () => {
    expect(chemFormat('Bước 1: tổng nu N = (L/3,4)×2 = 1500×2 = 3000 nu.')).toBe(
      'Bước 1: tổng n<sub>N</sub> = (L/3,4)×2 = 1500×2 = 3000 nu.',
    );
  });
  it('`N gene` becomes N with subscript gene', () => {
    expect(chemFormat('N gene = (4080/3,4)×2 = 2400 nu.')).toBe(
      'N<sub>gene</sub> = (4080/3,4)×2 = 2400 nu.',
    );
  });
  it('standalone `nu` (nucleotide abbreviation) stays', () => {
    expect(chemFormat('nhân thực dài 100–200 nu')).toBe(
      'nhân thực dài 100–200 nu',
    );
  });
  it('English grammar `+ N` placeholder untouched', () => {
    expect(chemFormat('Despite + N = Although + mệnh đề')).toBe(
      'Despite + N = Although + mệnh đề',
    );
  });
});

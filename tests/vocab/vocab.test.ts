import { describe, it, expect } from 'vitest';
import {
  vocabKey,
  starKey,
  fcFront,
  fcBack,
  vocabFilter,
  type VocabMode,
} from '@/lib/vocab';
import type { Vocabulary } from '@/lib/types';

// Minimal fixture matching the `vocabulary` table shape (db/schema.ts).
const WORDS: Vocabulary[] = [
  { unit: '1', en: 'account', vi: 'tài khoản', pos: 'n', ipa: '/əˈkaʊnt/', kind: 'word' },
  { unit: '1', en: 'achieve', vi: 'đạt được', pos: 'v', ipa: '/əˈtʃiːv/', kind: 'word' },
  { unit: '1', en: 'time and again', vi: 'lặng lẽ, liên tục', kind: 'phrase' },
  { unit: '1', en: 'adapt', vi: 'thích nghi', kind: 'word' },
];

describe('vocabKey / starKey', () => {
  it('builds vocabKnown keys as "unit::en" (app.js line 342)', () => {
    expect(vocabKey('1', 'account')).toBe('1::account');
  });

  it('builds starred keys as "v::unit::en" (app.js line 340)', () => {
    expect(starKey('1', 'account')).toBe('v::1::account');
  });
});

describe('fcFront / fcBack', () => {
  const w = WORDS[0]; // { en: 'account', vi: 'tài khoản' }

  it('envi: front = en, back = vi', () => {
    expect(fcFront(w, 'envi')).toBe('account');
    expect(fcBack(w, 'envi')).toBe('tài khoản');
  });

  it('vien: front = vi, back = en', () => {
    expect(fcFront(w, 'vien')).toBe('tài khoản');
    expect(fcBack(w, 'vien')).toBe('account');
  });

  it('handles null vi gracefully', () => {
    const noVi: Vocabulary = { unit: '1', en: 'hello', vi: null, kind: 'word' };
    expect(fcFront(noVi, 'envi')).toBe('hello');
    expect(fcBack(noVi, 'envi')).toBe('');
    expect(fcFront(noVi, 'vien')).toBe('');
    expect(fcBack(noVi, 'vien')).toBe('hello');
  });
});

describe('vocabFilter', () => {
  const emptyStarred: Record<string, boolean> = {};

  it('returns all when no filters set', () => {
    expect(
      vocabFilter(WORDS, { kind: '', starOnly: false, query: '' }, emptyStarred, '1'),
    ).toHaveLength(4);
  });

  it('filters by kind=word', () => {
    const result = vocabFilter(
      WORDS,
      { kind: 'word', starOnly: false, query: '' },
      emptyStarred,
      '1',
    );
    expect(result.map((w) => w.en)).toEqual(['account', 'achieve', 'adapt']);
  });

  it('filters by kind=phrase', () => {
    const result = vocabFilter(
      WORDS,
      { kind: 'phrase', starOnly: false, query: '' },
      emptyStarred,
      '1',
    );
    expect(result.map((w) => w.en)).toEqual(['time and again']);
  });

  it('filters by query (en match)', () => {
    const result = vocabFilter(
      WORDS,
      { kind: '', starOnly: false, query: 'acc' },
      emptyStarred,
      '1',
    );
    expect(result.map((w) => w.en)).toEqual(['account']);
  });

  it('filters by query (vi match)', () => {
    const result = vocabFilter(
      WORDS,
      { kind: '', starOnly: false, query: 'tài' },
      emptyStarred,
      '1',
    );
    expect(result.map((w) => w.en)).toEqual(['account']);
  });

  it('filters by starOnly when starred matches', () => {
    const starred: Record<string, boolean> = { 'v::1::account': true };
    const result = vocabFilter(
      WORDS,
      { kind: '', starOnly: true, query: '' },
      starred,
      '1',
    );
    expect(result.map((w) => w.en)).toEqual(['account']);
  });

  it('returns empty when starOnly but nothing starred', () => {
    const result = vocabFilter(
      WORDS,
      { kind: '', starOnly: true, query: '' },
      emptyStarred,
      '1',
    );
    expect(result).toHaveLength(0);
  });

  it('combines kind + query', () => {
    const result = vocabFilter(
      WORDS,
      { kind: 'word', starOnly: false, query: 'a' },
      emptyStarred,
      '1',
    );
    // 'account' matches 'a', 'achieve' matches 'a', 'adapt' matches 'a'
    expect(result.map((w) => w.en).sort()).toEqual(['account', 'achieve', 'adapt']);
  });
});

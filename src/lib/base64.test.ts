import { describe, it, expect } from 'vitest';
import { toBase64, fromBase64 } from './base64';

describe('base64 portátil', () => {
  it('codifica igual ao Buffer para ASCII', () => {
    const value = 'usuario:senha123';
    expect(toBase64(value)).toBe(Buffer.from(value, 'utf8').toString('base64'));
  });

  it('codifica igual ao Buffer para UTF-8 (acentos e emoji)', () => {
    const value = 'ação:çãé — 🔥';
    expect(toBase64(value)).toBe(Buffer.from(value, 'utf8').toString('base64'));
  });

  it('round-trip preserva a string', () => {
    for (const value of ['', 'a', 'ab', 'abc', 'usuário', 'ação:çãé — 🔥', 'O\'Brien']) {
      expect(fromBase64(toBase64(value))).toBe(value);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { nuevoId } from './id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('nuevoId', () => {
  it('OFF-05: genera un UUID v4 distinto cada vez', () => {
    const a = nuevoId();
    expect(a).toMatch(UUID_V4);
    expect(nuevoId()).not.toBe(a);
  });

  it('OFF-05: sin randomUUID (origen no seguro) arma igual un UUID v4', () => {
    const sinRandomUuid = { getRandomValues: crypto.getRandomValues.bind(crypto) };
    const ids = new Set(Array.from({ length: 50 }, () => nuevoId(sinRandomUuid)));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});

import type { Reloj } from '../../puertos';

export const relojSistema: Reloj = { ahora: () => new Date().toISOString() };

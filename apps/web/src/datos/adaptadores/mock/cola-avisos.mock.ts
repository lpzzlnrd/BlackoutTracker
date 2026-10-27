import { crearEmisor } from '../../../dominio/observable';
import type { AvisoCola } from '../../../dominio/tipos';
import type { ColaAvisos } from '../../puertos';

const cronologico = (a: AvisoCola, b: AvisoCola) =>
  Date.parse(a.ocurridoEn) - Date.parse(b.ocurridoEn);

/**
 * Cola en memoria con el mismo comportamiento que la de Dexie: orden cronológico, `agregar`
 * idempotente por id y aviso en cada cambio. Solo para la demo y los tests; en producción la
 * cola nunca vive solo en memoria (OFF-06).
 */
export function crearColaAvisosMock(inicial: AvisoCola[] = []): ColaAvisos {
  const avisos = new Map<string, AvisoCola>(inicial.map((a) => [a.id, { ...a }]));
  const cambios = crearEmisor();

  const cambiar = (id: string, parche: (a: AvisoCola) => AvisoCola) => {
    const actual = avisos.get(id);
    if (!actual) return;
    avisos.set(id, parche(actual));
    cambios.emitir();
  };

  return {
    async listar() {
      return [...avisos.values()].sort(cronologico).map((a) => ({ ...a }));
    },
    async agregar(nuevo) {
      const existente = avisos.get(nuevo.id);
      if (existente) return { ...existente };
      const aviso: AvisoCola = { ...nuevo, estado: 'pendiente' };
      avisos.set(aviso.id, aviso);
      cambios.emitir();
      return { ...aviso };
    },
    async marcarEnviado(id) {
      cambiar(id, ({ codigoError: _, ...a }) => ({ ...a, estado: 'enviado' }));
    },
    async marcarError(id, codigo) {
      cambiar(id, (a) => ({ ...a, estado: 'error', codigoError: codigo }));
    },
    async reintentar(id) {
      cambiar(id, ({ codigoError: _, ...a }) => ({ ...a, estado: 'pendiente' }));
    },
    async quitar(id) {
      if (avisos.delete(id)) cambios.emitir();
    },
    async vaciar() {
      avisos.clear();
      cambios.emitir();
    },
    suscribir: (alCambiar) => cambios.suscribir(alCambiar),
  };
}

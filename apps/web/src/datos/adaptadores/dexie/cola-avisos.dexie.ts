import Dexie, { liveQuery, type EntityTable } from 'dexie';
import type { AvisoCola } from '../../../dominio/tipos';
import type { ColaAvisos } from '../../puertos';

class BaseBlackout extends Dexie {
  avisos!: EntityTable<AvisoCola, 'id'>;

  constructor(nombre: string) {
    super(nombre);
    // Solo se indexa lo que se consulta: la clave, el orden cronológico y el estado.
    this.version(1).stores({ avisos: 'id, ocurridoEn, estado' });
  }
}

/** La cola en IndexedDB (OFF-06): sobrevive al cierre del navegador y se comparte entre pestañas. */
export function crearColaAvisosDexie(nombre = 'blackout'): ColaAvisos {
  const db = new BaseBlackout(nombre);

  const fijarEstado = async (id: string, estado: 'pendiente' | 'enviado') => {
    await db.avisos
      .where('id')
      .equals(id)
      .modify((aviso) => {
        aviso.estado = estado;
        delete aviso.codigoError;
      });
  };

  return {
    listar: () => db.avisos.orderBy('ocurridoEn').toArray(),
    async agregar(nuevo) {
      const existente = await db.avisos.get(nuevo.id);
      if (existente) return existente;
      const aviso: AvisoCola = { ...nuevo, estado: 'pendiente' };
      await db.avisos.add(aviso);
      return aviso;
    },
    marcarEnviado: (id) => fijarEstado(id, 'enviado'),
    async marcarError(id, codigo) {
      await db.avisos.update(id, { estado: 'error', codigoError: codigo });
    },
    reintentar: (id) => fijarEstado(id, 'pendiente'),
    quitar: (id) => db.avisos.delete(id),
    vaciar: () => db.avisos.clear(),
    suscribir(alCambiar) {
      // `liveQuery` emite el valor inicial al suscribirse; el puerto solo avisa de cambios.
      let primera = true;
      const suscripcion = liveQuery(() => db.avisos.toArray()).subscribe({
        next: () => {
          if (primera) primera = false;
          else alCambiar();
        },
        error: () => undefined,
      });
      return () => suscripcion.unsubscribe();
    },
  };
}

import { CodigoError } from '@blackout/shared';
import { describe, expect, it, vi } from 'vitest';
import type { NuevoAviso } from '../../dominio/tipos';
import type { ColaAvisos } from '../puertos';

const aviso = (id: string, ocurridoEn: string): NuevoAviso => ({
  id,
  reporteId: id,
  tipoServicio: 'electricidad',
  accion: 'inicio',
  ocurridoEn,
});

/**
 * Lo que debe cumplir CUALQUIER implementación de `ColaAvisos`. Se ejecuta contra el mock y
 * contra Dexie: si pasan las dos, la interfaz puede cambiar de una a otra sin enterarse.
 */
export function contratoColaAvisos(nombre: string, crear: () => ColaAvisos): void {
  describe(`contrato ColaAvisos · ${nombre}`, () => {
    it('OFF-06: un aviso nuevo queda pendiente y se puede listar', async () => {
      const cola = crear();
      const guardado = await cola.agregar(aviso('a1', '2026-10-07T18:00:00Z'));
      expect(guardado.estado).toBe('pendiente');
      expect(await cola.listar()).toEqual([guardado]);
    });

    it('OFF-05: agregar el mismo id dos veces no duplica el aviso', async () => {
      const cola = crear();
      await cola.agregar(aviso('a1', '2026-10-07T18:00:00Z'));
      await cola.agregar(aviso('a1', '2026-10-07T18:00:00Z'));
      expect(await cola.listar()).toHaveLength(1);
    });

    it('OFF-04: lista por orden cronológico de ocurridoEn, no de llegada', async () => {
      const cola = crear();
      await cola.agregar(aviso('tarde', '2026-10-07T19:00:00Z'));
      await cola.agregar(aviso('temprano', '2026-10-07T17:00:00Z'));
      await cola.agregar(aviso('medio', '2026-10-07T18:00:00Z'));
      expect((await cola.listar()).map((a) => a.id)).toEqual(['temprano', 'medio', 'tarde']);
    });

    it('marca enviado, error (con su código) y reintentar limpia el código', async () => {
      const cola = crear();
      await cola.agregar(aviso('a1', '2026-10-07T18:00:00Z'));

      await cola.marcarError('a1', CodigoError.HoraInvalida);
      expect((await cola.listar())[0]).toMatchObject({
        estado: 'error',
        codigoError: CodigoError.HoraInvalida,
      });

      await cola.reintentar('a1');
      const reintentado = (await cola.listar())[0];
      expect(reintentado?.estado).toBe('pendiente');
      expect(reintentado).not.toHaveProperty('codigoError');

      await cola.marcarEnviado('a1');
      expect((await cola.listar())[0]?.estado).toBe('enviado');
    });

    it('quita un aviso y vacía la cola', async () => {
      const cola = crear();
      await cola.agregar(aviso('a1', '2026-10-07T18:00:00Z'));
      await cola.agregar(aviso('a2', '2026-10-07T18:05:00Z'));
      await cola.quitar('a1');
      expect((await cola.listar()).map((a) => a.id)).toEqual(['a2']);
      await cola.vaciar();
      expect(await cola.listar()).toEqual([]);
    });

    it('avisa de los cambios, no al suscribirse, y deja de avisar tras la baja', async () => {
      const cola = crear();
      const alCambiar = vi.fn();
      const baja = cola.suscribir(alCambiar);

      await new Promise((r) => setTimeout(r, 30));
      expect(alCambiar).not.toHaveBeenCalled();

      await cola.agregar(aviso('a1', '2026-10-07T18:00:00Z'));
      await vi.waitFor(() => expect(alCambiar).toHaveBeenCalled());

      baja();
      alCambiar.mockClear();
      await cola.agregar(aviso('a2', '2026-10-07T18:05:00Z'));
      await new Promise((r) => setTimeout(r, 30));
      expect(alCambiar).not.toHaveBeenCalled();
    });
  });
}

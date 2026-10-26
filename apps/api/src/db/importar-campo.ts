import type { Sql } from 'postgres';
import { OrigenEvento } from '@blackout/shared';
import { claveSector, type FilaInvalida, validarCampo } from './campo.puro';

export interface ResultadoImportacion {
  insertadas: number;
  /** Filas que ya estaban cargadas de una corrida anterior: no se duplican. */
  yaCargadas: number;
  invalidas: FilaInvalida[];
}

/**
 * Importa el CSV del dataset de campo (T-044) como eventos de sector cerrados con `origen='campo'`,
 * que entran a la mediana igual que los del consenso (D-008). Las filas inválidas se informan y no
 * se insertan; las válidas sí.
 *
 * Es idempotente (D-025): una fila con el mismo sector, servicio, inicio y fin que un evento de campo
 * ya cargado se cuenta como `yaCargadas`. Una fila que se solapa con otro evento del mismo sector y
 * servicio (de campo o de consenso) se rechaza. Corre en una transacción con la tabla bloqueada
 * contra escrituras, así el consenso de la API no puede abrir un evento a mitad de la revisión.
 */
export async function importarCampo(
  sql: Sql,
  texto: string,
  ahora: Date,
): Promise<ResultadoImportacion> {
  const filasSector = await sql<{ id: number; nombre: string }[]>`select id, nombre from sectores`;
  if (filasSector.length === 0) throw new Error('No hay sectores: corre antes `pnpm db:seed`');
  const sectores = new Map(filasSector.map((s) => [claveSector(s.nombre), s.id]));
  const { validas, invalidas } = validarCampo(texto, sectores, ahora);

  return sql.begin(async (tx) => {
    await tx`lock table eventos_sector in share row exclusive mode`;
    let insertadas = 0;
    let yaCargadas = 0;
    const rechazadas: FilaInvalida[] = [];

    for (const f of validas) {
      // Las horas van como texto ISO con cast explícito: postgres-js no serializa un `Date` cuando
      // Postgres infiere el parámetro como texto (dentro de `tstzrange`).
      const inicio = f.inicio.toISOString();
      const fin = f.fin.toISOString();
      const [choque] = await tx<{ id: number; origen: string; igual: boolean }[]>`
        select id, origen,
               (origen = ${OrigenEvento.Campo} and inicio_en = ${inicio}::timestamptz
                 and fin_en = ${fin}::timestamptz) as igual
        from eventos_sector
        where sector_id = ${f.sectorId} and tipo_servicio = ${f.tipoServicio}
          and tstzrange(inicio_en, coalesce(fin_en, 'infinity'))
              && tstzrange(${inicio}::timestamptz, ${fin}::timestamptz)
        order by igual desc, id
        limit 1`;
      if (choque?.igual) {
        yaCargadas++;
      } else if (choque) {
        rechazadas.push({
          linea: f.linea,
          motivo: `Se solapa con el evento ${choque.id} (${choque.origen}) ya guardado`,
        });
      } else {
        await tx`
          insert into eventos_sector
            (sector_id, tipo_servicio, inicio_en, fin_en, confirmado_en, restablecido_en, origen)
          values
            (${f.sectorId}, ${f.tipoServicio}, ${inicio}, ${fin}, ${inicio}, ${fin}, ${OrigenEvento.Campo})`;
        insertadas++;
      }
    }

    const todas = [...invalidas, ...rechazadas].sort((a, b) => a.linea - b.linea);
    return { insertadas, yaCargadas, invalidas: todas };
  });
}

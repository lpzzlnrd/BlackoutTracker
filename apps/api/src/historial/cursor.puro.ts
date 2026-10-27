/**
 * Cursor del historial: el par (fin_en, id) del último evento de la página, en base64url. Es opaco
 * para el cliente. El orden es (fin_en, id) descendente, así que es estable aunque haya eventos con
 * el mismo fin y no repite ni salta nada cuando llegan eventos nuevos.
 */
export interface PosicionCursor {
  finEn: Date;
  id: number;
}

export function codificarCursor(posicion: PosicionCursor): string {
  return Buffer.from(`${posicion.finEn.toISOString()}|${posicion.id}`, 'utf-8').toString(
    'base64url',
  );
}

const FORMATO = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\|(\d{1,10})$/;

/** `null` si el texto no es un cursor que haya emitido `codificarCursor`. */
export function decodificarCursor(texto: string): PosicionCursor | null {
  if (!/^[A-Za-z0-9_-]+$/.test(texto)) return null;
  const crudo = Buffer.from(texto, 'base64url').toString('utf-8');
  const m = FORMATO.exec(crudo);
  if (!m) return null;
  const finEn = new Date(m[1]);
  const id = Number(m[2]);
  if (Number.isNaN(finEn.getTime()) || id > 2_147_483_647) return null;
  return { finEn, id };
}

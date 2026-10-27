import type { EstadoConexion } from '../../dominio/tipos';
import { hora } from '../../utils/formato';
import { Icono } from './Icono';

/** "Sin conexión · datos no actualizados (14:32)": lo que se ve es lo último guardado (OFF-07). */
export const textoSinConexion = (conexion: EstadoConexion): string => {
  const causa = conexion.modo === 'servidor-caido' ? 'No se pudo actualizar' : 'Sin conexión';
  const desde = conexion.ultimaSincronizacion ? ` (${hora(conexion.ultimaSincronizacion)})` : '';
  return `${causa} · datos no actualizados${desde}`;
};

/** Franja superior del teléfono. Solo aparece sin conexión (A §3). */
export function AvisoConexion({ conexion }: { conexion: EstadoConexion }) {
  if (conexion.modo === 'en-linea') return null;
  return (
    <p
      role="status"
      className="flex h-9 flex-none items-center gap-2 border-b border-borde-2 bg-superficie-2 px-4 text-[13px] font-medium"
    >
      <Icono nombre="wifi-off" tamano={16} />
      <span className="truncate">{textoSinConexion(conexion)}</span>
    </p>
  );
}

/** Pie de la barra lateral de escritorio: "En línea · actualizado a las 15:06" (A §4). */
export function EstadoConexionLinea({ conexion }: { conexion: EstadoConexion }) {
  const enLinea = conexion.modo === 'en-linea';
  return (
    <p role="status" className="flex items-center gap-2.5 px-2 text-[13px] text-secundario">
      <Icono nombre={enLinea ? 'wifi' : 'wifi-off'} tamano={18} />
      <span>
        {enLinea
          ? `En línea${conexion.ultimaSincronizacion ? ` · actualizado a las ${hora(conexion.ultimaSincronizacion)}` : ''}`
          : textoSinConexion(conexion)}
      </span>
    </p>
  );
}

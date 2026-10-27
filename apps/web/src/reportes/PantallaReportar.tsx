import { CONSENSO_N_POR_DEFECTO, TipoServicio } from '@blackout/shared';
import { useState } from 'react';
import { corteAbierto } from '../aplicacion/corte-abierto';
import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { EstadoChip } from '../componentes/ui/Chips';
import {
  useColaAvisos,
  useConfiguracion,
  useEstadosSector,
  useMisReportes,
  usePerfil,
} from '../datos/consultas';
import { useObservable, usePuertos } from '../datos/contexto';
import { useServicio } from '../datos/preferencias';
import { estadoVisual } from '../dominio/estado-visual';
import { useParametro } from '../navegacion/ruta';
import { FormularioAviso } from './FormularioAviso';
import { useRefrescarTrasEnvio } from './useRefrescarTrasEnvio';
import { useSincronizarCola } from './useSincronizarCola';

const leerServicio = (valor: string | null): TipoServicio | null =>
  valor === TipoServicio.Agua || valor === TipoServicio.Electricidad ? valor : null;

/**
 * Reportar (REP, OFF). Solo se ve con sesión y perfil (`RequiereVecino`). El mapa puede traer el
 * servicio en `?servicio=`; si no, el que el vecino eligió la última vez. La cola ("Tus avisos")
 * vive en su propia pantalla, `/avisos` (D-037): aquí queda solo el aviso.
 */
export function PantallaReportar() {
  const { conexion } = usePuertos();
  const estadoConexion = useObservable(conexion);
  const perfil = usePerfil();
  const misReportes = useMisReportes();
  const cola = useColaAvisos();
  const estados = useEstadosSector();
  const configuracion = useConfiguracion();
  const sincronizar = useSincronizarCola();
  useRefrescarTrasEnvio();

  const [preferido, elegirPreferido] = useServicio();
  const desdeUrl = leerServicio(useParametro('servicio'));
  const [servicio, setServicio] = useState<TipoServicio>(desdeUrl ?? preferido);
  const cambiarServicio = (nuevo: TipoServicio) => {
    setServicio(nuevo);
    elegirPreferido(nuevo);
  };

  const abierto = corteAbierto(servicio, misReportes.data, cola.data);
  const sector = perfil.data;
  const fila = estados.data?.find(
    (e) => e.sectorId === sector?.sectorId && e.tipoServicio === servicio,
  );

  return (
    <Contenido>
      <EncabezadoPantalla
        titulo="Reportar"
        descripcion="Avisa cuando se va o vuelve el servicio. Sin conexión también: se envía al reconectar."
      />
      {sector && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-secundario">Tu sector:</span>
          <span className="font-semibold">{sector.sectorNombre}</span>
          <EstadoChip estado={estadoVisual(fila)} />
        </p>
      )}
      <FormularioAviso
        servicio={servicio}
        onCambiarServicio={cambiarServicio}
        abierto={abierto}
        consensoN={configuracion.data?.consensoN ?? CONSENSO_N_POR_DEFECTO}
        sinRed={estadoConexion.modo !== 'en-linea'}
        sincronizar={sincronizar}
      />
    </Contenido>
  );
}

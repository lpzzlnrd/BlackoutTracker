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
import { DespuesDeAvisar } from './DespuesDeAvisar';
import { FormularioAviso } from './FormularioAviso';
import { TarjetasServicio } from './TarjetasServicio';
import { useRefrescarTrasEnvio } from './useRefrescarTrasEnvio';
import { useSincronizarCola } from './useSincronizarCola';

const leerServicio = (valor: string | null): TipoServicio | null =>
  valor === TipoServicio.Agua || valor === TipoServicio.Electricidad ? valor : null;

/**
 * Reportar (REP, OFF). Solo se ve con sesión y perfil (`RequiereVecino`). El mapa puede traer el
 * servicio en `?servicio=`; si no, el que el vecino eligió la última vez. La cola ("Tus avisos")
 * vive en su propia pantalla, `/avisos` (D-037). En el estilo de D-038: una tarjeta por servicio
 * con el corte propio, el aviso como pregunta y, debajo, qué pasa después de avisar.
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

  const abiertos = {
    [TipoServicio.Electricidad]: corteAbierto(
      TipoServicio.Electricidad,
      misReportes.data,
      cola.data,
    ),
    [TipoServicio.Agua]: corteAbierto(TipoServicio.Agua, misReportes.data, cola.data),
  };
  const consensoN = configuracion.data?.consensoN ?? CONSENSO_N_POR_DEFECTO;
  const sector = perfil.data;
  const fila = estados.data?.find(
    (e) => e.sectorId === sector?.sectorId && e.tipoServicio === servicio,
  );

  return (
    <Contenido>
      <EncabezadoPantalla
        titulo="Reportar"
        descripcion={
          sector && (
            <span className="flex flex-wrap items-center gap-2">
              <span>Tu sector</span>
              <span className="font-bold text-texto">{sector.sectorNombre}</span>
              <EstadoChip estado={estadoVisual(fila)} />
            </span>
          )
        }
      />
      <TarjetasServicio valor={servicio} onChange={cambiarServicio} abiertos={abiertos} />
      <FormularioAviso
        servicio={servicio}
        abierto={abiertos[servicio]}
        consensoN={consensoN}
        sinRed={estadoConexion.modo !== 'en-linea'}
        sincronizar={sincronizar}
      />
      <DespuesDeAvisar consensoN={consensoN} />
    </Contenido>
  );
}

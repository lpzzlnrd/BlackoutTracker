import { CONSENSO_N_POR_DEFECTO, TipoServicio } from '@blackout/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { corteAbierto } from '../aplicacion/corte-abierto';
import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { EstadoChip } from '../componentes/ui/Chips';
import {
  claves,
  useColaAvisos,
  useConfiguracion,
  useEstadosSector,
  useMisReportes,
  usePerfil,
  useSesion,
} from '../datos/consultas';
import { useObservable, usePuertos } from '../datos/contexto';
import { useServicio } from '../datos/preferencias';
import { estadoVisual } from '../dominio/estado-visual';
import { useParametro } from '../navegacion/ruta';
import { FormularioAviso } from './FormularioAviso';
import { ListaAvisos } from './ListaAvisos';
import { useSincronizarCola } from './useSincronizarCola';

const leerServicio = (valor: string | null): TipoServicio | null =>
  valor === TipoServicio.Agua || valor === TipoServicio.Electricidad ? valor : null;

/**
 * Reportar (REP, OFF). Solo se ve con sesión y perfil (`RequiereVecino`). El mapa puede traer el
 * servicio en `?servicio=`; si no, el que el vecino eligió la última vez.
 */
export function PantallaReportar() {
  const { conexion } = usePuertos();
  const estadoConexion = useObservable(conexion);
  const cliente = useQueryClient();
  const usuario = useSesion();
  const perfil = usePerfil();
  const misReportes = useMisReportes();
  const cola = useColaAvisos();
  const estados = useEstadosSector();
  const configuracion = useConfiguracion();
  const sincronizar = useSincronizarCola();

  const [preferido, elegirPreferido] = useServicio();
  const desdeUrl = leerServicio(useParametro('servicio'));
  const [servicio, setServicio] = useState<TipoServicio>(desdeUrl ?? preferido);
  const cambiarServicio = (nuevo: TipoServicio) => {
    setServicio(nuevo);
    elegirPreferido(nuevo);
  };

  // Cada aviso que el servidor acepta o rechaza (aquí o desde `vigilarConexion` al volver la
  // red) cambia "mis reportes" y quizá el estado del sector: se vuelven a pedir.
  const resueltos = cola.data?.filter((a) => a.estado !== 'pendiente').length ?? 0;
  const previos = useRef(resueltos);
  useEffect(() => {
    if (resueltos === previos.current) return;
    previos.current = resueltos;
    void cliente.invalidateQueries({ queryKey: claves.misReportes(usuario?.id) });
    void cliente.invalidateQueries({ queryKey: claves.estados });
  }, [resueltos, cliente, usuario?.id]);

  const abierto = corteAbierto(servicio, misReportes.data, cola.data);
  const sector = perfil.data;
  const fila = estados.data?.find(
    (e) => e.sectorId === sector?.sectorId && e.tipoServicio === servicio,
  );

  return (
    <Contenido ancho="amplio">
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
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <FormularioAviso
          servicio={servicio}
          onCambiarServicio={cambiarServicio}
          abierto={abierto}
          consensoN={configuracion.data?.consensoN ?? CONSENSO_N_POR_DEFECTO}
          sinRed={estadoConexion.modo !== 'en-linea'}
          sincronizar={sincronizar}
        />
        <ListaAvisos sincronizar={sincronizar} />
      </div>
    </Contenido>
  );
}

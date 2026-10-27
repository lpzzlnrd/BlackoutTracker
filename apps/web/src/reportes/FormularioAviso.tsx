import { REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO, type TipoServicio } from '@blackout/shared';
import { useState, type FormEvent } from 'react';
import type { CorteAbierto } from '../aplicacion/corte-abierto';
import {
  MENSAJE_HORA,
  isoDesdeLocalCaracas,
  localCaracasDesdeIso,
  validarHoraAviso,
} from '../aplicacion/hora-aviso';
import { avisarCierre, avisarInicio } from '../aplicacion/reportar';
import { Boton } from '../componentes/ui/Boton';
import { Campo } from '../componentes/ui/Campo';
import { ChipSync } from '../componentes/ui/Chips';
import { Icono } from '../componentes/ui/Icono';
import { Mensaje } from '../componentes/ui/Mensaje';
import { SelectorServicio } from '../componentes/ui/SelectorServicio';
import { useColaAvisos } from '../datos/consultas';
import { usePuertos } from '../datos/contexto';
import { textoAccion, textoBotonReportar } from '../dominio/aviso';
import { mensajeDeError } from '../dominio/errores';
import { Enlace } from '../navegacion/ruta';
import { hora } from '../utils/formato';

type Cuando = 'ahora' | 'antes';

const DIA_MS = 86_400_000;

/**
 * El aviso del vecino: "Se fue…" si no tiene un corte abierto de ese servicio, "Ya volvió…" si lo
 * tiene. La hora es la del evento, no la del envío (OFF-03): "Ahora" o la que indique. El aviso
 * va siempre a la cola y se ve al instante, haya o no conexión (OFF-01).
 */
export function FormularioAviso({
  servicio,
  onCambiarServicio,
  abierto,
  consensoN,
  sinRed,
  sincronizar,
}: {
  servicio: TipoServicio;
  onCambiarServicio: (servicio: TipoServicio) => void;
  abierto: CorteAbierto | null;
  consensoN: number;
  sinRed: boolean;
  sincronizar: () => Promise<void>;
}) {
  const { colaAvisos, reloj } = usePuertos();
  const cola = useColaAvisos();
  const [cuando, setCuando] = useState<Cuando>('ahora');
  const [local, setLocal] = useState('');
  const [errorHora, setErrorHora] = useState<string>();
  const [errorGuardar, setErrorGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [ultimoId, setUltimoId] = useState<string | null>(null);

  const ultimo = ultimoId ? cola.data?.find((a) => a.id === ultimoId) : undefined;
  const ahoraLocal = localCaracasDesdeIso(reloj.ahora());
  const minimo = abierto
    ? localCaracasDesdeIso(abierto.inicioEn)
    : localCaracasDesdeIso(
        new Date(
          Date.parse(reloj.ahora()) - REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO * DIA_MS,
        ).toISOString(),
      );

  const elegirCuando = (nuevo: Cuando) => {
    setCuando(nuevo);
    setErrorHora(undefined);
    if (nuevo === 'antes' && !local) setLocal(ahoraLocal);
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErrorGuardar(false);
    const ahora = reloj.ahora();
    const ocurridoEn = cuando === 'ahora' ? ahora : isoDesdeLocalCaracas(local);
    if (!ocurridoEn) {
      setErrorHora(MENSAJE_HORA.ilegible);
      return;
    }
    const resultado = validarHoraAviso({
      accion: abierto ? 'cierre' : 'inicio',
      ocurridoEn,
      ahora,
      inicioEn: abierto?.inicioEn,
    });
    if (!resultado.valida) {
      setErrorHora(MENSAJE_HORA[resultado.motivo]);
      return;
    }

    setGuardando(true);
    try {
      const deps = { colaAvisos, sincronizar };
      const aviso = abierto
        ? await avisarCierre(deps, { abierto, tipoServicio: servicio, ocurridoEn })
        : await avisarInicio(deps, { tipoServicio: servicio, ocurridoEn });
      setUltimoId(aviso.id);
      setCuando('ahora');
      setLocal('');
      setErrorHora(undefined);
    } catch {
      setErrorGuardar(true);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void enviar(e)}
      noValidate
      aria-labelledby="titulo-aviso"
      className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4"
    >
      <h2 id="titulo-aviso" className="text-base font-bold">
        Nuevo aviso
      </h2>

      <SelectorServicio valor={servicio} onChange={onCambiarServicio} />

      <p className="text-sm text-secundario">
        {abierto
          ? `Tienes un corte abierto desde las ${hora(abierto.inicioEn)}. Avisa cuando vuelva.`
          : 'No tienes ningún corte abierto de este servicio.'}
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">¿Cuándo pasó?</legend>
        <div
          role="group"
          aria-label="Cuándo pasó"
          className="inline-flex w-fit gap-1 rounded-tarjeta border border-borde bg-superficie p-1"
        >
          {(['ahora', 'antes'] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={cuando === opcion}
              onClick={() => elegirCuando(opcion)}
              className={`h-11 rounded-control px-4 text-[15px] font-semibold ${
                cuando === opcion ? 'bg-acento-suave text-tinta-acento' : 'text-texto-2'
              }`}
            >
              {opcion === 'ahora' ? 'Ahora' : 'Fue antes'}
            </button>
          ))}
        </div>
        {cuando === 'antes' && (
          <Campo
            etiqueta="Fecha y hora (hora de Caracas)"
            type="datetime-local"
            value={local}
            min={minimo}
            max={ahoraLocal}
            onChange={(e) => {
              setLocal(e.target.value);
              setErrorHora(undefined);
            }}
            error={errorHora}
            ayuda={abierto ? 'No puede ser antes de que empezara el corte.' : undefined}
          />
        )}
        {cuando === 'ahora' && errorHora && <Mensaje tono="error">{errorHora}</Mensaje>}
      </fieldset>

      <Boton type="submit" ancho cargando={guardando}>
        {textoBotonReportar(abierto !== null, servicio)}
      </Boton>

      {errorGuardar && (
        <Mensaje tono="error">
          No pudimos guardar el aviso en este dispositivo. Inténtalo de nuevo.
        </Mensaje>
      )}

      {ultimo && (
        <div
          role="status"
          className="flex flex-col gap-1.5 rounded-bloque border border-borde bg-superficie-2 px-3 py-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">Aviso guardado</p>
            <ChipSync estado={ultimo.estado} />
          </div>
          <p className="text-sm">
            {textoAccion(ultimo.accion, ultimo.tipoServicio)} · {hora(ultimo.ocurridoEn)}
          </p>
          <p className="text-sm leading-[1.35] text-secundario">
            {ultimo.estado === 'error'
              ? mensajeDeError(ultimo.codigoError, ultimo.tipoServicio)
              : ultimo.estado === 'enviado'
                ? 'Ya llegó al servidor.'
                : sinRed
                  ? 'Se enviará al reconectar.'
                  : 'Enviando…'}
          </p>
          {ultimo.estado !== 'error' && (
            <p className="text-sm leading-[1.35] text-secundario">
              Tu aviso cuenta como 1 de los {consensoN} vecinos que hacen falta para confirmar{' '}
              {ultimo.accion === 'inicio' ? 'el corte' : 'que volvió el servicio'}.
            </p>
          )}
          <Enlace
            a="/avisos"
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-acento"
          >
            <Icono nombre="clock" tamano={16} />
            Ver tus avisos
          </Enlace>
        </div>
      )}
    </form>
  );
}

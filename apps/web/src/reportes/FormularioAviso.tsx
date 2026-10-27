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
import { useColaAvisos } from '../datos/consultas';
import { usePuertos } from '../datos/contexto';
import { textoAccion, textoBotonReportar } from '../dominio/aviso';
import { mensajeDeError } from '../dominio/errores';
import { minutosDesde } from '../mapa/textos';
import { Enlace } from '../navegacion/ruta';
import { duracion, hora, nombreServicio } from '../utils/formato';

type Cuando = 'ahora' | 'antes';

/** "Tu corte lleva 46 min abierto, desde las 14:20…"; recién abierto, sin los "0 min". */
function textoCorteAbierto(abierto: CorteAbierto, ahora: string): string {
  const minutos = minutosDesde(abierto.inicioEn, ahora);
  const desde = hora(abierto.inicioEn);
  return minutos === 0
    ? `Tu corte está abierto desde las ${desde}. Avisa cuando vuelva.`
    : `Tu corte lleva ${duracion(minutos)} abierto, desde las ${desde}. Avisa cuando vuelva.`;
}

const DIA_MS = 86_400_000;

/**
 * El aviso del vecino: "Se fue…" si no tiene un corte abierto de ese servicio, "Ya volvió…" si lo
 * tiene. La hora es la del evento, no la del envío (OFF-03): "Ahora" o la que indique. El aviso
 * va siempre a la cola y se ve al instante, haya o no conexión (OFF-01). En el estilo de D-038,
 * el aviso se plantea como pregunta ("¿Ya volvió la luz?") y el botón mide 60 px; el servicio se
 * elige fuera, en las tarjetas de Reportar.
 */
export function FormularioAviso({
  servicio,
  abierto,
  consensoN,
  sinRed,
  sincronizar,
}: {
  servicio: TipoServicio;
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
  const accion = textoBotonReportar(abierto !== null, servicio);
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
      className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-5"
    >
      <div className="flex flex-col gap-1.5">
        <h2
          id="titulo-aviso"
          className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em]"
        >
          ¿{accion}?
        </h2>
        <p className="text-sm leading-[1.4] text-secundario">
          {abierto
            ? textoCorteAbierto(abierto, reloj.ahora())
            : `Si en tu casa no hay ${nombreServicio(servicio).toLowerCase()}, avisa: con ${consensoN} vecinos se confirma el corte del sector.`}
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-extrabold text-texto-2">¿Cuándo pasó?</legend>
        <div
          role="group"
          aria-label="Cuándo pasó"
          className="flex gap-1 rounded-tarjeta bg-superficie-2 p-1"
        >
          {(['ahora', 'antes'] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={cuando === opcion}
              onClick={() => elegirCuando(opcion)}
              className={`inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-control border text-[15px] ${
                cuando === opcion
                  ? 'border-borde bg-superficie font-bold text-texto'
                  : 'border-transparent font-semibold text-texto-2'
              }`}
            >
              {opcion === 'ahora' ? 'Ahora' : 'Fue antes'}
              {/* El espacio no se ve (es un hijo de flex), pero separa el nombre accesible. */}
              {opcion === 'ahora' && ' '}
              {opcion === 'ahora' && (
                <span className="font-semibold text-secundario tabular-nums">
                  {hora(reloj.ahora())}
                </span>
              )}
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

      <Boton
        type="submit"
        variante="grande"
        icono={abierto ? 'check' : 'x-circle'}
        ancho
        cargando={guardando}
      >
        {accion}
      </Boton>

      {errorGuardar && (
        <Mensaje tono="error">
          No pudimos guardar el aviso en este dispositivo. Inténtalo de nuevo.
        </Mensaje>
      )}

      {ultimo && (
        <div
          role="status"
          className="flex flex-col gap-1.5 rounded-bloque border border-borde bg-superficie-2 px-3.5 py-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-lg font-extrabold">Aviso guardado</p>
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

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  avanzarRecorrido,
  conContexto,
  NUMERO_PASO,
  progresoRecorrido,
  retrocederRecorrido,
  siguientePasoRecorrido,
  TOTAL_PASOS,
  type ContextoRecorrido,
  type EstadoRecorrido,
  type IdPaso,
} from '../../aplicacion/recorrido';
import { Boton } from '../../componentes/ui/Boton';
import { Icono } from '../../componentes/ui/Icono';
import { usePerfil, useSesion } from '../../datos/consultas';
import { useObservable } from '../../datos/contexto';
import { navegar, useRuta, type Ruta } from '../../navegacion/ruta';
import { recorrido } from '../recuerdo';
import { irEnRecorrido, PANTALLA_PASO } from './empezar';
import { usePasosRecorrido, type ContenidoPaso, type Indicacion } from './pasos';
import { useSeguimiento, useUltimaVisible, type Caja, type Pantalla } from './seguimiento';

// El recorrido guiado (T-073, D-043), al estilo de un juego: la pantalla real queda bajo un velo
// de tinta con un hueco sobre lo que hay que usar, un anillo que pulsa señala dónde tocar o
// escribir y una tarjeta fija arriba o abajo dice qué hacer. Los pasos en los que el vecino hace
// algo avanzan solos al hacerlo; los que explican, con "Continuar".

type EnPaso = Extract<EstadoRecorrido, { logro: boolean }>;

/** Si lo señalado no aparece en este tiempo (sin red, por ejemplo), se ofrece seguir igual. */
const ESPERA_SIN_OBJETIVO_MS = 3000;
/** Margen alrededor de lo iluminado. */
const MARGEN = 6;
/** Lo que necesita libre la tarjeta además de su alto: su margen y el pulso del anillo. */
const HOLGURA = 28;
/** Desde aquí la tarjeta va a la derecha, con 420 px (`lg:`). */
const ESCRITORIO = 1024;
const SIN_VISIBLES: readonly string[] = [];

export function Recorrido() {
  const guardado = useObservable(recorrido.estado);
  const usuario = useSesion();
  const perfil = usePerfil();
  const ruta = useRuta();
  const pasos = usePasosRecorrido();
  const ctx: ContextoRecorrido = {
    hayUsuario: usuario !== null,
    tienePerfil: Boolean(perfil.data),
  };

  // Se deriva al pintar (no en un efecto) para que la pantalla nunca vea el paso sin cumplir.
  const estado = guardado && conContexto(guardado, ctx);
  useEffect(() => {
    if (guardado && estado && estado !== guardado) recorrido.fijar(estado);
  }, [guardado, estado]);

  if (!estado) return null;
  if (estado.paso === 'fin') return <FinRecorrido pasos={pasos} />;
  return (
    <PasoEnCurso
      key={estado.paso}
      estado={estado}
      contenido={pasos[estado.paso]}
      ruta={ruta}
      ctx={ctx}
    />
  );
}

function PasoEnCurso({
  estado,
  contenido,
  ruta,
  ctx,
}: {
  estado: EnPaso;
  contenido: ContenidoPaso;
  ruta: Ruta;
  ctx: ContextoRecorrido;
}) {
  const { indicaciones, logro } = contenido;
  const pantallaDelPaso = PANTALLA_PASO[estado.paso];
  const enSuPantalla = ruta === pantallaDelPaso.ruta;
  const enCurso = !estado.logro && enSuPantalla;

  // La vivienda sigue a la pantalla: vale la última indicación cuyo `visibleSi` está a la vista.
  const sigueAPantalla = indicaciones.some((i) => i.visibleSi);
  const ultimaVisible = useUltimaVisible(
    sigueAPantalla && enCurso ? indicaciones.map((i) => i.visibleSi) : SIN_VISIBLES,
  );
  const indice = sigueAPantalla ? Math.max(0, ultimaVisible) : estado.indicacion;
  const indicacion = enCurso ? (indicaciones[indice] ?? indicaciones[0] ?? null) : null;

  const [validez, setValidez] = useState({ indice: -1, valido: false });
  const valido = validez.indice === indice && validez.valido;
  const avance = indicacion?.avance;
  const seguimiento = useSeguimiento({
    objetivo: indicacion?.objetivo,
    foco: indicacion?.foco,
    alEncontrar: (elemento) => {
      if (avance?.tipo !== 'escribir') return;
      const campo = campoDe(elemento);
      setValidez({ indice, valido: avance.valido(campo?.value ?? '') });
      campo?.focus({ preventScroll: true });
    },
  });

  const ir = (nuevo: EstadoRecorrido | null) => irEnRecorrido(nuevo, { paso: estado.paso, ruta });
  const forma = { indicaciones: indicaciones.length, conLogro: Boolean(logro) };
  const avanzar = () => ir(avanzarRecorrido({ ...estado, indicacion: indice }, forma, ctx));

  useInteraccion(avance, seguimiento.elemento, avanzar, (v) => setValidez({ indice, valido: v }));
  const sinObjetivo = useSinObjetivo(
    indicacion !== null && seguimiento.hueco === null,
    `${estado.paso}-${indice}`,
  );

  const progreso = progresoRecorrido({ ...estado, indicacion: indice }, indicaciones.length);
  const numero = NUMERO_PASO[estado.paso];
  const anillo = indicacion ? seguimiento.anillo : null;
  const [altoTarjeta, setAltoTarjeta] = useState(0);
  const arriba = ladoDeLaTarjeta(anillo, altoTarjeta, seguimiento.pantalla) === 'arriba';

  let cuerpo: ReactNode;
  let boton: { texto: string; accion: () => void; activo?: boolean } | null = null;
  let atras = false;

  if (estado.logro && logro) {
    cuerpo = (
      <div className="flex items-start gap-3">
        <span className="recorrido-check grid h-12 w-12 flex-none place-items-center rounded-full bg-acento text-sobre-acento">
          <Icono nombre="check" tamano={26} grosor={2.8} />
        </span>
        <Textos paso={numero} nombre={contenido.nombre} titulo={logro.titulo} texto={logro.texto} />
      </div>
    );
    boton = { texto: 'Continuar', accion: () => ir(siguientePasoRecorrido(estado, ctx)) };
  } else if (!indicacion) {
    // El vecino está en otra pantalla (volvió a abrir la app a mitad del recorrido).
    cuerpo = (
      <Textos
        paso={numero}
        nombre={contenido.nombre}
        titulo="Seguimos donde ibas"
        texto={indicaciones[estado.indicacion]?.titulo}
      />
    );
    boton = {
      texto: 'Continuar',
      accion: () => navegar(pantallaDelPaso.ruta, { consulta: pantallaDelPaso.consulta }),
    };
  } else {
    cuerpo = (
      <>
        <Textos
          paso={numero}
          nombre={contenido.nombre}
          titulo={indicacion.titulo}
          texto={indicacion.texto}
        />
        {indicacion.ejemplo && <div className="mt-3">{indicacion.ejemplo}</div>}
      </>
    );
    const tipo = indicacion.avance.tipo;
    if (tipo === 'continuar' || sinObjetivo) boton = { texto: 'Continuar', accion: avanzar };
    else if (tipo === 'escribir') boton = { texto: 'Continuar', accion: avanzar, activo: valido };
    atras = !sigueAPantalla && indice > 0;
  }

  return (
    <>
      <Velo hueco={indicacion ? seguimiento.hueco : null} pantalla={seguimiento.pantalla} />
      {anillo && <Anillo caja={anillo} />}
      <Tarjeta
        arriba={arriba}
        alMedir={setAltoTarjeta}
        clave={`${estado.paso}-${indice}-${estado.logro}-${indicacion !== null}`}
        progreso={progreso}
        onSaltar={() => ir(null)}
        pie={
          (boton || atras) && (
            <div className="mt-4 flex items-center gap-2">
              {atras && (
                <Boton
                  variante="texto"
                  className="-ml-3"
                  onClick={() => ir(retrocederRecorrido({ ...estado, indicacion: indice }))}
                >
                  Atrás
                </Boton>
              )}
              {boton && (
                <Boton
                  className="ml-auto min-w-[140px]"
                  disabled={boton.activo === false}
                  onClick={boton.accion}
                  data-recorrido-principal
                >
                  {boton.texto}
                </Boton>
              )}
            </div>
          )
        }
      >
        {cuerpo}
      </Tarjeta>
    </>
  );
}

/**
 * Abajo, a mano del pulgar, salvo que ahí tape lo señalado y arriba no. En el escritorio la tarjeta
 * va en la columna de la derecha: si lo señalado no cae en ella, no hay nada que tapar.
 */
function ladoDeLaTarjeta(
  anillo: Caja | null,
  altoTarjeta: number,
  pantalla: Pantalla,
): 'arriba' | 'abajo' {
  if (!anillo) return 'abajo';
  if (pantalla.ancho >= ESCRITORIO) {
    const inicioColumna = pantalla.ancho - 24 - 420 - HOLGURA;
    if (anillo.x + anillo.ancho < inicioColumna) return 'abajo';
  }
  const libreAbajo = pantalla.alto - (anillo.y + anillo.alto) - HOLGURA;
  const libreArriba = anillo.y - HOLGURA;
  if (altoTarjeta <= libreAbajo) return 'abajo';
  if (altoTarjeta <= libreArriba) return 'arriba';
  return libreArriba > libreAbajo ? 'arriba' : 'abajo';
}

const campoDe = (elemento: HTMLElement | null): HTMLInputElement | null =>
  elemento instanceof HTMLInputElement ? elemento : (elemento?.querySelector('input') ?? null);

/**
 * Escucha lo que el vecino hace sobre lo iluminado: escribir (activa "Continuar"; Intro avanza en
 * vez de enviar el formulario), tocar (el toque sigue su camino y después se avanza) o practicar
 * (el toque se queda aquí: no llega a la app y no se envía nada).
 */
function useInteraccion(
  avance: Indicacion['avance'] | undefined,
  elemento: RefObject<HTMLElement | null>,
  avanzar: () => void,
  fijarValido: (valido: boolean) => void,
) {
  const acciones = useRef({ avanzar, fijarValido });
  useEffect(() => {
    acciones.current = { avanzar, fijarValido };
  });
  const tipo = avance?.tipo;
  const valido = avance?.tipo === 'escribir' ? avance.valido : undefined;

  useEffect(() => {
    if (!tipo) return;
    const dentro = (evento: Event) =>
      elemento.current !== null &&
      evento.target instanceof Node &&
      elemento.current.contains(evento.target);
    const valor = () => campoDe(elemento.current)?.value ?? '';

    const alEscribir = (evento: Event) => {
      if (valido && dentro(evento)) acciones.current.fijarValido(valido(valor()));
    };
    const alTeclear = (evento: KeyboardEvent) => {
      if (!valido || evento.key !== 'Enter' || !dentro(evento)) return;
      evento.preventDefault();
      evento.stopPropagation();
      if (valido(valor())) acciones.current.avanzar();
    };
    const alTocar = (evento: MouseEvent) => {
      if (!dentro(evento)) return;
      if (tipo === 'practica') {
        evento.preventDefault();
        evento.stopPropagation();
        acciones.current.avanzar();
      } else if (tipo === 'tocar') {
        setTimeout(() => acciones.current.avanzar(), 0);
      }
    };
    // Un Intro en el formulario también lo envía: en la práctica se para aquí.
    const alEnviar = (evento: Event) => {
      const formulario = evento.target;
      if (
        tipo === 'practica' &&
        formulario instanceof HTMLFormElement &&
        elemento.current !== null &&
        formulario.contains(elemento.current)
      ) {
        evento.preventDefault();
        evento.stopPropagation();
        acciones.current.avanzar();
      }
    };

    // En captura y sobre el documento: llega antes que React, que escucha en su raíz.
    document.addEventListener('input', alEscribir, true);
    document.addEventListener('keydown', alTeclear, true);
    document.addEventListener('click', alTocar, true);
    document.addEventListener('submit', alEnviar, true);
    return () => {
      document.removeEventListener('input', alEscribir, true);
      document.removeEventListener('keydown', alTeclear, true);
      document.removeEventListener('click', alTocar, true);
      document.removeEventListener('submit', alEnviar, true);
    };
  }, [tipo, valido, elemento]);
}

/** `true` si lo señalado lleva un rato sin aparecer: entonces se puede seguir con "Continuar". */
function useSinObjetivo(falta: boolean, clave: string): boolean {
  const [vencida, setVencida] = useState<string | null>(null);
  useEffect(() => {
    if (!falta) return;
    const temporizador = setTimeout(() => setVencida(clave), ESPERA_SIN_OBJETIVO_MS);
    return () => clearTimeout(temporizador);
  }, [falta, clave]);
  return falta && vencida === clave;
}

function Textos({
  paso,
  nombre,
  titulo,
  texto,
}: {
  paso: number;
  nombre: string;
  titulo: string;
  texto: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-xs font-extrabold tracking-[.06em] text-secundario uppercase">
        Paso {paso} de {TOTAL_PASOS} · {nombre}
      </p>
      <h2 className="font-display text-[22px] leading-[1.15] font-extrabold tracking-[-0.01em]">
        {titulo}
      </h2>
      {texto && <p className="text-[15px] leading-[1.45] text-texto-2">{texto}</p>}
    </div>
  );
}

/**
 * La tarjeta guía, fija abajo o arriba (`ladoDeLaTarjeta`). Al cambiar de indicación entra de
 * nuevo (la animación) y su acción principal toma el foco.
 */
function Tarjeta({
  arriba,
  alMedir,
  clave,
  progreso,
  onSaltar,
  pie,
  children,
}: {
  arriba: boolean;
  alMedir: (alto: number) => void;
  clave: string;
  progreso: { hechos: number; parcial: number };
  onSaltar: () => void;
  pie: ReactNode;
  children: ReactNode;
}) {
  const tarjeta = useRef<HTMLElement>(null);
  useEffect(() => {
    tarjeta.current
      ?.querySelector<HTMLButtonElement>('[data-recorrido-principal]:not(:disabled)')
      ?.focus({ preventScroll: true });
  }, [clave]);
  useEffect(() => {
    const elemento = tarjeta.current;
    if (!elemento) return;
    const observador = new ResizeObserver(() => alMedir(elemento.offsetHeight));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [alMedir]);

  const posicion: CSSProperties = arriba
    ? { top: 'max(12px, env(safe-area-inset-top))' }
    : { bottom: 'max(12px, env(safe-area-inset-bottom))' };

  return (
    <section
      ref={tarjeta}
      aria-label="Recorrido guiado"
      style={posicion}
      className="fixed inset-x-3 z-[1210] mx-auto max-w-[480px] rounded-tarjeta border border-borde bg-superficie p-4 text-texto lg:right-6 lg:left-auto lg:w-[420px]"
    >
      <div className="flex items-center gap-3">
        <BarraProgreso {...progreso} />
        <button
          type="button"
          onClick={onSaltar}
          className="-mr-1 h-9 flex-none rounded-control px-2 text-sm font-semibold text-secundario"
        >
          Saltar
        </button>
      </div>
      <div key={clave} className="recorrido-entrar mt-2" aria-live="polite">
        {children}
      </div>
      {pie}
    </section>
  );
}

function BarraProgreso({ hechos, parcial }: { hechos: number; parcial: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Progreso del recorrido"
      aria-valuemin={0}
      aria-valuemax={TOTAL_PASOS}
      aria-valuenow={hechos}
      aria-valuetext={`${hechos} de ${TOTAL_PASOS} pasos`}
      className="flex flex-1 gap-1"
    >
      {Array.from({ length: TOTAL_PASOS }, (_, i) => (
        <span key={i} className="h-2 flex-1 overflow-hidden rounded-full bg-superficie-2">
          <span
            className="recorrido-barra block h-full rounded-full bg-acento"
            style={{
              width: `${i < hechos ? 100 : i === hechos ? Math.round(parcial * 100) : 0}%`,
            }}
          />
        </span>
      ))}
    </div>
  );
}

const agrandar = (caja: Caja, margen: number, pantalla: Pantalla): Caja => {
  const x = Math.max(0, caja.x - margen);
  const y = Math.max(0, caja.y - margen);
  return {
    x,
    y,
    ancho: Math.min(pantalla.ancho, caja.x + caja.ancho + margen) - x,
    alto: Math.min(pantalla.alto, caja.y + caja.alto + margen) - y,
  };
};

/** Un rectángulo de esquinas redondeadas como subtrazado: con `evenodd` queda como hueco. */
function rectanguloRedondeado({ x, y, ancho, alto }: Caja, radio: number): string {
  const r = Math.max(0, Math.min(radio, ancho / 2, alto / 2));
  return (
    `M${x + r} ${y}H${x + ancho - r}A${r} ${r} 0 0 1 ${x + ancho} ${y + r}` +
    `V${y + alto - r}A${r} ${r} 0 0 1 ${x + ancho - r} ${y + alto}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + alto - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}

/**
 * El velo: tinta translúcida sobre toda la pantalla salvo el hueco. El SVG no recibe toques y el
 * trazado sí: lo del hueco (que no se pinta) se puede tocar, y lo demás no.
 */
function Velo({ hueco, pantalla }: { hueco: Caja | null; pantalla: Pantalla }) {
  const { ancho, alto } = pantalla;
  const conHueco = hueco !== null && hueco.ancho > 0 && hueco.alto > 0;
  const trazo =
    `M0 0H${ancho}V${alto}H0Z` +
    (conHueco ? rectanguloRedondeado(agrandar(hueco, MARGEN, pantalla), 12) : '');
  return (
    <svg
      aria-hidden="true"
      className="recorrido-velo fixed inset-0 z-[1200] h-full w-full"
      viewBox={`0 0 ${ancho} ${alto}`}
      preserveAspectRatio="none"
    >
      <path d={trazo} fillRule="evenodd" />
    </svg>
  );
}

function Anillo({ caja }: { caja: Caja }) {
  if (caja.ancho <= 0 || caja.alto <= 0) return null;
  return (
    <div
      aria-hidden="true"
      className="recorrido-anillo pointer-events-none fixed z-[1201]"
      style={{
        left: caja.x - MARGEN,
        top: caja.y - MARGEN,
        width: caja.ancho + MARGEN * 2,
        height: caja.alto + MARGEN * 2,
      }}
    />
  );
}

/** Los siete nombres, en orden ("Tu cuenta" sale una vez aunque la tengan dos pasos). */
const nombresDePasos = (pasos: Readonly<Record<IdPaso, ContenidoPaso>>): string[] => [
  ...new Set(Object.values(pasos).map((p) => p.nombre)),
];

/** "Terminaste el recorrido": los siete pasos marcados y de vuelta al mapa. */
function FinRecorrido({ pasos }: { pasos: Readonly<Record<IdPaso, ContenidoPaso>> }) {
  const tarjeta = useRef<HTMLElement>(null);
  const [pantalla] = useState<Pantalla>(() => ({
    ancho: window.innerWidth,
    alto: window.innerHeight,
  }));
  useEffect(() => {
    tarjeta.current?.querySelector('button')?.focus({ preventScroll: true });
  }, []);
  const terminar = () => {
    recorrido.fijar(null);
    navegar('/');
  };

  return (
    <>
      <Velo hueco={null} pantalla={pantalla} />
      <div className="fixed inset-0 z-[1210] grid place-items-center overflow-y-auto p-4">
        <section
          ref={tarjeta}
          aria-labelledby="titulo-fin-recorrido"
          className="recorrido-entrar w-full max-w-[400px] rounded-tarjeta border border-borde bg-superficie p-5 text-texto lg:p-6"
        >
          <span className="recorrido-check grid h-14 w-14 place-items-center rounded-full bg-acento text-sobre-acento">
            <Icono nombre="check" tamano={30} grosor={2.8} />
          </span>
          <h2
            id="titulo-fin-recorrido"
            className="mt-4 font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.01em]"
          >
            Terminaste el recorrido
          </h2>
          <p className="mt-2 text-[15px] leading-[1.45] text-texto-2">
            Ya sabes avisar y leer el mapa. Puedes repetirlo cuando quieras en Cuenta.
          </p>
          <ol className="mt-4 flex flex-col gap-2">
            {nombresDePasos(pasos).map((nombre, i) => (
              <li key={nombre} className="flex items-center gap-2.5 text-[15px]">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-acento-suave text-acento">
                  <Icono nombre="check" tamano={14} grosor={2.8} />
                </span>
                <span className="sr-only">Paso {i + 1}: </span>
                {nombre}
              </li>
            ))}
          </ol>
          <Boton ancho className="mt-5" onClick={terminar}>
            Ir al mapa
          </Boton>
        </section>
      </div>
    </>
  );
}

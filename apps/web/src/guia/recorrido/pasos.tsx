import {
  CONSENSO_N_POR_DEFECTO,
  CONSENSO_VENTANA_MIN_POR_DEFECTO,
  ESTIMACION_N_MIN_POR_DEFECTO,
} from '@blackout/shared';
import type { ReactNode } from 'react';
import type { IdPaso } from '../../aplicacion/recorrido';
import { BloqueEstimacion } from '../../componentes/ui/BloqueEstimacion';
import { ChipSync, EstadoChip } from '../../componentes/ui/Chips';
import { Consenso } from '../../componentes/ui/Consenso';
import { useConfiguracion } from '../../datos/consultas';
import { CLAVE_MINIMA, validarCredenciales } from '../../dominio/credenciales';
import { duracion } from '../../utils/formato';
import { Ejemplo } from '../piezas';

// El contenido del recorrido (T-073, D-043): qué pantalla abre cada paso, qué se señala y qué se
// dice. Lo señalado se marca en las pantallas reales con `data-guia="…"`. Voz del CANON: tuteo,
// sin exclamaciones, "Luz" y "Agua"; cada texto dice para qué sirve o qué hacer, nada más.

/**
 * Cómo se termina una indicación:
 * - `continuar`: con el botón de la tarjeta (las que explican).
 * - `escribir`: el botón se activa cuando el campo señalado es válido (o con Intro).
 * - `tocar`: al tocar lo señalado; el toque llega a la app.
 * - `practica`: al tocar lo señalado; el toque NO llega a la app (avisar sin enviar nada).
 * - `esperar`: lo cumple la app (llega la sesión, se crea el perfil) o aparece lo que señala la
 *   indicación siguiente (`visibleSi`).
 */
export type Avance =
  | { tipo: 'continuar' }
  | { tipo: 'escribir'; valido: (valor: string) => boolean }
  | { tipo: 'tocar' }
  | { tipo: 'practica' }
  | { tipo: 'esperar' };

export interface Indicacion {
  /** `data-guia` de la zona que queda iluminada y se puede usar. */
  objetivo: string;
  /** `data-guia` de lo que se señala con el anillo; por defecto, el objetivo. */
  foco?: string;
  /**
   * Para los pasos que siguen a la pantalla (la vivienda): la indicación vale mientras este
   * `data-guia` esté a la vista y activo. Se elige la última que cumpla.
   */
  visibleSi?: string;
  titulo: string;
  texto: ReactNode;
  ejemplo?: ReactNode;
  avance: Avance;
}

/** La pantalla de cada paso está en `empezar.ts` (`PANTALLA_PASO`). */
export interface ContenidoPaso {
  nombre: string;
  indicaciones: readonly Indicacion[];
  /** La tarjeta al completar un paso en el que el vecino hizo algo. */
  logro?: { titulo: string; texto: string };
}

const correoValido = (valor: string) =>
  !validarCredenciales(valor, 'x'.repeat(CLAVE_MINIMA)).correo;
const claveValida = (valor: string) => valor.length >= CLAVE_MINIMA;

export function usePasosRecorrido(): Readonly<Record<IdPaso, ContenidoPaso>> {
  const configuracion = useConfiguracion().data;
  const n = configuracion?.consensoN ?? CONSENSO_N_POR_DEFECTO;
  const nMin = configuracion?.estimacionNMin ?? ESTIMACION_N_MIN_POR_DEFECTO;
  const ventanaLuz = duracion(CONSENSO_VENTANA_MIN_POR_DEFECTO.electricidad);
  const ventanaAgua = duracion(CONSENSO_VENTANA_MIN_POR_DEFECTO.agua);

  return {
    cuenta: {
      nombre: 'Tu cuenta',
      indicaciones: [
        {
          objetivo: 'correo',
          titulo: 'Escribe tu correo',
          texto: `Para qué: tus avisos cuentan como los de un vecino, y un corte se confirma cuando avisan ${n} distintos.`,
          avance: { tipo: 'escribir', valido: correoValido },
        },
        {
          objetivo: 'clave',
          titulo: 'Inventa una contraseña',
          texto: `De al menos ${CLAVE_MINIMA} caracteres. Con ella entras desde otro teléfono.`,
          avance: { tipo: 'escribir', valido: claveValida },
        },
        {
          objetivo: 'crear-cuenta',
          titulo: 'Toca «Crear cuenta»',
          texto: 'Se crea al momento y quedas dentro.',
          avance: { tipo: 'esperar' },
        },
      ],
      logro: {
        titulo: 'Cuenta creada',
        texto: 'Ya estás dentro: la sesión queda abierta en este teléfono.',
      },
    },

    entrar: {
      nombre: 'Tu cuenta',
      indicaciones: [
        {
          objetivo: 'nav-cuenta',
          titulo: 'Así entras la próxima vez',
          texto:
            'Si cierras sesión o cambias de teléfono, entra por Cuenta con el mismo correo y contraseña.',
          avance: { tipo: 'continuar' },
        },
      ],
    },

    vivienda: {
      nombre: 'Tu vivienda',
      indicaciones: [
        {
          objetivo: 'registro-vivienda',
          foco: 'mapa-vivienda',
          titulo: 'Toca tu casa en el mapa',
          texto:
            'Acerca el mapa hasta tu calle y toca sobre tu casa. Nadie ve el punto: solo sirve para saber tu sector.',
          avance: { tipo: 'esperar' },
        },
        {
          objetivo: 'registro-vivienda',
          foco: 'continuar-pin',
          visibleSi: 'continuar-pin',
          titulo: 'Toca «Continuar»',
          texto: 'Si el pin no quedó sobre tu casa, toca otra vez en el mapa.',
          avance: { tipo: 'esperar' },
        },
        {
          objetivo: 'registro-vivienda',
          foco: 'confirmar-vivienda',
          visibleSi: 'confirmar-vivienda',
          titulo: 'Confirma tu sector',
          texto:
            'Es el hexágono donde está tu casa: tus avisos cuentan ahí. Se marca una sola vez.',
          avance: { tipo: 'esperar' },
        },
      ],
      logro: {
        titulo: 'Vivienda marcada',
        texto: 'Ya puedes avisar de los cortes de tu sector.',
      },
    },

    mapa: {
      nombre: 'El mapa',
      indicaciones: [
        {
          objetivo: 'selector-servicio',
          titulo: 'Elige Luz o Agua',
          texto: 'Cada servicio tiene su propio mapa. Toca el que quieras ver.',
          avance: { tipo: 'tocar' },
        },
        {
          objetivo: 'leyenda',
          titulo: 'Qué dice cada color',
          texto:
            'Cada sector se pinta según lo que avisan sus vecinos: sin servicio, sin confirmar o con servicio.',
          avance: { tipo: 'continuar' },
        },
        {
          objetivo: 'estado-sector',
          titulo: 'Así está tu sector',
          texto: 'Si hay servicio y desde cuándo. Toca otro sector del mapa para ver el suyo.',
          avance: { tipo: 'continuar' },
        },
      ],
    },

    avisar: {
      nombre: 'Avisar un corte',
      indicaciones: [
        {
          objetivo: 'tarjetas-servicio',
          titulo: 'Elige qué se fue',
          texto: 'Luz o Agua. Puedes tener abierto un corte de cada uno a la vez.',
          avance: { tipo: 'tocar' },
        },
        {
          objetivo: 'cuando',
          titulo: '¿Cuándo pasó?',
          texto:
            '«Ahora» si acaba de pasar. Si avisas tarde, «Fue antes» y la hora: cuenta la hora real del corte.',
          avance: { tipo: 'continuar' },
        },
        {
          objetivo: 'boton-avisar',
          titulo: 'Toca para avisar',
          texto: 'Es una práctica: este toque no envía nada.',
          avance: { tipo: 'practica' },
        },
      ],
      logro: {
        titulo: 'Así se avisa',
        texto:
          'Cuando vuelva el servicio, el mismo botón dice «Ya volvió»: con las dos horas se sabe cuánto duró.',
      },
    },

    consenso: {
      nombre: 'Cómo se confirma',
      indicaciones: [
        {
          objetivo: 'despues-de-avisar',
          titulo: 'Un aviso solo no cambia el mapa',
          texto: `El sector cambia cuando avisan ${n} vecinos distintos en menos de ${ventanaLuz} si es la luz, o de ${ventanaAgua} si es el agua. La vuelta se confirma igual.`,
          ejemplo: (
            <Ejemplo>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-estado-sin-confirmar-tinta">
                <EstadoChip estado="sin-confirmar" />
                <Consenso llenas={1} total={n} texto={`1 de ${n} reportes`} />
              </div>
            </Ejemplo>
          ),
          avance: { tipo: 'continuar' },
        },
      ],
    },

    estimacion: {
      nombre: 'Cuánto suele durar',
      indicaciones: [
        {
          objetivo: 'estimacion',
          titulo: 'Cuánto suele durar un corte',
          texto: `La mediana de los cortes ya cerrados de tu sector, con cuántos se calculó. Con menos de ${nMin} sale «datos insuficientes».`,
          ejemplo: (
            <Ejemplo>
              <BloqueEstimacion
                estimacion={{ suficiente: true, n: 12, medianaMin: 240 }}
                nMin={nMin}
              />
            </Ejemplo>
          ),
          avance: { tipo: 'continuar' },
        },
      ],
    },

    'sin-conexion': {
      nombre: 'Sin conexión',
      indicaciones: [
        {
          objetivo: 'nav-avisos',
          titulo: 'Sin señal también puedes avisar',
          texto:
            'El aviso se guarda en el teléfono con su hora y se envía solo al volver la red. Mientras, aquí sale «Pendiente».',
          ejemplo: (
            <Ejemplo>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-semibold">Se fue la luz</span>
                  <span className="text-secundario"> · 14:05</span>
                </p>
                <ChipSync estado="pendiente" />
              </div>
            </Ejemplo>
          ),
          avance: { tipo: 'continuar' },
        },
      ],
    },
  };
}

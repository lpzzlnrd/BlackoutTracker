// Observador mínimo sin librerías. Su forma (`leer` síncrono + `suscribir` que devuelve la baja)
// es la que pide `useSyncExternalStore`, así que React se engancha sin adaptador intermedio.

export type Desuscribir = () => void;

/** Algo que tiene un valor actual y avisa cuando cambia. */
export interface Observable<T> {
  leer(): T;
  suscribir(avisar: () => void): Desuscribir;
}

/** Observable con escritura: lo usan los adaptadores; los consumidores solo ven `Observable<T>`. */
export interface Almacen<T> extends Observable<T> {
  fijar(valor: T): void;
}

export function crearAlmacen<T>(inicial: T): Almacen<T> {
  let valor = inicial;
  const oyentes = new Set<() => void>();
  return {
    leer: () => valor,
    fijar(nuevo) {
      if (Object.is(nuevo, valor)) return;
      valor = nuevo;
      for (const avisar of [...oyentes]) avisar();
    },
    suscribir(avisar) {
      oyentes.add(avisar);
      return () => {
        oyentes.delete(avisar);
      };
    },
  };
}

/** Difusor sin valor: para avisar "algo cambió" (p. ej. la cola) o entregar eventos sueltos. */
export interface Emisor<E> {
  emitir(evento: E): void;
  suscribir(oyente: (evento: E) => void): Desuscribir;
}

export function crearEmisor<E = void>(): Emisor<E> {
  const oyentes = new Set<(evento: E) => void>();
  return {
    emitir(evento) {
      for (const oyente of [...oyentes]) oyente(evento);
    },
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },
  };
}

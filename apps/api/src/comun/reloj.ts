/** Reloj inyectable: los tests lo reemplazan para fijar "ahora". */
export const RELOJ = Symbol('RELOJ');
export type Reloj = () => Date;

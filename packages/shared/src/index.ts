// @blackout/shared: tipos, enums y constantes comunes de la API (apps/api) y del frontend
// (apps/web). Solo exporta declaraciones, valores constantes y la función pura de la cola offline;
// no depende de nada en runtime (docs/PLAN.md §3).
export * from './constantes';
export * from './dto';
export * from './enums';
export * from './errores';
export * from './sincronizacion';

// `localStorage` puede lanzar al leerlo (iframes con el almacenamiento bloqueado): por eso el try.
export const almacenLocal = (): Storage | undefined => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
};

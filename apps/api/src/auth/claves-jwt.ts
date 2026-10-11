import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

/** Token de inyección del *getter* de claves: en los tests se reemplaza por un JWKS local. */
export const CLAVES_JWT = Symbol('CLAVES_JWT');

/** El JWKS no se guarda en caché más de 10 minutos (CLAUDE.md §4): una clave rotada se recoge sola. */
export const CACHE_JWKS_MS = 600_000;

/** Quita la barra final para armar bien el issuer y la URL del JWKS. */
export function baseSupabase(supabaseUrl: string): string {
  return supabaseUrl.replace(/\/+$/, '');
}

/** Emisor esperado en el JWT: `<SUPABASE_URL>/auth/v1`. */
export function issuerSupabase(supabaseUrl: string): string {
  return `${baseSupabase(supabaseUrl)}/auth/v1`;
}

/** Claves públicas de Supabase Auth (claves de firma asimétricas). */
export function crearClavesRemotas(supabaseUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(`${issuerSupabase(supabaseUrl)}/.well-known/jwks.json`), {
    cacheMaxAge: CACHE_JWKS_MS,
  });
}

import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey, SignJWT } from 'jose';

export const SUPABASE_URL_TEST = 'http://supabase.test';
export const ISSUER_TEST = `${SUPABASE_URL_TEST}/auth/v1`;

type Clave = Awaited<ReturnType<typeof generateKeyPair>>;

/** Par de claves ES256 de pruebas y el JWKS local con su parte pública (nunca el Supabase real). */
export class EmisorJwt {
  private constructor(
    private readonly clave: Clave,
    readonly claves: JWTVerifyGetKey,
  ) {}

  static async crear(kid = 'clave-de-prueba'): Promise<EmisorJwt> {
    const clave = await generateKeyPair('ES256');
    const publica = { ...(await exportJWK(clave.publicKey)), kid, alg: 'ES256', use: 'sig' };
    return new EmisorJwt(clave, createLocalJWKSet({ keys: [publica] }));
  }

  /** Firma un token como lo haría Supabase Auth; cada campo se puede alterar para los casos negativos. */
  async firmar(
    opciones: {
      sub?: string | null;
      issuer?: string;
      audience?: string;
      /** Segundos desde ahora (negativo = ya vencido). */
      expira?: number;
      kid?: string;
    } = {},
  ): Promise<string> {
    const jwt = new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: opciones.kid ?? 'clave-de-prueba' })
      .setIssuer(opciones.issuer ?? ISSUER_TEST)
      .setAudience(opciones.audience ?? 'authenticated')
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + (opciones.expira ?? 3600));
    if (opciones.sub !== null)
      jwt.setSubject(opciones.sub ?? '3f0c9a52-1b7e-4a52-9b0e-6a0c2f5d8e11');
    return jwt.sign(this.clave.privateKey);
  }
}

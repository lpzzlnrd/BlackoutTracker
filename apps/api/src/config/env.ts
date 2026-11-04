import { plainToInstance, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import {
  CONSENSO_N_POR_DEFECTO,
  CONSENSO_VENTANA_MIN_POR_DEFECTO,
  ESTIMACION_N_MIN_POR_DEFECTO,
  RECORDATORIO_REPORTE_ABIERTO_HORAS_POR_DEFECTO,
  RECORDATORIOS_HORAS_POR_DEFECTO,
  REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO,
  REPORTE_VENCE_HORAS_POR_DEFECTO,
  SILENCIO_DESDE_POR_DEFECTO,
  SILENCIO_HASTA_POR_DEFECTO,
} from '@blackout/shared';

const aEntero = () =>
  Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)));

/**
 * Variables de entorno (docs/PLAN.md §7). Se validan al arrancar: si falta una obligatoria o un
 * valor no sirve, Nest no levanta. Los números llevan por defecto los de `@blackout/shared`.
 */
export class Env {
  @IsInt() @Min(1) @Max(65535) @aEntero() PORT: number = 3000;

  /**
   * Conexión a Postgres (pooler de Supabase en modo transaction, puerto 6543, o el PostGIS local).
   * Se comprueba el esquema para que un valor mal pegado falle aquí con su nombre y no como un
   * "Invalid URL" del driver (pasó en el primer despliegue a Render, T-053).
   */
  @Matches(/^postgres(ql)?:\/\/\S+$/, {
    message: 'DATABASE_URL debe ser una cadena postgresql://usuario:clave@host:puerto/base',
  })
  @IsString()
  DATABASE_URL!: string;

  /** Origen de Supabase: de aquí salen el JWKS y el issuer que verifica el guard JWT. */
  @IsUrl({ require_tld: false }) SUPABASE_URL!: string;

  @IsString() JWT_AUDIENCE: string = 'authenticated';

  /** Orígenes CORS separados por coma. Nunca `*`: cada origen se lista de forma explícita. */
  @Matches(/^[^*]*$/, { message: 'CORS_ORIGINS no admite "*": lista cada origen' })
  @IsString()
  CORS_ORIGINS: string = 'http://localhost:5173';

  /** Proxies de confianza delante de la API (1 en Render). Sin esto el throttle ve la IP del proxy. */
  @IsInt() @Min(0) @Max(5) @aEntero() TRUST_PROXY: number = 0;

  @IsInt() @Min(1) @aEntero() CONSENSO_N: number = CONSENSO_N_POR_DEFECTO;
  @IsInt() @Min(1) @aEntero() CONSENSO_VENTANA_MIN_ELECTRICIDAD: number =
    CONSENSO_VENTANA_MIN_POR_DEFECTO.electricidad;
  @IsInt() @Min(1) @aEntero() CONSENSO_VENTANA_MIN_AGUA: number =
    CONSENSO_VENTANA_MIN_POR_DEFECTO.agua;
  @IsInt() @Min(1) @aEntero() ESTIMACION_N_MIN: number = ESTIMACION_N_MIN_POR_DEFECTO;
  @IsInt() @Min(1) @aEntero() REPORTE_MAX_ANTIGUEDAD_DIAS: number =
    REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO;
  @IsInt() @Min(1) @aEntero() REPORTE_VENCE_HORAS: number = REPORTE_VENCE_HORAS_POR_DEFECTO;

  /** Activa el cron de las ventanas de consenso (T-033). Los tests lo apagan y lo invocan a mano. */
  @IsBoolean()
  @Transform(({ value }) => (value === '' || value == null ? undefined : String(value) !== 'false'))
  CRON_ACTIVO: boolean = true;

  // ─── Notificaciones push (T-072, D-042) ──────────────────────────────────────────────────

  /**
   * Claves VAPID de Web Push (`npx web-push generate-vapid-keys`). Van las dos o ninguna: sin ellas
   * la API no envía nada y `GET /notificaciones/clave` responde `activo: false`.
   */
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{87}$/, { message: 'VAPID_PUBLIC_KEY: 87 caracteres base64url' })
  VAPID_PUBLIC_KEY?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'VAPID_PRIVATE_KEY: 43 caracteres base64url' })
  VAPID_PRIVATE_KEY?: string;

  /** Contacto que ven los servicios push si algo falla: `mailto:` o una URL `https://`. */
  @Matches(/^(mailto:|https:\/\/)\S+$/, { message: 'VAPID_SUBJECT: mailto:… o https://…' })
  VAPID_SUBJECT: string = 'https://github.com/lpzzlnrd/BlackoutTracker';

  /**
   * Horas de Caracas en que salen los recordatorios, separadas por coma («19» o «12,19»). El tope
   * diario es el número de horas: subirlo a 2 es poner dos. Vacío apaga los recordatorios.
   */
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(23, { each: true })
  @ArrayMaxSize(4)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((h) => h.trim())
          .filter((h) => h !== '')
          .map(Number)
      : value,
  )
  RECORDATORIOS_HORAS: number[] = [...RECORDATORIOS_HORAS_POR_DEFECTO];

  /** Horas silenciosas (Caracas): desde las 22:00 hasta las 07:00 no suena nada salvo el agua de noche. */
  @IsInt() @Min(0) @Max(23) @aEntero() SILENCIO_DESDE: number = SILENCIO_DESDE_POR_DEFECTO;
  @IsInt() @Min(0) @Max(23) @aEntero() SILENCIO_HASTA: number = SILENCIO_HASTA_POR_DEFECTO;

  /**
   * URL pública de esta API, sin `/api` (p. ej. `https://blackouttracker.onrender.com`). La usa la
   * imagen del hexágono en la notificación; sin ella las notificaciones salen sin imagen.
   */
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  API_URL_PUBLICA?: string;

  /** «¿Ya volvió?» sin estimación suficiente: horas que lleva abierto el reporte. */
  @IsInt() @Min(1) @aEntero() RECORDATORIO_REPORTE_ABIERTO_HORAS: number =
    RECORDATORIO_REPORTE_ABIERTO_HORAS_POR_DEFECTO;
}

/** Para `ConfigModule.forRoot({ validate })`. */
export function validarEnv(crudo: Record<string, unknown>): Env {
  const env = plainToInstance(Env, crudo, { exposeDefaultValues: true });
  const errores = validateSync(env).map(
    (e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
  );
  if (Boolean(env.VAPID_PUBLIC_KEY) !== Boolean(env.VAPID_PRIVATE_KEY)) {
    errores.push('VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY: van las dos o ninguna');
  }
  if (errores.length > 0) {
    throw new Error(`Configuración inválida (.env):\n  ${errores.join('\n  ')}`);
  }
  return env;
}

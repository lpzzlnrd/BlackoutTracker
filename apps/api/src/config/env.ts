import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsString, IsUrl, Max, Min, validateSync } from 'class-validator';
import {
  CONSENSO_N_POR_DEFECTO,
  CONSENSO_VENTANA_MIN_POR_DEFECTO,
  ESTIMACION_N_MIN_POR_DEFECTO,
  REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO,
  REPORTE_VENCE_HORAS_POR_DEFECTO,
} from '@blackout/shared';

const aEntero = () =>
  Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)));

/**
 * Variables de entorno (docs/PLAN.md §7). Se validan al arrancar: si falta una obligatoria o un
 * valor no sirve, Nest no levanta. Los números llevan por defecto los de `@blackout/shared`.
 */
export class Env {
  @IsInt() @Min(1) @Max(65535) @aEntero() PORT: number = 3000;

  /** Conexión a Postgres (pooler de Supabase en modo session, o el PostGIS local). */
  @IsString() DATABASE_URL!: string;

  /** Origen de Supabase: de aquí salen el JWKS y el issuer que verifica el guard JWT. */
  @IsUrl({ require_tld: false }) SUPABASE_URL!: string;

  @IsString() JWT_AUDIENCE: string = 'authenticated';

  /** Orígenes CORS separados por coma. */
  @IsString() CORS_ORIGINS: string = 'http://localhost:5173';

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
}

/** Para `ConfigModule.forRoot({ validate })`. */
export function validarEnv(crudo: Record<string, unknown>): Env {
  const env = plainToInstance(Env, crudo, { exposeDefaultValues: true });
  const errores = validateSync(env);
  if (errores.length > 0) {
    const detalle = errores
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n  ');
    throw new Error(`Configuración inválida (.env):\n  ${detalle}`);
  }
  return env;
}

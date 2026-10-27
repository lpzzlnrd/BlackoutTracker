import { useId, type InputHTMLAttributes } from 'react';

/** `<label>` + `<input>` + la nota o el error asociados por `aria-describedby` (CANON §8). */
export function Campo({
  etiqueta,
  error,
  ayuda,
  className = '',
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; error?: string; ayuda?: string }) {
  const id = useId();
  const idNota = `${id}-nota`;
  const nota = error ?? ayuda;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {etiqueta}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={nota ? idNota : undefined}
        className={`h-11 rounded-control border bg-superficie px-3 text-base text-texto ${error ? 'border-estado-sin-servicio-trazo' : 'border-borde-control'}`}
        {...resto}
      />
      {nota && (
        <p
          id={idNota}
          className={`text-[13px] ${error ? 'text-estado-sin-servicio-tinta' : 'text-secundario'}`}
        >
          {nota}
        </p>
      )}
    </div>
  );
}

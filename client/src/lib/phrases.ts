// Frases motivacionales. Se elige una estable por día.
export const PHRASES = [
  'Lo pequeño hecho hoy construye lo grande de mañana.',
  'Una isla a la vez. Sin prisa, sin pausa.',
  'El orden no se encuentra, se arma.',
  'Hoy es un buen día para avanzar un paso.',
  'Tus ideas merecen un lugar donde vivir.',
  'Empieza por lo simple; lo demás se acomoda.',
  'La constancia vence a la intensidad.',
  'Cada cosa en su isla, y la mente en calma.',
  'No tienes que terminarlo, solo empezarlo.',
  'Lo que anotas, deja de pesarte.',
  'Pequeños hábitos, grandes cambios.',
  'El progreso silencioso también cuenta.',
];

export function phraseForDate(iso: string): string {
  // Suma de codigos del string -> indice estable por día.
  let sum = 0;
  for (let i = 0; i < iso.length; i++) sum += iso.charCodeAt(i);
  return PHRASES[sum % PHRASES.length];
}

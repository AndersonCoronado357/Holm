// Devuelve un color de texto legible (oscuro o claro) sobre un fondo dado.
export function idealText(hex: string | null): string {
  if (!hex) return 'var(--text)';
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return 'var(--text)';
  // Luminancia relativa aproximada
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1b1f23' : '#ffffff';
}

// Color con baja opacidad para fondos suaves (acepta hex).
export function softBg(hex: string | null, alpha = 0.16): string | undefined {
  if (!hex) return undefined;
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return undefined;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

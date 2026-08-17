import { useEffect, useRef, useState } from 'react';

// Las islas se abren al pasar el mouse (hover) y se cierran al salir, con un
// pequeño retardo para no parpadear al moverse del bubble al panel.
//
// En una pantalla táctil no hay hover: los eventos de mouse que el navegador
// simula al tocar abren la isla pero el `mouseleave` casi nunca llega, así que
// se quedaba abierta para siempre. Ahí se ignora el hover y se cierra al tocar
// fuera (el toque en el botón la abre, como antes).
export function useIslaOpen(delay = 160) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  const tactil = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const enter = () => {
    if (tactil) return;
    cancel();
    setOpen(true);
  };
  const leave = () => {
    if (tactil) return;
    cancel();
    timer.current = setTimeout(() => setOpen(false), delay);
  };

  // Solo una isla abierta a la vez: en un móvil las cuatro se pisan entre sí.
  useEffect(() => {
    const yo = box;
    const otra = (e: Event) => {
      if ((e as CustomEvent).detail !== yo) setOpen(false);
    };
    window.addEventListener('holm:isla', otra);
    return () => window.removeEventListener('holm:isla', otra);
  }, []);

  useEffect(() => {
    if (open) window.dispatchEvent(new CustomEvent('holm:isla', { detail: box }));
  }, [open]);

  useEffect(() => {
    if (!tactil || !open) return;
    const fuera = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    // En la fase de captura: así se cierra aunque el lienzo se quede el evento.
    window.addEventListener('pointerdown', fuera, true);
    return () => window.removeEventListener('pointerdown', fuera, true);
  }, [tactil, open]);

  useEffect(() => cancel, []);

  return {
    open,
    setOpen,
    hoverProps: { ref: box, onMouseEnter: enter, onMouseLeave: leave },
  };
}

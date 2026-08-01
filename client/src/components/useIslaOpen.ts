import { useRef, useState } from 'react';

// Las islas se abren al pasar el mouse (hover) y se cierran al salir, con un
// pequeño retardo para no parpadear al moverse del bubble al panel. Mantiene
// un toggle por click para pantallas táctiles.
export function useIslaOpen(delay = 160) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const enter = () => {
    cancel();
    setOpen(true);
  };
  const leave = () => {
    cancel();
    timer.current = setTimeout(() => setOpen(false), delay);
  };

  return {
    open,
    setOpen,
    hoverProps: { onMouseEnter: enter, onMouseLeave: leave },
  };
}

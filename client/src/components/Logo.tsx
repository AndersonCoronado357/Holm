interface Props {
  size?: number;
  className?: string;
}

// Marca de Holm: la isla con su sol y las olas. Una sola fuente (public/holm.svg)
// para que el favicon y el logo dentro de la app sean idénticos.
export function IslandMark({ size = 32, className }: Props) {
  return (
    <img
      src="/holm.svg?v=4"
      width={size}
      height={size}
      className={className}
      alt="Holm"
      draggable={false}
      style={{ display: 'block' }}
    />
  );
}

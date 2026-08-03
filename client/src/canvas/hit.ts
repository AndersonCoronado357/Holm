// Detección de "¿sobre qué solté?" para los conectores, al estilo de draw.io.
//
// Importa usar `elementsFromPoint` (en plural): mientras arrastras, la propia
// manija va pegada al cursor y taparía al nodo de abajo si sólo mirásemos el
// primer elemento. Recorremos la pila hasta encontrar un puerto o un nodo.
export interface HitTarget {
  nodeId: string | null;
  /** Puerto exacto si soltaste sobre uno; null si fue sobre el cuerpo (flotante). */
  port: string | null;
}

export function hitTarget(clientX: number, clientY: number): HitTarget {
  const stack = document.elementsFromPoint(clientX, clientY) as HTMLElement[];
  for (const el of stack) {
    if (typeof el.closest !== 'function') continue;
    // Un puerto concreto gana: la conexión queda clavada ahí.
    const portEl = el.closest('[data-port]') as HTMLElement | null;
    if (portEl) {
      const nodeId = portEl.getAttribute('data-port-node');
      if (nodeId) return { nodeId, port: portEl.getAttribute('data-port') };
    }
    // Si no, el cuerpo del elemento: conexión flotante (elige lado sola).
    const host = el.closest('[data-el-id]') as HTMLElement | null;
    if (host) return { nodeId: host.getAttribute('data-el-id'), port: null };
  }
  return { nodeId: null, port: null };
}

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ObjectId } from 'mongodb';

// Envuelve handlers async para que los errores lleguen al middleware de error
// (Express 4 no captura promesas rechazadas por si solo).
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function toClient(doc: Record<string, any> | null): any {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id?.toString?.() ?? _id, ...rest };
}

export function toClientMany(docs: Record<string, any>[]): any[] {
  return docs.map(toClient);
}

export function oid(id: string): ObjectId {
  return new ObjectId(id);
}

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && ObjectId.isValid(id);
}

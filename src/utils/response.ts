import type { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, 201);
}

export function noContent(res: Response) {
  return res.status(204).send();
}

export function badRequest(res: Response, message: string, errors?: unknown) {
  return res.status(400).json({ success: false, message, errors });
}

export function unauthorized(res: Response, message = 'Unauthorized') {
  return res.status(401).json({ success: false, message });
}

export function forbidden(res: Response, message = 'Forbidden') {
  return res.status(403).json({ success: false, message });
}

export function notFound(res: Response, resource = 'Resource') {
  return res.status(404).json({ success: false, message: `${resource} not found` });
}

export function conflict(res: Response, message: string) {
  return res.status(409).json({ success: false, message });
}

export function serverError(res: Response, message = 'Internal server error') {
  return res.status(500).json({ success: false, message });
}

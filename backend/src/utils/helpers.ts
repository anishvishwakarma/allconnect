import { Response } from 'express';

export function sendError(res: Response, status: number, message: string): Response {
  return res.status(status).json({ error: message });
}

export function sendSuccess<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json(data);
}

/**
 * Calculates post expiry: eventAt + durationMinutes (in ms) + 30-min buffer
 */
export function calcExpiresAt(eventAt: Date, durationMinutes: number): Date {
  return new Date(eventAt.getTime() + (durationMinutes + 30) * 60 * 1000);
}

/**
 * Check if a user has exceeded free post limit (5/month)
 */
export function hasReachedFreeLimit(postsThisMonth: number, subscriptionEndsAt?: Date): boolean {
  if (subscriptionEndsAt && subscriptionEndsAt > new Date()) return false;
  return postsThisMonth >= 5;
}

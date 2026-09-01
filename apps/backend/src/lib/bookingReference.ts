import crypto from 'crypto';
import { prisma } from './prisma';

export function generateReferenceCandidate(): string {
  return `BK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function generateUniqueBookingReference(): Promise<string> {
  let candidate = generateReferenceCandidate();
  while (await prisma.booking.findUnique({ where: { reference: candidate } })) {
    candidate = generateReferenceCandidate();
  }
  return candidate;
}

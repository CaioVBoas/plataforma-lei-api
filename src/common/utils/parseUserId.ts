import { UnauthorizedException } from '@nestjs/common';

/**
 * O contrato externo trata o identificador como string; o banco usa inteiro
 * autoincremento. `Number('abc')` devolveria `NaN` e o Prisma lançaria um
 * erro obscuro, então a validação acontece antes de tocar o banco.
 */
export function parseUserId(userId: string): number {
  const parsed = Number(userId);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new UnauthorizedException();
  }

  return parsed;
}

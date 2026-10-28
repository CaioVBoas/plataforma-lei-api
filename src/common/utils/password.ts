import { BadRequestException } from '@nestjs/common';

export const SALT_ROUNDS = 10;

/** Senha com pelo menos 8 caracteres, letras e números. */
export function checkPasswordRules(password: string): void {
  if (password.length < 8) {
    throw new BadRequestException(
      'A senha precisa de pelo menos 8 caracteres.',
    );
  }
  if (!/[a-zA-ZÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    throw new BadRequestException('Use letras e números na senha.');
  }
}

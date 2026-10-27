import { UnprocessableEntityException } from '@nestjs/common';

/** Violação de regra de negócio: o pedido é válido, mas o estado do domínio não permite. */
export class BusinessRuleException extends UnprocessableEntityException {
  constructor(message: string) {
    super(message);
  }
}

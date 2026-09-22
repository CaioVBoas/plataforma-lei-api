import { PapelUsuario } from '@prisma/client';
import { Role } from '../enums/role.enum';

/**
 * O banco fala português (`PapelUsuario`) e o contrato externo fala inglês (`Role`).
 * A tradução acontece aqui, e os dois mapas são totais: todo valor de um lado
 * tem destino no outro. É por isso que `Role` não pode ganhar um valor que o
 * `PapelUsuario` não represente.
 */
const ROLE_TO_PAPEL: Record<Role, PapelUsuario> = {
  [Role.STUDENT]: PapelUsuario.ESTUDANTE,
  [Role.PROFESSOR]: PapelUsuario.DOCENTE,
  [Role.ORGANIZATION]: PapelUsuario.PARCEIRO,
};

const PAPEL_TO_ROLE: Record<PapelUsuario, Role> = {
  [PapelUsuario.ESTUDANTE]: Role.STUDENT,
  [PapelUsuario.DOCENTE]: Role.PROFESSOR,
  [PapelUsuario.PARCEIRO]: Role.ORGANIZATION,
};

export function toPapelUsuario(role: Role): PapelUsuario {
  return ROLE_TO_PAPEL[role];
}

export function toRole(papel: PapelUsuario): Role {
  return PAPEL_TO_ROLE[papel];
}

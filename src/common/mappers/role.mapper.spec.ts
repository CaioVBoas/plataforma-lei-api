import { PapelUsuario } from '@prisma/client';
import { Role } from '../enums/role.enum';
import { toPapelUsuario, toRole } from './role.mapper';

describe('role.mapper', () => {
  const pairs: Array<[Role, PapelUsuario]> = [
    [Role.STUDENT, PapelUsuario.ESTUDANTE],
    [Role.PROFESSOR, PapelUsuario.DOCENTE],
    [Role.ORGANIZATION, PapelUsuario.PARCEIRO],
  ];

  it.each(pairs)('traduz %s para %s', (role, papel) => {
    expect(toPapelUsuario(role)).toBe(papel);
  });

  it.each(pairs)('traduz de volta %s a partir de %s', (role, papel) => {
    expect(toRole(papel)).toBe(role);
  });

  it('é total: todo valor de Role tem destino em PapelUsuario', () => {
    for (const role of Object.values(Role)) {
      expect(toPapelUsuario(role)).toBeDefined();
    }
  });

  it('é total: todo valor de PapelUsuario tem destino em Role', () => {
    for (const papel of Object.values(PapelUsuario)) {
      expect(toRole(papel)).toBeDefined();
    }
  });

  it('não expõe nenhum papel sem correspondente no banco', () => {
    expect(Object.values(Role).sort()).toEqual([
      'ORGANIZATION',
      'PROFESSOR',
      'STUDENT',
    ]);
  });
});

import { TipoParceiro } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAccountDto } from '../../modules/account/dto/updateAccount.dto';
import { RegisterPartnerDto } from '../../modules/auth/dto/registerPartner.dto';
import { RegisterProfessorDto } from '../../modules/auth/dto/registerProfessor.dto';
import { UpdateOrgImagesDto } from '../../modules/orgProfile/dto/updateOrgImages.dto';
import { UpdateOrgProfileDto } from '../../modules/orgProfile/dto/updateOrgProfile.dto';

/** Mesma configuração do ValidationPipe global em `main.ts`. */
async function errorsOf<T extends object>(
  cls: new () => T,
  body: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  const flatten = (list: typeof errors): string[] =>
    list.flatMap((error) => [
      ...Object.values(error.constraints ?? {}),
      ...flatten(error.children ?? []),
    ]);

  return flatten(errors);
}

describe('validação dos corpos de requisição', () => {
  describe('RegisterProfessorDto', () => {
    const valid = {
      email: 'maria.silva@cin.ufpe.br',
      password: 'senhaSegura123',
      name: 'Maria Silva',
      department: 'Centro de Informática',
    };

    it.each(['maria@ufpe.br', 'maria@cin.ufpe.br', 'Maria@CIN.UFPE.BR'])(
      'aceita e-mail institucional %s',
      async (email) => {
        await expect(
          errorsOf(RegisterProfessorDto, { ...valid, email }),
        ).resolves.toEqual([]);
      },
    );

    it.each(['maria@gmail.com', 'maria@ufpe.br.com', 'maria@outraufpe.br.org'])(
      'recusa e-mail fora da UFPE (%s)',
      async (email) => {
        await expect(
          errorsOf(RegisterProfessorDto, { ...valid, email }),
        ).resolves.toContain('Use seu e-mail @ufpe.br ou @cin.ufpe.br.');
      },
    );

    it('exige e-mail', async () => {
      await expect(
        errorsOf(RegisterProfessorDto, { ...valid, email: undefined }),
      ).resolves.toContain('O e-mail é obrigatório.');
    });

    it('exige departamento', async () => {
      await expect(
        errorsOf(RegisterProfessorDto, { ...valid, department: '' }),
      ).resolves.toContain('Informe o departamento.');
    });
  });

  describe('RegisterPartnerDto', () => {
    const valid = {
      email: 'contato@ongverde.org',
      password: 'senhaSegura123',
      name: 'ONG Verde Recife',
      type: TipoParceiro.ORGANIZACAO_SOCIAL_ONG,
      location: 'Boa Viagem, Recife',
      focalName: 'Ana Souza',
      focalRole: 'Coordenadora',
    };

    it('aceita o cadastro completo, com e-mail de qualquer domínio', async () => {
      await expect(errorsOf(RegisterPartnerDto, valid)).resolves.toEqual([]);
    });

    it.each([
      ['location', 'Informe onde a organização fica.'],
      ['focalName', 'Informe seu nome.'],
      ['focalRole', 'Informe seu cargo.'],
    ])('exige %s', async (field, message) => {
      await expect(
        errorsOf(RegisterPartnerDto, { ...valid, [field]: '' }),
      ).resolves.toContain(message);
    });
  });

  describe('UpdateAccountDto', () => {
    it.each([{ photo: '' }, { photo: 'data:image/jpeg;base64,/9j/4AAQ' }])(
      'aceita foto vazia ou em data URL (%o)',
      async (body) => {
        await expect(errorsOf(UpdateAccountDto, body)).resolves.toEqual([]);
      },
    );

    it.each([
      'https://exemplo.org/foto.jpg',
      'data:text/html;base64,PGh0bWw+',
      'data:image/svg+xml;base64,PHN2Zz4=',
    ])('recusa foto que não é imagem em data URL (%s)', async (photo) => {
      await expect(errorsOf(UpdateAccountDto, { photo })).resolves.toContain(
        'A foto precisa ser uma imagem.',
      );
    });

    it('recusa troca de e-mail', async () => {
      await expect(
        errorsOf(UpdateAccountDto, { email: 'outro@ufpe.br' }),
      ).resolves.toContain('property email should not exist');
    });

    it('recusa nome em branco', async () => {
      await expect(errorsOf(UpdateAccountDto, { name: '' })).resolves.toContain(
        'Informe seu nome.',
      );
    });
  });

  describe('UpdateOrgProfileDto', () => {
    it('valida o contato aninhado', async () => {
      const errors = await errorsOf(UpdateOrgProfileDto, {
        contact: { focalName: '', email: 'sem-arroba' },
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          'Informe quem é o ponto focal.',
          'Informe um e-mail válido para o ponto focal.',
        ]),
      );
    });

    it('recusa troca do nome da organização', async () => {
      await expect(
        errorsOf(UpdateOrgProfileDto, { name: 'Outro nome' }),
      ).resolves.toContain('property name should not exist');
    });

    it('recusa tipo fora do enum', async () => {
      await expect(
        errorsOf(UpdateOrgProfileDto, { type: 'Órgão público' }),
      ).resolves.toContain('Tipo de parceiro inválido.');
    });
  });

  describe('UpdateOrgImagesDto', () => {
    it('aceita remover o logo e trocar a capa', async () => {
      await expect(
        errorsOf(UpdateOrgImagesDto, {
          logo: '',
          cover: 'data:image/jpeg;base64,/9j/4AAQ',
        }),
      ).resolves.toEqual([]);
    });

    it('recusa logo que não é imagem', async () => {
      await expect(
        errorsOf(UpdateOrgImagesDto, { logo: 'logo.png' }),
      ).resolves.toContain('Envie uma imagem.');
    });
  });
});

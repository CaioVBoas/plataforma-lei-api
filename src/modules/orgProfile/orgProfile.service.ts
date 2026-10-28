import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { parseUserId } from '../../common/utils/parseUserId';
import { checkPasswordRules, SALT_ROUNDS } from '../../common/utils/password';
import { toStoredImage } from '../../common/validation/imageDataUrl';
import { PrismaService } from '../../database/prisma.service';
import {
  ChangePasswordDto,
  DeleteAccountDto,
} from '../auth/dto/accessAccount.dto';
import { OrgAccountDto } from './dto/orgAccount.dto';
import { OrgProfileDto } from './dto/orgProfile.dto';
import { UpdateOrgAccountDto } from './dto/updateOrgAccount.dto';
import { UpdateOrgImagesDto } from './dto/updateOrgImages.dto';
import { UpdateOrgProfileDto } from './dto/updateOrgProfile.dto';

// `select` explícito: campo novo no schema não aparece sozinho na resposta.
const ORG_SELECT = {
  id: true,
  name: true,
  type: true,
  location: true,
  about: true,
  audience: true,
  site: true,
  meetingCadence: true,
  onSiteVisit: true,
  logo: true,
  cover: true,
  focalName: true,
  focalRole: true,
  contactEmail: true,
  phone: true,
  channel: true,
  tutorialSeen: true,
  user: { select: { email: true } },
} satisfies Prisma.PartnerSelect;

type OrgRecord = Prisma.PartnerGetPayload<{ select: typeof ORG_SELECT }>;

/** Canal padrão do schema, usado quando o registro antigo veio sem nenhum. */
const DEFAULT_CHANNEL = 'E-mail';

@Injectable()
export class OrgProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccount(userId: string): Promise<OrgAccountDto> {
    return toAccountDto(await this.getPartner(userId));
  }

  async updateAccount(
    userId: string,
    dto: UpdateOrgAccountDto,
  ): Promise<OrgAccountDto> {
    const partner = await this.getPartner(userId);

    // A conta é o ponto focal: nome e cargo são as mesmas colunas do contato.
    const updated = await this.update(partner.id, {
      focalName: dto.name?.trim(),
      focalRole: dto.position?.trim(),
      phone: dto.phone?.trim(),
      tutorialSeen: dto.tutorialSeen,
    });

    return toAccountDto(updated);
  }

  async getProfile(userId: string): Promise<OrgProfileDto> {
    return toProfileDto(await this.getPartner(userId));
  }

  async updateProfile(
    userId: string,
    dto: UpdateOrgProfileDto,
  ): Promise<OrgProfileDto> {
    const partner = await this.getPartner(userId);
    const { contact } = dto;

    const updated = await this.update(partner.id, {
      type: dto.type,
      location: dto.location?.trim(),
      about: dto.about?.trim(),
      audience: dto.audience?.trim(),
      site: dto.site?.trim(),
      meetingCadence: dto.meetingCadence?.trim(),
      onSiteVisit: dto.onSiteVisit?.trim(),
      ...(contact && {
        focalName: contact.focalName.trim(),
        focalRole: contact.focalRole?.trim(),
        channel: contact.channel?.trim(),
        contactEmail: toStoredContactEmail(contact.email, partner.user?.email),
      }),
    });

    return toProfileDto(updated);
  }

  async updateImages(
    userId: string,
    dto: UpdateOrgImagesDto,
  ): Promise<OrgProfileDto> {
    const partner = await this.getPartner(userId);

    const updated = await this.update(partner.id, {
      logo: dto.logo === undefined ? undefined : toStoredImage(dto.logo),
      cover: dto.cover === undefined ? undefined : toStoredImage(dto.cover),
    });

    return toProfileDto(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const id = parseUserId(userId);
    await this.getPartner(userId);
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException('Perfil de organização não encontrado.');
    }

    const matches = await bcrypt.compare(dto.current, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('A senha atual não confere.');
    }

    checkPasswordRules(dto.next);
    if (dto.next !== dto.confirm) {
      throw new BadRequestException('As duas senhas novas não são iguais.');
    }
    if (dto.next === dto.current) {
      throw new BadRequestException(
        'A senha nova precisa ser diferente da atual.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.next, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const id = parseUserId(userId);
    const partner = await this.getPartner(userId);
    const email = partner.user?.email ?? '';

    if (dto.typedEmail.trim().toLowerCase() !== email.toLowerCase()) {
      throw new BadRequestException(
        'Digite o e-mail da conta exatamente como aparece acima.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.partner.update({
        where: { id: partner.id },
        data: {
          userId: null,
          contactEmail: partner.contactEmail ?? email,
        },
      });
      await tx.demandQuestion.updateMany({
        where: { authorId: id },
        data: { authorId: null },
      });
      await tx.user.delete({ where: { id } });
    });
  }

  private async getPartner(userId: string): Promise<OrgRecord> {
    const partner = await this.prisma.partner.findUnique({
      where: { userId: parseUserId(userId) },
      select: ORG_SELECT,
    });

    if (!partner) {
      throw new NotFoundException('Perfil de organização não encontrado.');
    }

    return partner;
  }

  private update(
    id: number,
    data: Prisma.PartnerUpdateInput,
  ): Promise<OrgRecord> {
    return this.prisma.partner.update({
      where: { id },
      data,
      select: ORG_SELECT,
    });
  }
}

/**
 * O e-mail do ponto focal só é gravado quando difere do e-mail de login:
 * assim, enquanto forem iguais, trocar o login também atualiza o contato.
 */
function toStoredContactEmail(
  email: string,
  loginEmail: string | undefined,
): string | null {
  const normalized = email.trim().toLowerCase();
  return normalized === loginEmail?.toLowerCase() ? null : normalized;
}

function toAccountDto(partner: OrgRecord): OrgAccountDto {
  return {
    organizationId: String(partner.id),
    name: partner.focalName ?? '',
    email: partner.user?.email ?? '',
    position: partner.focalRole ?? '',
    phone: partner.phone ?? '',
    tutorialSeen: partner.tutorialSeen,
  };
}

function toProfileDto(partner: OrgRecord): OrgProfileDto {
  const organization: OrgProfileDto['organization'] = {
    id: String(partner.id),
    name: partner.name,
    type: partner.type,
    location: partner.location ?? '',
    about: partner.about ?? '',
    audience: partner.audience ?? '',
    site: partner.site ?? '',
    meetingCadence: partner.meetingCadence ?? '',
    onSiteVisit: partner.onSiteVisit ?? '',
    history: [],
  };

  // Sem imagem, o front desenha o monograma: o campo some em vez de vir vazio.
  if (partner.logo) organization.logo = partner.logo;
  if (partner.cover) organization.cover = partner.cover;

  return {
    organization,
    contact: {
      focalName: partner.focalName ?? '',
      focalRole: partner.focalRole ?? '',
      email: partner.contactEmail ?? partner.user?.email ?? '',
      channel: partner.channel ?? DEFAULT_CHANNEL,
    },
  };
}

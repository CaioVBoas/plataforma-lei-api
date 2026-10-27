import { TipoParceiro } from '@prisma/client';

/**
 * Rótulo legível exibido pelo frontend. A saída é só de ida: o cadastro de
 * parceiro (auth) já trafega o valor do enum do banco sem tradução.
 */
const PARTNER_TYPE_LABELS: Record<TipoParceiro, string> = {
  [TipoParceiro.ORGAO_PUBLICO]: 'Órgão público',
  [TipoParceiro.UNIDADE_UFPE]: 'Unidade UFPE',
  [TipoParceiro.ORGANIZACAO_SOCIAL_ONG]: 'Organização social / ONG',
  [TipoParceiro.EMPRESA]: 'Empresa',
  [TipoParceiro.OUTRO]: 'Outro',
};

export function toPartnerTypeLabel(type: TipoParceiro): string {
  return PARTNER_TYPE_LABELS[type];
}

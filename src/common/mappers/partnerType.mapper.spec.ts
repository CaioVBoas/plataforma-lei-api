import { TipoParceiro } from '@prisma/client';
import { toPartnerTypeLabel } from './partnerType.mapper';

describe('partnerType.mapper', () => {
  it('devolve rótulo legível, não o valor do enum, para todo tipo', () => {
    for (const type of Object.values(TipoParceiro)) {
      const label = toPartnerTypeLabel(type);
      expect(label).toBeTruthy();
      expect(label).not.toBe(type);
    }
    expect(toPartnerTypeLabel(TipoParceiro.ORGAO_PUBLICO)).toBe(
      'Órgão público',
    );
  });
});

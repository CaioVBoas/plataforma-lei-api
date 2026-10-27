import { AdocaoResultado, EtapaProjeto } from '@prisma/client';

/** Valor de `:step` na URL; o banco guarda `EtapaProjeto`. */
export enum MilestoneStep {
  PLAN = 'plan',
  KICKOFF = 'kickoff',
  SIGAA = 'sigaa',
  MIDTERM = 'midterm',
  FINAL = 'final',
  CLOSING = 'closing',
}

/** Ordem em que as etapas devem ser concluídas. */
export const STEP_ORDER: MilestoneStep[] = [
  MilestoneStep.PLAN,
  MilestoneStep.KICKOFF,
  MilestoneStep.SIGAA,
  MilestoneStep.MIDTERM,
  MilestoneStep.FINAL,
  MilestoneStep.CLOSING,
];

const STEP_TO_ETAPA: Record<MilestoneStep, EtapaProjeto> = {
  [MilestoneStep.PLAN]: EtapaProjeto.PLANO,
  [MilestoneStep.KICKOFF]: EtapaProjeto.KICKOFF,
  [MilestoneStep.SIGAA]: EtapaProjeto.SIGAA,
  [MilestoneStep.MIDTERM]: EtapaProjeto.PARCIAL,
  [MilestoneStep.FINAL]: EtapaProjeto.FINAL,
  [MilestoneStep.CLOSING]: EtapaProjeto.ENCERRAMENTO,
};

const ETAPA_TO_STEP = Object.fromEntries(
  Object.entries(STEP_TO_ETAPA).map(([step, etapa]) => [etapa, step]),
) as Record<EtapaProjeto, MilestoneStep>;

export const toEtapa = (step: MilestoneStep): EtapaProjeto =>
  STEP_TO_ETAPA[step];

export const toStep = (etapa: EtapaProjeto): MilestoneStep =>
  ETAPA_TO_STEP[etapa];

/** Nível de adoção da solução no contrato externo. */
export enum Adoption {
  IN_USE = 'in_use',
  PARTIAL = 'partial',
  NOT_USED = 'not_used',
}

const ADOPTION_TO_RESULTADO: Record<Adoption, AdocaoResultado> = {
  [Adoption.IN_USE]: AdocaoResultado.EM_USO,
  [Adoption.PARTIAL]: AdocaoResultado.PARCIAL,
  [Adoption.NOT_USED]: AdocaoResultado.NAO_USADO,
};

const RESULTADO_TO_ADOPTION = Object.fromEntries(
  Object.entries(ADOPTION_TO_RESULTADO).map(([a, r]) => [r, a]),
) as Record<AdocaoResultado, Adoption>;

export const toAdocaoResultado = (adoption: Adoption): AdocaoResultado =>
  ADOPTION_TO_RESULTADO[adoption];

export const toAdoption = (resultado: AdocaoResultado): Adoption =>
  RESULTADO_TO_ADOPTION[resultado];

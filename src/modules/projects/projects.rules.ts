import { EtapaProjeto, NivelCurso } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

const LEVEL_RANK: Record<NivelCurso, number> = {
  [NivelCurso.INICIANTE]: 0,
  [NivelCurso.INTERMEDIARIO]: 1,
  [NivelCurso.AVANCADO]: 2,
};

/** A demanda cabe na turma quando o nível dela não passa do esperado para o curso. */
export function demandFitsCourseLevel(
  demandLevel: NivelCurso,
  courseLevel: NivelCurso,
): boolean {
  return LEVEL_RANK[demandLevel] <= LEVEL_RANK[courseLevel];
}

/** Máximo de equipes que a turma comporta com o tamanho de equipe definido. */
export function maxTeams(enrolledStudents: number, teamSize: number): number {
  return Math.max(1, Math.ceil(enrolledStudents / Math.max(1, teamSize)));
}

export interface CalendarDates {
  endsAt: Date;
  linkDeadline: Date;
  midtermAt: Date;
  finalAt: Date;
}

/**
 * Prazos das 6 etapas a partir do calendário semestral:
 * plano em 7 dias (limitado ao prazo de vínculo), kickoff no ponto médio até o
 * prazo de vínculo, SIGAA no prazo de vínculo, parcial/final nas datas do
 * calendário e encerramento no fim do semestre.
 */
export function computeMilestoneDates(
  now: Date,
  calendar: CalendarDates,
): Record<EtapaProjeto, Date> {
  const deadline = calendar.linkDeadline.getTime();
  const start = now.getTime();
  return {
    [EtapaProjeto.PLANO]: new Date(Math.min(start + 7 * DAY_MS, deadline)),
    [EtapaProjeto.KICKOFF]: new Date(start + (deadline - start) / 2),
    [EtapaProjeto.SIGAA]: calendar.linkDeadline,
    [EtapaProjeto.PARCIAL]: calendar.midtermAt,
    [EtapaProjeto.FINAL]: calendar.finalAt,
    [EtapaProjeto.ENCERRAMENTO]: calendar.endsAt,
  };
}

/** Seções do plano oficial do SIGAA, criadas vazias na adoção. */
export const PLAN_TEMPLATE: { title: string; limit: number }[] = [
  { title: 'Resumo', limit: 1000 },
  { title: 'Justificativa', limit: 2000 },
  { title: 'Objetivos', limit: 2000 },
  { title: 'Metodologia', limit: 3000 },
  { title: 'Resultados esperados', limit: 2000 },
  { title: 'Relação com o ensino e a pesquisa', limit: 2000 },
];

/** Carga horária base, ajustável depois pelo docente. */
export const WORKLOAD_TEMPLATE: {
  activity: string;
  hours: number;
  participants: string;
}[] = [
  {
    activity: 'Reuniões de alinhamento com a organização parceira',
    hours: 10,
    participants: 'Docente e estudantes',
  },
  {
    activity: 'Desenvolvimento da solução',
    hours: 40,
    participants: 'Estudantes',
  },
  {
    activity: 'Entrega, documentação e acompanhamento',
    hours: 10,
    participants: 'Docente e estudantes',
  },
];

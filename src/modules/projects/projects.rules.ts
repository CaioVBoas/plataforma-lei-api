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

/** Seções do plano oficial do SIGAA, preenchidas inicialmente a partir da demanda e da disciplina. */
export const PLAN_TEMPLATE: { title: string; limit: number }[] = [
  { title: 'Resumo', limit: 1000 },
  { title: 'Justificativa', limit: 2000 },
  { title: 'Objetivos', limit: 2000 },
  { title: 'Metodologia', limit: 3000 },
  { title: 'Resultados esperados', limit: 2000 },
  { title: 'Relação com o ensino e a pesquisa', limit: 2000 },
];

export interface PlanSourceDemand {
  title: string;
  problem?: string | null;
  description?: string | null;
  affectedAudience?: string | null;
  expectedOutcome?: string | null;
  meetingCadence?: string | null;
}

export interface PlanSourceCourse {
  name?: string | null;
  enrolledStudents?: number | null;
}

const truncate = (value: string, limit: number): string =>
  value.length <= limit ? value : value.slice(0, limit - 1).trimEnd() + '…';

/** Gera o rascunho inicial das 6 seções do plano SIGAA a partir dos dados da demanda e da turma. */
export function buildInitialPlanSections(
  demand: PlanSourceDemand,
  course: PlanSourceCourse,
  teams: number,
): { title: string; limit: number; text: string; order: number }[] {
  const courseName = course.name?.trim() || 'disciplina de extensão';
  const students = course.enrolledStudents ?? teams * 5;
  const problem = demand.problem?.trim() || demand.title;
  const description = demand.description?.trim() || problem;
  const audience =
    demand.affectedAudience?.trim() ||
    'Comunidade atendida pela organização parceira';
  const expectedOutcome =
    demand.expectedOutcome?.trim() ||
    `Entrega de solução funcional validada junto à organização parceira para "${demand.title}".`;
  const cadence =
    demand.meetingCadence?.trim() || 'reuniões periódicas de acompanhamento';

  const texts = [
    `Projeto de extensão desenvolvido na disciplina ${courseName} (${teams} ${teams === 1 ? 'equipe' : 'equipes'}) para atender à demanda "${demand.title}". ${description}`,
    `${problem} Público diretamente impactado: ${audience}.`,
    `Objetivo geral: desenvolver e validar uma solução para "${demand.title}".\n\nObjetivos específicos:\n1. Levantar e validar os requisitos junto ao ponto focal.\n2. Desenvolver e testar a solução em ciclos iterativos.\n3. Documentar e entregar o resultado para uso pela organização.`,
    `Trabalho organizado em ciclos quinzenais com ${cadence}, envolvendo ${students} estudantes distribuídos em ${teams} ${teams === 1 ? 'equipe' : 'equipes'}, com entregas parciais e validação contínua com a organização parceira.`,
    expectedOutcome,
    `Articula os conteúdos de ${courseName} com um problema público e social real, permitindo aos estudantes aplicar engenharia e desenvolvimento de software em contexto de extensão universitária. Beneficiários diretos: ${audience}.`,
  ];

  return PLAN_TEMPLATE.map((section, index) => ({
    ...section,
    text: truncate(texts[index] ?? '', section.limit),
    order: index + 1,
  }));
}

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

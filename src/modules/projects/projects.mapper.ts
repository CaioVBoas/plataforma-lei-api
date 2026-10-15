import { Prisma } from '@prisma/client';
import { toAdoption, toStep } from './projects.steps';

export const projectInclude = {
  course: true,
  demand: {
    select: { id: true, title: true, partnerId: true, level: true },
  },
  milestones: { orderBy: { id: 'asc' } },
  proposalSections: { orderBy: { order: 'asc' } },
  workloads: { orderBy: { id: 'asc' } },
} satisfies Prisma.ProjectInclude;

export type ProjectDetail = Prisma.ProjectGetPayload<{
  include: typeof projectInclude;
}>;

/** Visão do docente: traduz etapa e adoção para o contrato externo. */
export function toProjectResponse(project: ProjectDetail) {
  const { milestones, outcomeAdoption, ...rest } = project;
  return {
    ...rest,
    milestones: milestones.map(({ step, ...milestone }) => ({
      ...milestone,
      step: toStep(step),
    })),
    outcomeAdoption: outcomeAdoption ? toAdoption(outcomeAdoption) : null,
  };
}

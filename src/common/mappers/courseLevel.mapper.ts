import { NivelCurso } from '@prisma/client';

/**
 * O banco fala português (`NivelCurso`) e o contrato do frontend fala inglês.
 * Os dois mapas são totais: todo valor de um lado tem destino no outro.
 */
export const COURSE_LEVELS = ['intro', 'intermediate', 'advanced'] as const;

export type CourseLevel = (typeof COURSE_LEVELS)[number];

const NIVEL_TO_LEVEL: Record<NivelCurso, CourseLevel> = {
  [NivelCurso.INICIANTE]: 'intro',
  [NivelCurso.INTERMEDIARIO]: 'intermediate',
  [NivelCurso.AVANCADO]: 'advanced',
};

const LEVEL_TO_NIVEL: Record<CourseLevel, NivelCurso> = {
  intro: NivelCurso.INICIANTE,
  intermediate: NivelCurso.INTERMEDIARIO,
  advanced: NivelCurso.AVANCADO,
};

export function toCourseLevel(nivel: NivelCurso): CourseLevel {
  return NIVEL_TO_LEVEL[nivel];
}

export function toNivelCurso(level: CourseLevel): NivelCurso {
  return LEVEL_TO_NIVEL[level];
}

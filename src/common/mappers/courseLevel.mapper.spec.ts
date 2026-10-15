import { NivelCurso } from '@prisma/client';
import {
  COURSE_LEVELS,
  toCourseLevel,
  toNivelCurso,
} from './courseLevel.mapper';

describe('courseLevel.mapper', () => {
  it('traduz todo NivelCurso para o vocabulário do contrato', () => {
    expect(toCourseLevel(NivelCurso.INICIANTE)).toBe('intro');
    expect(toCourseLevel(NivelCurso.INTERMEDIARIO)).toBe('intermediate');
    expect(toCourseLevel(NivelCurso.AVANCADO)).toBe('advanced');
  });

  it('é inversível para todo nível do contrato', () => {
    for (const level of COURSE_LEVELS) {
      expect(toCourseLevel(toNivelCurso(level))).toBe(level);
    }
  });
});

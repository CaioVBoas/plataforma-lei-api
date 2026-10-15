import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDisciplineDto } from './createDiscipline.dto';

const valid = {
  name: ' Extensão ',
  code: 'IF1',
  level: 'intro',
  students: 30,
  teamSize: 5,
  projectSlots: 1,
  skills: [' React '],
};

const check = (body: Record<string, unknown>) =>
  validate(plainToInstance(CreateDisciplineDto, body));

describe('CreateDisciplineDto', () => {
  it('aceita corpo válido e apara os textos', async () => {
    const dto = plainToInstance(CreateDisciplineDto, valid);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('Extensão');
    expect(dto.skills).toEqual(['React']);
  });

  it.each([
    ['name', ''],
    ['name', '   '],
    ['level', 'basic'],
    ['students', 0],
    ['teamSize', 0],
    ['projectSlots', 0],
    ['skills', []],
    ['skills', ['  ']],
  ])('recusa %s = %j', async (field, value) => {
    expect(await check({ ...valid, [field]: value })).not.toHaveLength(0);
  });
});

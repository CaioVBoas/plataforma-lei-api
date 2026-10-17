import 'dotenv/config';
import { PrismaClient, PapelUsuario, NivelCurso, TipoParceiro, ViabilidadeEscopo, EtapaSubmissao } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

// Prisma 7 exige driver adapter, igual ao PrismaService da aplicação.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log('Iniciando seed do banco de dados...');

  // 1. Calendário Acadêmico Oficial (2026.2)
  const calendar = await prisma.academicCalendar.upsert({
    where: { semester: '2026.2' },
    update: {},
    create: {
      semester: '2026.2',
      startsAt: new Date('2026-08-03T00:00:00Z'),
      endsAt: new Date('2026-12-04T00:00:00Z'),
      linkDeadline: new Date('2026-09-12T00:00:00Z'),
      midtermAt: new Date('2026-10-09T00:00:00Z'),
      finalAt: new Date('2026-11-27T00:00:00Z'),
      isCurrent: true,
    },
  });
  console.log('Calendário acadêmico criado:', calendar.semester);

  // 2. Senha padrão criptografada
  const defaultPasswordHash = await bcrypt.hash('Senha123!', 10);

  // 3. Usuário Docente padrão (Paola Accioly)
  const teacherUser = await prisma.user.upsert({
    where: { email: 'paola.accioly@ufpe.br' },
    update: {},
    create: {
      email: 'paola.accioly@ufpe.br',
      passwordHash: defaultPasswordHash,
      role: PapelUsuario.DOCENTE,
      professor: {
        create: {
          name: 'Paola Accioly',
          department: 'Centro de Informática',
          phone: '(81) 99876-1234',
          tutorialSeen: false,
        },
      },
    },
    include: { professor: true },
  });
  console.log('Docente criado:', teacherUser.professor?.name);

  // 4. Usuário Parceiro padrão (Hospital das Clínicas)
  const partnerUser = await prisma.user.upsert({
    where: { email: 'renata.vasconcelos@exemplo.org.br' },
    update: {},
    create: {
      email: 'renata.vasconcelos@exemplo.org.br',
      passwordHash: defaultPasswordHash,
      role: PapelUsuario.PARCEIRO,
      partner: {
        create: {
          name: 'Hospital das Clínicas',
          type: TipoParceiro.ORGAO_PUBLICO,
          location: 'Cidade Universitária, Recife',
          about:
            'Hospital universitário federal ligado à UFPE e referência de alta complexidade em Pernambuco. A central de regulação recebe encaminhamentos de 42 municípios e distribui as vagas de consulta especializada.',
          audience: 'Pacientes do SUS encaminhados de todo o estado',
          site: 'hc.ufpe.br',
          meetingCadence: 'Reunião quinzenal de 1 hora, por vídeo',
          onSiteVisit: 'Recebe a turma no hospital, com agendamento de duas semanas',
          focalName: 'Renata Vasconcelos',
          focalRole: 'Coordenadora do núcleo de regulação',
          phone: '(81) 3878-1000',
          channel: 'E-mail institucional',
          tutorialSeen: false,
        },
      },
    },
    include: { partner: true },
  });
  console.log('Parceiro criado:', partnerUser.partner?.name);

  // 5. Competências Básicas
  const skillNames = [
    'React',
    'TypeScript',
    'Node.js',
    'Design de Software',
    'Engenharia de Requisitos',
    'Banco de Dados',
    'Testes de Software',
  ];

  for (const name of skillNames) {
    await prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('Competências cadastradas:', skillNames.length);

  // 6. Disciplina lecionada por Paola no semestre 2026.2
  if (teacherUser.professor) {
    const course = await prisma.course.upsert({
      where: {
        professorId_code_semester: {
          professorId: teacherUser.professor.id,
          code: 'IF682',
          semester: '2026.2',
        },
      },
      update: {},
      create: {
        professorId: teacherUser.professor.id,
        name: 'Desenvolvimento de Software',
        code: 'IF682',
        semester: '2026.2',
        enrolledStudents: 35,
        teamSize: 5,
        projectCapacity: 3,
        expectedLevel: NivelCurso.INTERMEDIARIO,
      },
    });
    console.log('Disciplina criada:', course.name);
  }

  // 7. Demanda no Cardápio pelo Hospital das Clínicas
  if (partnerUser.partner) {
    const demand = await prisma.demand.upsert({
      where: { id: 1 },
      update: {},
      create: {
        partnerId: partnerUser.partner.id,
        title: 'Triagem de encaminhamentos no ambulatório',
        problem:
          'Os encaminhamentos chegam em papel ou PDF não estruturado, atrasando a classificação de risco e o agendamento de consultas especializadas.',
        description:
          'A equipe da central de regulação do HC precisa de um painel web simples para registrar, classificar por prioridade e direcionar os encaminhamentos médicos para os ambulatórios correspondentes.',
        affectedAudience: 'Equipe de regulação ambulatorial e pacientes do SUS aguardando consultas.',
        expectedOutcome: 'Protótipo funcional de um painel de triagem e classificação de risco.',
        level: NivelCurso.INTERMEDIARIO,
        scopeFit: ViabilidadeEscopo.CABE_NO_SEMESTRE,
        meetingCadence: 'Quinzenal, quartas-feiras pela manhã',
        constraints: ['on-site', 'sensitive-data'],
        offers: ['Acesso ao processo de trabalho do ambulatório', 'Acompanhamento pela coordenação de regulação'],
        stage: EtapaSubmissao.PUBLICADA,
        publishedAt: new Date('2026-08-10T00:00:00Z'),
      },
    });
    console.log('Demanda criada:', demand.title);
  }

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

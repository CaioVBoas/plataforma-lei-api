-- CreateEnum
CREATE TYPE "NivelCurso" AS ENUM ('INICIANTE', 'INTERMEDIARIO', 'AVANCADO');

-- CreateEnum
CREATE TYPE "ViabilidadeEscopo" AS ENUM ('CABE_NO_SEMESTRE', 'APERTADO_EXIGE_RECORTE');

-- CreateEnum
CREATE TYPE "EtapaSubmissao" AS ENUM ('RASCUNHO', 'EM_TRIAGEM', 'AJUSTE_PEDIDO', 'PUBLICADA');

-- CreateEnum
CREATE TYPE "AdocaoResultado" AS ENUM ('EM_USO', 'PARCIAL', 'NAO_USADO');

-- CreateEnum
CREATE TYPE "EtapaProjeto" AS ENUM ('PLANO', 'KICKOFF', 'SIGAA', 'PARCIAL', 'FINAL', 'ENCERRAMENTO');

-- CreateTable
CREATE TABLE "academic_calendars" (
    "id" SERIAL NOT NULL,
    "semester" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "linkDeadline" TIMESTAMP(3) NOT NULL,
    "midtermAt" TIMESTAMP(3) NOT NULL,
    "finalAt" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academic_calendars_semester_key" ON "academic_calendars"("semester");

-- AlterTable professors
ALTER TABLE "professors" ADD COLUMN "department" TEXT NOT NULL DEFAULT 'Centro de Informática';
ALTER TABLE "professors" ADD COLUMN "phone" TEXT;
ALTER TABLE "professors" ADD COLUMN "photo" TEXT;
ALTER TABLE "professors" ADD COLUMN "tutorialSeen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable partners
ALTER TABLE "partners" ADD COLUMN "location" TEXT;
ALTER TABLE "partners" ADD COLUMN "about" TEXT;
ALTER TABLE "partners" ADD COLUMN "audience" TEXT;
ALTER TABLE "partners" ADD COLUMN "site" TEXT;
ALTER TABLE "partners" ADD COLUMN "meetingCadence" TEXT;
ALTER TABLE "partners" ADD COLUMN "onSiteVisit" TEXT;
ALTER TABLE "partners" ADD COLUMN "logo" TEXT;
ALTER TABLE "partners" ADD COLUMN "cover" TEXT;
ALTER TABLE "partners" ADD COLUMN "focalName" TEXT;
ALTER TABLE "partners" ADD COLUMN "focalRole" TEXT;
ALTER TABLE "partners" ADD COLUMN "phone" TEXT;
ALTER TABLE "partners" ADD COLUMN "channel" TEXT DEFAULT 'E-mail';

-- AlterTable courses
ALTER TABLE "courses" DROP COLUMN IF EXISTS "windowStart";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "windowEnd";
ALTER TABLE "courses" ADD COLUMN "teamSize" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "courses" ALTER COLUMN "expectedLevel" DROP DEFAULT;
ALTER TABLE "courses" ALTER COLUMN "expectedLevel" TYPE "NivelCurso" USING ("expectedLevel"::text::"NivelCurso");
ALTER TABLE "courses" ALTER COLUMN "expectedLevel" SET DEFAULT 'INTERMEDIARIO';
ALTER TABLE "courses" ADD CONSTRAINT "courses_semester_fkey" FOREIGN KEY ("semester") REFERENCES "academic_calendars"("semester") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable course_professors
CREATE TABLE "course_professors" (
    "courseId" INTEGER NOT NULL,
    "professorId" INTEGER NOT NULL,

    CONSTRAINT "course_professors_pkey" PRIMARY KEY ("courseId","professorId")
);
ALTER TABLE "course_professors" ADD CONSTRAINT "course_professors_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_professors" ADD CONSTRAINT "course_professors_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "professors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable course_skills
ALTER TABLE "course_skills" DROP COLUMN IF EXISTS "status";
ALTER TABLE "course_skills" DROP COLUMN IF EXISTS "source";
ALTER TABLE "course_skills" DROP COLUMN IF EXISTS "updatedAt";

-- AlterTable demands
ALTER TABLE "demands" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "demands" ADD COLUMN "expectedOutcome" TEXT;
ALTER TABLE "demands" ADD COLUMN "level" "NivelCurso" NOT NULL DEFAULT 'INTERMEDIARIO';
ALTER TABLE "demands" ADD COLUMN "scopeFit" "ViabilidadeEscopo" NOT NULL DEFAULT 'CABE_NO_SEMESTRE';
ALTER TABLE "demands" DROP COLUMN IF EXISTS "viability";
ALTER TABLE "demands" ADD COLUMN "scopeNote" TEXT;
ALTER TABLE "demands" ADD COLUMN "meetingCadence" TEXT;
ALTER TABLE "demands" ADD COLUMN "constraints" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "demands" ADD COLUMN "offers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "demands" ADD COLUMN "stage" "EtapaSubmissao" NOT NULL DEFAULT 'PUBLICADA';
ALTER TABLE "demands" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "demands" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "demands" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "demands" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "demands" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "demands" DROP COLUMN IF EXISTS "hasNoInterested";

-- CreateTable demand_watchers
CREATE TABLE "demand_watchers" (
    "demandId" INTEGER NOT NULL,
    "professorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_watchers_pkey" PRIMARY KEY ("demandId","professorId")
);
ALTER TABLE "demand_watchers" ADD CONSTRAINT "demand_watchers_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_watchers" ADD CONSTRAINT "demand_watchers_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "professors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable demand_invitations
CREATE TABLE "demand_invitations" (
    "id" SERIAL NOT NULL,
    "demandId" INTEGER NOT NULL,
    "professorId" INTEGER NOT NULL,
    "fromName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_invitations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "demand_invitations" ADD CONSTRAINT "demand_invitations_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_invitations" ADD CONSTRAINT "demand_invitations_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "professors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable conversation_messages
DROP TABLE IF EXISTS "conversation_messages";

-- CreateTable demand_questions
CREATE TABLE "demand_questions" (
    "id" SERIAL NOT NULL,
    "demandId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "authorId" INTEGER,
    "text" TEXT NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answerText" TEXT,
    "answeredBy" TEXT,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "demand_questions_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "demand_questions" ADD CONSTRAINT "demand_questions_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_questions" ADD CONSTRAINT "demand_questions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "professors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_questions" ADD CONSTRAINT "demand_questions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable projects
ALTER TABLE "projects" DROP COLUMN IF EXISTS "status";
ALTER TABLE "projects" ALTER COLUMN "agreedDeliverable" DROP NOT NULL;
ALTER TABLE "projects" ADD COLUMN "teams" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "projects" ADD COLUMN "sigaaCode" TEXT;
ALTER TABLE "projects" ADD COLUMN "outcomeSummary" TEXT;
ALTER TABLE "projects" ADD COLUMN "outcomeAdoption" "AdocaoResultado";

-- CreateTable project_milestones
CREATE TABLE "project_milestones" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "step" "EtapaProjeto" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_milestones_projectId_step_key" ON "project_milestones"("projectId", "step");
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable proposal_sections
ALTER TABLE "proposal_sections" ADD COLUMN "limit" INTEGER NOT NULL DEFAULT 2000;

-- AlterTable references
ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop obsoletes
DROP TABLE IF EXISTS "progress_records";
DROP TABLE IF EXISTS "team_students";
DROP TABLE IF EXISTS "teams";
DROP TABLE IF EXISTS "professor_skills";
DROP TABLE IF EXISTS "correction_histories";
DROP TYPE IF EXISTS "StatusPratica";
DROP TYPE IF EXISTS "StatusProjeto";
DROP TYPE IF EXISTS "TipoRegistro";
DROP TYPE IF EXISTS "Viabilidade";
DROP TYPE IF EXISTS "NivelEsperado";

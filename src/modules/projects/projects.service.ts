import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProjectDto } from './dto/createProject.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProjectDto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        demandId: createProjectDto.demandId,
        courseId: createProjectDto.courseId,
        title: createProjectDto.title,
        teams: createProjectDto.teams ?? 1,
        agreedDeliverable: createProjectDto.agreedDeliverable,
      },
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      include: {
        demand: true,
        course: true,
        milestones: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        demand: true,
        course: true,
        milestones: true,
        proposalSections: true,
        workloads: true,
      },
    });
    if (!project) {
      throw new NotFoundException(`Projeto não encontrado.`);
    }
    return project;
  }
}

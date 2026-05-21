import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string, query: any) {
    const { branchId, trainerId } = query;
    const where: any = { gymId };
    if (branchId) where.branchId = branchId;
    if (trainerId) where.trainerId = trainerId;

    return this.prisma.class.findMany({
      where,
      include: {
        trainer: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, gymId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id, gymId },
      include: {
        trainer: true,
        branch: true,
        _count: { select: { enrollments: true } },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }

  async create(gymId: string, data: any) {
    return this.prisma.class.create({ data: { ...data, gymId } });
  }

  async update(id: string, gymId: string, data: any) {
    await this.assertExists(id, gymId);
    return this.prisma.class.update({ where: { id }, data });
  }

  async remove(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.prisma.class.delete({ where: { id } });
  }

  async enroll(classId: string, gymId: string, memberId: string) {
    const cls = await this.assertExists(classId, gymId);
    const count = await this.prisma.classEnrollment.count({ where: { classId } });
    if (count >= cls.maxCapacity) throw new ConflictException('Class is full');

    const existing = await this.prisma.classEnrollment.findUnique({
      where: { memberId_classId: { memberId, classId } },
    });
    if (existing) throw new ConflictException('Member already enrolled');

    return this.prisma.classEnrollment.create({
      data: { gymId, memberId, classId },
    });
  }

  async getAttendance(classId: string, gymId: string) {
    await this.assertExists(classId, gymId);
    return this.prisma.classEnrollment.findMany({
      where: { classId, gymId },
      include: { member: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  private async assertExists(id: string, gymId: string) {
    const cls = await this.prisma.class.findFirst({ where: { id, gymId } });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }
}

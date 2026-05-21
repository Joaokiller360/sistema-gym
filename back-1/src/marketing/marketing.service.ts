import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllTemplates(gymId: string) {
    return this.prisma.emailTemplate.findMany({
      where: { gymId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(gymId: string, data: any) {
    return this.prisma.emailTemplate.create({ data: { ...data, gymId } });
  }

  async updateTemplate(id: string, gymId: string, data: any) {
    await this.assertTemplateExists(id, gymId);
    return this.prisma.emailTemplate.update({ where: { id }, data });
  }

  async removeTemplate(id: string, gymId: string) {
    await this.assertTemplateExists(id, gymId);
    return this.prisma.emailTemplate.delete({ where: { id } });
  }

  async findAllCampaigns(gymId: string, query: any) {
    const where: any = { gymId };
    if (query.status) where.status = query.status;

    return this.prisma.emailCampaign.findMany({
      where,
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(gymId: string, data: any) {
    return this.prisma.emailCampaign.create({ data: { ...data, gymId } });
  }

  async scheduleCampaign(gymId: string, data: any) {
    const { campaignId, scheduledAt } = data;
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id: campaignId, gymId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    return this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'SCHEDULED', scheduledAt: new Date(scheduledAt) },
    });
  }

  async getCampaignMetrics(id: string, gymId: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id, gymId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      metrics: campaign.metrics,
    };
  }

  private async assertTemplateExists(id: string, gymId: string) {
    const t = await this.prisma.emailTemplate.findFirst({ where: { id, gymId } });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }
}

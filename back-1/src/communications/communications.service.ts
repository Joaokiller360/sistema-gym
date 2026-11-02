import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { startOfDayUTC } from '../common/utils/timezone.util';
import { getGymPlan } from '../common/utils/subscription-plan.util';
import { WhatsappService } from '../notifications/whatsapp.service';
import { TEMPLATES, templateParam } from '../notifications/whatsapp-templates';
import { mapLimit, memberWhatsapp } from '../notifications/member-phone.util';
import {
  AnnouncementType,
  CreateCommunicationDto,
} from './dto/communication.dto';

/** Parallel Zernio requests per announcement */
const CONCURRENCY = 5;

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  // ── Inbox: super-admin → gym owner ─────────────────────────
  async findAll(gymId: string, _query: any) {
    const records = await this.prisma.adminCommunication.findMany({
      where: { recipientIds: { has: gymId } },
      orderBy: { sentAt: 'desc' },
      select: {
        id: true,
        subject: true,
        body: true,
        sentAt: true,
        sentBy: { select: { name: true, email: true } },
      },
    });

    return records.map((r) => ({
      id: r.id,
      subject: r.subject,
      body: r.body,
      sentAt: r.sentAt,
      sentBy: r.sentBy
        ? { name: r.sentBy.name || r.sentBy.email, email: r.sentBy.email }
        : null,
    }));
  }

  // ── Announcements: gym → members (WhatsApp via Zernio) ─────
  private monthWindow(timezone: string, now = new Date()) {
    const local = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
    const [y, m] = local.split('-').map(Number);
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = startOfDayUTC(`${y}-${pad(m)}-01`, timezone);
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const resetsAt = startOfDayUTC(`${nextY}-${pad(nextM)}-01`, timezone);
    return { start, resetsAt };
  }

  /** Active members of the gym with a phone WhatsApp can reach, deduplicated by number. */
  private async reachableMembers(
    gymId: string,
    country: string | null,
    ids?: string[],
  ) {
    const members = await this.prisma.member.findMany({
      where: {
        gymId,
        isActive: true,
        phone: { not: null },
        ...(ids?.length && { id: { in: ids } }),
      },
      select: { id: true, firstName: true, phone: true },
    });
    const seen = new Set<string>();
    const out: { id: string; firstName: string; to: string }[] = [];
    for (const m of members) {
      const to = memberWhatsapp(m.phone, country);
      if (!to || seen.has(to)) continue;
      seen.add(to);
      out.push({ id: m.id, firstName: m.firstName, to });
    }
    return out;
  }

  async getAnnouncementQuota(gymId: string) {
    const { gym, plan } = await getGymPlan(this.prisma, gymId);
    if (!gym) throw new NotFoundException('Gym no encontrado');
    const { start, resetsAt } = this.monthWindow(gym.timezone ?? 'UTC');
    const [used, reachable, activeMembers] = await Promise.all([
      this.prisma.communication.count({
        where: { gymId, sentAt: { gte: start } },
      }),
      this.reachableMembers(gymId, gym.country),
      this.prisma.member.count({ where: { gymId, isActive: true } }),
    ]);
    // No plan row → treat as disabled (safe default)
    const limit = plan ? plan.monthlyAnnouncementLimit : 0;
    const remaining = limit === null ? null : Math.max(0, limit - used);
    return {
      limit,
      used,
      remaining,
      resetsAt,
      enabled: limit === null || limit > 0,
      whatsappReady: this.whatsapp.enabled,
      activeRecipients: reachable.length,
      membersWithoutPhone: activeMembers - reachable.length,
      birthdayMessagesEnabled: plan?.birthdayMessagesEnabled ?? true,
      expiryRemindersEnabled: plan?.expiryRemindersEnabled ?? true,
    };
  }

  async listAnnouncements(gymId: string) {
    const rows = await this.prisma.communication.findMany({
      where: { gymId },
      orderBy: { sentAt: 'desc' },
      take: 100,
      select: {
        id: true,
        subject: true,
        body: true,
        type: true,
        sentAt: true,
        sentCount: true,
        failedCount: true,
        recipientIds: true,
      },
    });
    return rows.map(({ recipientIds, ...r }) => ({
      ...r,
      recipientCount: recipientIds.length,
    }));
  }

  async sendAnnouncement(
    gymId: string,
    userId: string | undefined,
    dto: CreateCommunicationDto,
  ) {
    const { gym, plan } = await getGymPlan(this.prisma, gymId);
    if (!gym) throw new NotFoundException('Gym no encontrado');
    const limit = plan ? plan.monthlyAnnouncementLimit : 0;
    if (limit === 0) {
      throw new ForbiddenException(
        'Tu plan no incluye avisos a miembros. Mejora tu plan para usarlos.',
      );
    }
    if (!this.whatsapp.enabled) {
      throw new ServiceUnavailableException(
        'WhatsApp no está configurado en el servidor',
      );
    }

    const members = await this.reachableMembers(
      gymId,
      gym.country,
      dto.recipientIds,
    );
    if (!members.length) {
      throw new BadRequestException(
        'Ningún miembro activo tiene un número de WhatsApp válido',
      );
    }

    const { start } = this.monthWindow(gym.timezone ?? 'UTC');
    const type: AnnouncementType = dto.type ?? 'GENERAL';

    // Serialize per gym so two concurrent sends can't both pass the quota check
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${gymId}))`;
      if (limit !== null) {
        const used = await tx.communication.count({
          where: { gymId, sentAt: { gte: start } },
        });
        if (used >= limit) {
          throw new ForbiddenException(
            `Límite mensual de avisos alcanzado (${used}/${limit}). Se reinicia el próximo mes.`,
          );
        }
      }
      return tx.communication.create({
        data: {
          gymId,
          subject: dto.subject,
          body: dto.body,
          type,
          recipientIds: members.map((m) => m.id),
          sentById: userId ?? null,
          sentAt: new Date(),
        },
      });
    });

    void this.deliver(record.id, gym.name, dto.subject, dto.body, members);

    return { id: record.id, recipientCount: members.length, status: 'SENDING' };
  }

  private async deliver(
    communicationId: string,
    gymName: string,
    subject: string,
    body: string,
    members: { firstName: string; to: string }[],
  ) {
    const title = templateParam(subject, 60);
    const text = templateParam(body, 700);
    let sent = 0;
    let failed = 0;

    await mapLimit(members, CONCURRENCY, async (m) => {
      const res = await this.whatsapp.sendMemberTemplate(
        m.to,
        TEMPLATES.memberAnnouncement,
        [
          templateParam(m.firstName, 40),
          templateParam(gymName, 60),
          title,
          text,
        ],
      );
      if (res.ok) sent++;
      else {
        failed++;
        this.logger.warn(`[Announcement] ${m.to} failed: ${res.error}`);
      }
    });

    await this.prisma.communication
      .update({
        where: { id: communicationId },
        data: { sentCount: sent, failedCount: failed },
      })
      .catch((err) =>
        this.logger.error('[Announcement] Could not save counts:', err),
      );
    this.logger.log(
      `[Announcement] ${communicationId}: sent=${sent} failed=${failed}`,
    );
  }
}

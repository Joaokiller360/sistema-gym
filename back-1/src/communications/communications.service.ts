import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getGymPlan } from '../common/utils/subscription-plan.util';
import {
  WhatsappService,
  normalizePhone,
} from '../notifications/whatsapp.service';
import { MessageQuotaService } from '../notifications/message-quota.service';
import { TEMPLATES, templateParam } from '../notifications/whatsapp-templates';
import { mapLimit, memberWhatsapp } from '../notifications/member-phone.util';
import {
  AnnouncementType,
  CreateCommunicationDto,
  TestAnnouncementDto,
} from './dto/communication.dto';

/** Members whose last membership ended longer ago than this don't get announcements */
const RECENT_MEMBERSHIP_DAYS = 30;

/** Parallel Zernio requests per announcement */
const CONCURRENCY = 5;

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly quota: MessageQuotaService,
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
  /**
   * Members an announcement may go to: active, with a membership that is current or ended
   * at most RECENT_MEMBERSHIP_DAYS ago (so numbers typed into bare member records can't be
   * used to message strangers), and a phone WhatsApp can reach. Deduplicated by number.
   */
  private async reachableMembers(
    gymId: string,
    country: string | null,
    ids?: string[],
  ) {
    const since = new Date(Date.now() - RECENT_MEMBERSHIP_DAYS * 86_400_000);
    const members = await this.prisma.member.findMany({
      where: {
        gymId,
        isActive: true,
        phone: { not: null },
        memberships: {
          some: {
            gymId,
            status: { not: 'CANCELLED' },
            endDate: { gte: since },
          },
        },
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
    const [balance, reachable, activeMembers] = await Promise.all([
      this.quota.balance(gymId),
      this.reachableMembers(gymId, gym.country),
      this.prisma.member.count({ where: { gymId, isActive: true } }),
    ]);
    const b = balance!;
    return {
      /** Plan's monthly messages (null = unlimited, 0 = none) */
      limit: b.planLimit,
      /** Added every month by active monthly packs */
      monthlyExtra: b.monthlyExtra,
      /** One-time pack messages left (never expire) */
      credits: b.credits,
      used: b.used,
      /** Everything the gym can still send this month; null = unlimited */
      remaining: b.remaining,
      resetsAt: b.resetsAt,
      enabled:
        b.remaining === null ||
        b.remaining > 0 ||
        b.planLimit !== 0 ||
        b.packsEnabled,
      packsEnabled: b.packsEnabled,
      whatsappReady: this.whatsapp.enabled,
      ownerPhoneSet: !!gym.whatsappPhone,
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
        recipientCount: true,
      },
    });
    return rows;
  }

  async sendAnnouncement(
    gymId: string,
    userId: string | undefined,
    dto: CreateCommunicationDto,
  ) {
    const { gym, plan } = await getGymPlan(this.prisma, gymId);
    if (!gym) throw new NotFoundException('Gym no encontrado');
    if (
      !plan ||
      (plan.monthlyMessageLimit === 0 && !plan.messagePacksEnabled)
    ) {
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
        'Ningún miembro con membresía vigente tiene un número de WhatsApp válido',
      );
    }

    const type: AnnouncementType = dto.type ?? 'GENERAL';

    // The quota check and the announcement are saved together, serialized per gym
    const done = await this.quota.consume(
      gymId,
      members.length,
      'ANNOUNCEMENT',
      (tx) =>
        tx.communication.create({
          data: {
            gymId,
            subject: dto.subject,
            body: dto.body,
            type,
            recipientIds: members.map((m) => m.id),
            recipientCount: members.length,
            sentById: userId ?? null,
            sentAt: new Date(),
          },
        }),
    );
    if (!done) {
      const b = await this.quota.balance(gymId);
      const left = b?.remaining ?? 0;
      throw new ForbiddenException(
        left === 0
          ? 'No te quedan mensajes este mes. Compra un pack o espera al próximo mes.'
          : `Este aviso necesita ${members.length} mensajes y te quedan ${left}. Compra un pack para enviarlo.`,
      );
    }
    const record = done.result!;

    void this.deliver(record.id, gym.name, dto.subject, dto.body, members);

    return { id: record.id, recipientCount: members.length, status: 'SENDING' };
  }

  /** Sends the announcement to the gym's own WhatsApp (1 message from the balance) */
  async sendTest(gymId: string, dto: TestAnnouncementDto) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        name: true,
        whatsappPhone: true,
        owner: { select: { name: true } },
      },
    });
    if (!gym) throw new NotFoundException('Gym no encontrado');
    if (!this.whatsapp.enabled) {
      throw new ServiceUnavailableException(
        'WhatsApp no está configurado en el servidor',
      );
    }
    const to = normalizePhone(gym.whatsappPhone);
    if (!to) {
      throw new BadRequestException(
        'Tu gimnasio no tiene un WhatsApp con código de país cargado. Pídele a soporte que lo agregue.',
      );
    }
    const done = await this.quota.consume(gymId, 1, 'TEST');
    if (!done) {
      throw new ForbiddenException(
        'No te quedan mensajes este mes para enviar la prueba.',
      );
    }
    const res = await this.whatsapp.sendMemberTemplate(
      to,
      TEMPLATES.memberAnnouncement,
      [
        templateParam(gym.owner?.name?.split(' ')[0] || 'equipo', 40),
        templateParam(gym.name, 60),
        templateParam(dto.subject, 60),
        templateParam(dto.body, 700),
      ],
    );
    if (!res.ok) {
      this.logger.warn(`[AnnouncementTest] ${gymId} failed: ${res.error}`);
      throw new ServiceUnavailableException(
        'No se pudo enviar la prueba. Intenta de nuevo en unos minutos.',
      );
    }
    return {
      ok: true,
      to: `+${to.slice(0, -4).replace(/\d/g, '•')}${to.slice(-4)}`,
      remaining: done.remaining,
    };
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

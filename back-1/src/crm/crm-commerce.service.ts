import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../notifications/whatsapp.service';
import { SendCatalogDto, SetCommerceDto } from './dto/crm.dto';

/** Meta's customer service window, same rule as the rest of the CRM */
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Selling from the WhatsApp Business catalog. Products and photos live in Meta
 * (Commerce Manager / WhatsApp Manager › Catálogo); the CRM only sends them.
 */
@Injectable()
export class CrmCommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  async get() {
    const s = await this.prisma.platformSettings.findFirst({
      select: { waCatalogId: true },
    });
    // Profile/cart flags live in Meta; still show the catalog id if Zernio fails
    const flags = await this.whatsapp
      .getCommerceSettings()
      .then((f) => ({ ...f, error: null as string | null }))
      .catch((e: Error) => ({
        isCatalogVisible: false,
        isCartEnabled: false,
        error: e.message,
      }));
    return { catalogId: s?.waCatalogId ?? null, ...flags };
  }

  async set(dto: SetCommerceDto) {
    if (dto.catalogId !== undefined) {
      const waCatalogId = dto.catalogId || null;
      await this.prisma.platformSettings.upsert({
        where: { id: '1' },
        create: { id: '1', waCatalogId },
        update: { waCatalogId },
      });
    }
    if (dto.isCatalogVisible !== undefined || dto.isCartEnabled !== undefined) {
      await this.whatsapp.setCommerceSettings({
        isCatalogVisible: dto.isCatalogVisible,
        isCartEnabled: dto.isCartEnabled,
      });
    }
    return this.get();
  }

  /** Native WhatsApp commerce message; goes out right away (no undo queue). */
  async send(conversationId: string, dto: SendCatalogDto, adminId: string) {
    const conv = await this.prisma.waConversation.findUnique({
      where: { id: conversationId },
      select: { phone: true, lastInboundAt: true },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    if (
      !conv.lastInboundAt ||
      Date.now() - conv.lastInboundAt.getTime() >= WINDOW_MS
    ) {
      throw new ConflictException(
        'Pasaron más de 24 h desde su último mensaje: WhatsApp solo permite escribirle con una plantilla.',
      );
    }
    const quoted = dto.replyToId
      ? await this.prisma.waMessage.findFirst({
          where: { id: dto.replyToId, conversationId },
          select: { waMessageId: true },
        })
      : null;
    if (dto.replyToId && !quoted) {
      throw new BadRequestException('El mensaje citado no está en este chat');
    }

    const skus = [...new Set(dto.skus ?? [])];
    const body = dto.body.trim();
    let interactive: Record<string, unknown>;
    let log: string;
    if (dto.kind === 'catalog') {
      interactive = {
        type: 'catalog_message',
        body: { text: body },
        action: {
          name: 'catalog_message',
          // First code, if given, picks the thumbnail; else Meta uses the first item
          ...(skus[0] && {
            parameters: { thumbnail_product_retailer_id: skus[0] },
          }),
        },
      };
      log = `🛍 Catálogo de WhatsApp\n\n${body}`;
    } else {
      const s = await this.prisma.platformSettings.findFirst({
        select: { waCatalogId: true },
      });
      const catalogId = s?.waCatalogId;
      if (!catalogId) {
        throw new BadRequestException(
          'Cargá primero el ID del catálogo de WhatsApp (Catálogo › Ajustes)',
        );
      }
      if (!skus.length) {
        throw new BadRequestException('Poné el código de al menos un producto');
      }
      if (skus.length === 1) {
        interactive = {
          type: 'product',
          body: { text: body },
          action: { catalog_id: catalogId, product_retailer_id: skus[0] },
        };
      } else {
        const header = dto.header?.trim();
        if (!header) {
          throw new BadRequestException(
            'Para varios productos WhatsApp pide un título',
          );
        }
        interactive = {
          type: 'product_list',
          header: { type: 'text', text: header },
          body: { text: body },
          action: {
            catalog_id: catalogId,
            sections: [
              {
                title: header.slice(0, 24),
                product_items: skus.map((id) => ({ product_retailer_id: id })),
              },
            ],
          },
        };
      }
      log = `🛍 ${skus.length === 1 ? 'Producto' : `${skus.length} productos`}: ${skus.join(', ')}\n\n${body}`;
    }

    const msg = await this.prisma.waMessage.create({
      data: {
        conversationId,
        direction: 'OUT',
        type: 'catalog',
        body: log,
        sentById: adminId,
        status: 'sending',
        replyToId: quoted ? dto.replyToId : undefined,
      },
      select: { id: true },
    });
    await this.prisma.waConversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0, lastMessageAt: new Date() },
    });
    const res = await this.whatsapp.sendInteractive(
      conv.phone,
      { interactive, body: log, replyTo: quoted?.waMessageId ?? undefined },
      adminId,
      msg.id,
    );
    if (!res.ok) {
      throw new BadRequestException(
        res.error ?? 'WhatsApp no aceptó el mensaje',
      );
    }
    return { ok: true, id: msg.id };
  }
}

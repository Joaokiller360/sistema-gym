import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { WhatsappService } from '../notifications/whatsapp.service';
import { ProductDto } from './dto/crm.dto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fileType = require('file-type') as {
  fromBuffer(buf: Buffer): Promise<{ ext: string; mime: string } | undefined>;
};

/** Meta's customer service window, same rule as the rest of the CRM */
const WINDOW_MS = 24 * 60 * 60 * 1000;
/** WhatsApp only takes these as photos */
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png']);

const SELECT = {
  id: true,
  name: true,
  description: true,
  price: true,
  currency: true,
  imageUrl: true,
  active: true,
} as const;

/** WhatsApp text for a product: bold name, description, price */
function caption(p: {
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
}) {
  const price =
    p.price === null
      ? 'Precio: a consultar'
      : `Precio: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: p.currency }).format(p.price / 100)}`;
  return [`*${p.name}*`, p.description, price].filter(Boolean).join('\n\n');
}

/** Catalog of what the team sells to gym owners, and sending an item into a chat. */
@Injectable()
export class CrmCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly storage: StorageService,
  ) {}

  list() {
    return this.prisma.crmProduct.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: SELECT,
    });
  }

  async create(dto: ProductDto) {
    const last = await this.prisma.crmProduct.aggregate({
      _max: { position: true },
    });
    return this.prisma.crmProduct.create({
      data: {
        name: dto.name,
        description: dto.description?.trim() || null,
        price: dto.price == null ? null : Math.round(dto.price * 100),
        currency: dto.currency ?? 'USD',
        active: dto.active ?? true,
        position: (last._max.position ?? -1) + 1,
      },
      select: SELECT,
    });
  }

  async update(id: string, dto: Partial<ProductDto>) {
    await this.assertExists(id);
    return this.prisma.crmProduct.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && {
          description: dto.description.trim() || null,
        }),
        ...(dto.price !== undefined && {
          price: dto.price === null ? null : Math.round(dto.price * 100),
        }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      select: SELECT,
    });
  }

  async remove(id: string) {
    const p = await this.assertExists(id);
    await this.prisma.crmProduct.delete({ where: { id } });
    // Chats keep their own copy of the photo (see send)
    await this.storage.remove(p.imageUrl);
    return { ok: true };
  }

  async setPhoto(id: string, file: Express.Multer.File) {
    const p = await this.assertExists(id);
    const detected = await fileType.fromBuffer(file.buffer.subarray(0, 4100));
    if (!detected || !PHOTO_TYPES.has(detected.mime)) {
      throw new BadRequestException('La foto tiene que ser JPG o PNG');
    }
    const imageUrl = await this.storage.putImage(
      'catalog',
      file.buffer,
      `${id}-`,
    );
    await this.prisma.crmProduct.update({ where: { id }, data: { imageUrl } });
    await this.storage.remove(p.imageUrl);
    return { imageUrl };
  }

  async removePhoto(id: string) {
    const p = await this.assertExists(id);
    await this.prisma.crmProduct.update({
      where: { id },
      data: { imageUrl: null },
    });
    await this.storage.remove(p.imageUrl);
    return { ok: true };
  }

  /** Photo with the description as caption (text only without a photo). Goes out right away. */
  async send(
    conversationId: string,
    productId: string,
    adminId: string,
    replyToId?: string,
  ) {
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
    const product = await this.prisma.crmProduct.findUnique({
      where: { id: productId },
    });
    if (!product?.active) throw new NotFoundException('Producto no disponible');
    const quoted = replyToId
      ? await this.prisma.waMessage.findFirst({
          where: { id: replyToId, conversationId },
          select: { waMessageId: true },
        })
      : null;
    if (replyToId && !quoted) {
      throw new BadRequestException('El mensaje citado no está en este chat');
    }

    const body = caption(product);
    const photo = await this.storage.read(product.imageUrl);
    let media: { publicUrl: string; mediaUrl: string } | null = null;
    if (photo && PHOTO_TYPES.has(photo.type)) {
      const ext = photo.type === 'image/png' ? 'png' : 'jpg';
      media = {
        publicUrl: await this.whatsapp.uploadMedia({
          buffer: photo.body,
          mimetype: photo.type,
          originalname: `${randomUUID()}.${ext}`,
        }),
        // The chat keeps its own copy: editing or deleting the product doesn't touch it
        mediaUrl: await this.storage.put(
          `wa-media/${randomUUID()}.${ext}`,
          photo.body,
          photo.type,
        ),
      };
    }

    const msg = await this.prisma.waMessage.create({
      data: {
        conversationId,
        direction: 'OUT',
        type: media ? 'image' : 'text',
        body,
        mediaUrl: media?.mediaUrl,
        sentById: adminId,
        status: 'sending',
        replyToId: quoted ? replyToId : undefined,
      },
      select: { id: true },
    });
    await this.prisma.waConversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0, lastMessageAt: new Date() },
    });
    const replyTo = quoted?.waMessageId ?? undefined;
    const res = media
      ? await this.whatsapp.sendMedia(
          conv.phone,
          { type: 'image', url: media.publicUrl, caption: body, replyTo },
          adminId,
          msg.id,
        )
      : await this.whatsapp.sendText(
          conv.phone,
          body,
          adminId,
          msg.id,
          replyTo,
        );
    if (!res.ok)
      throw new BadRequestException(res.error ?? 'No se pudo enviar');
    return { ok: true, id: msg.id };
  }

  private async assertExists(id: string) {
    const p = await this.prisma.crmProduct.findUnique({
      where: { id },
      select: { imageUrl: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }
}

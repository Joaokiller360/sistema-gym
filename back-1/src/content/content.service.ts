import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Resend } from 'resend';
import { CreateNewsDto } from './dto/create-news.dto';
import { CreateTutorialDto } from './dto/create-tutorial.dto';

@Injectable()
export class ContentService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  constructor(private readonly prisma: PrismaService) {}

  // ── News ────────────────────────────────────────────────────

  async findAllNews() {
    return this.prisma.newsPost.findMany({ orderBy: { publishedAt: 'desc' } });
  }

  async createNews(dto: CreateNewsDto) {
    const post = await this.prisma.newsPost.create({ data: dto });
    await this.notifyGymOwners('news', post.title, post.body, post.imageUrl ?? undefined);
    return post;
  }

  async removeNews(id: string) {
    const existing = await this.prisma.newsPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Novedad no encontrada');
    return this.prisma.newsPost.delete({ where: { id } });
  }

  // ── Tutorials ───────────────────────────────────────────────

  async findAllTutorials() {
    return this.prisma.tutorial.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createTutorial(dto: CreateTutorialDto) {
    const tutorial = await this.prisma.tutorial.create({ data: dto });
    await this.notifyGymOwners('tutorial', tutorial.title, tutorial.description ?? '', undefined, tutorial.videoUrl);
    return tutorial;
  }

  async removeTutorial(id: string) {
    const existing = await this.prisma.tutorial.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tutorial no encontrado');
    return this.prisma.tutorial.delete({ where: { id } });
  }

  // ── Internal ────────────────────────────────────────────────

  private async notifyGymOwners(
    type: 'news' | 'tutorial',
    title: string,
    body: string,
    imageUrl?: string,
    videoUrl?: string,
  ) {
    const owners = await this.prisma.user.findMany({
      where: { role: 'GYM_OWNER', isActive: true },
      select: { email: true, name: true },
    });

    if (!owners.length) return;

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const isNews = type === 'news';
    const subject = isNews
      ? `Nueva novedad publicada: ${title}`
      : `Nuevo tutorial disponible: ${title}`;

    const imageHtml = imageUrl
      ? `<img src="${imageUrl}" alt="${title}" style="width:100%;border-radius:8px;margin-bottom:16px;" />`
      : '';

    const videoHtml = videoUrl
      ? `<a href="${videoUrl}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Ver video</a>`
      : '';

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:12px 12px 0 0;padding:32px;text-align:center;">
            <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;letter-spacing:1px;text-transform:uppercase;">${isNews ? 'Nueva Novedad' : 'Nuevo Tutorial'}</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">${title}</h1>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;border-radius:0 0 12px 12px;padding:32px;">
            ${imageHtml}
            <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">${body}</p>
            ${videoHtml}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
            <a href="${frontendUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Ir al panel</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Sistema Gym — Notificación automática</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await Promise.allSettled(
      owners.map((owner) =>
        this.resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@tudominio.com',
          to: owner.email,
          subject,
          html,
        }),
      ),
    );
  }
}

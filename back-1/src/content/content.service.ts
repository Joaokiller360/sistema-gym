import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Resend } from 'resend';
import { CreateNewsDto } from './dto/create-news.dto';
import { CreateTutorialDto } from './dto/create-tutorial.dto';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

@Injectable()
export class ContentService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  constructor(private readonly prisma: PrismaService) { }

  // ── News ────────────────────────────────────────────────────

  async findAllNews() {
    const posts = await this.prisma.newsPost.findMany({ orderBy: { publishedAt: 'desc' } });
    return posts.map(({ body, ...rest }) => ({ ...rest, content: body }));
  }

  async createNews(dto: CreateNewsDto) {
    const post = await this.prisma.newsPost.create({
      data: { title: dto.title, body: dto.content, imageUrl: dto.imageUrl },
    });
    await this.notifyGymOwners('news', post.title, post.body, post.imageUrl ?? undefined);
    const { body, ...rest } = post;
    return { ...rest, content: body };
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

  private buildEmailHtml(
    type: 'news' | 'tutorial',
    title: string,
    body: string,
    ownerFirstName: string,
    frontendUrl: string,
    imageUrl?: string,
    videoUrl?: string,
  ): string {
    const isNews = type === 'news';
    const icon = isNews ? '📰' : '🎬';
    const badgeLabel = isNews ? 'Nueva Novedad' : 'Nuevo Tutorial';
    const accentLight = isNews ? '#e8f0fe' : '#ede9fe';
    const accentText = isNews ? '#1e40af' : '#4338ca';

    const safeTitle = escapeHtml(title);
    const safeBody = escapeHtml(body);
    const safeOwner = escapeHtml(ownerFirstName);
    const safeFrontendUrl = escapeHtml(frontendUrl);

    const imageBlock = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${safeTitle}"
           style="width:100%;max-height:280px;object-fit:cover;border-radius:10px;display:block;margin-bottom:24px;" />`
      : '';

    const videoBlock = videoUrl
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
           <tr>
             <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;">
               <p style="margin:0 0 4px;color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;">Video del tutorial</p>
               <p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.5;">Hacé clic para ver el tutorial completo en video.</p>
               <a href="${escapeHtml(videoUrl)}"
                  style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;letter-spacing:0.3px;">
                 ▶&nbsp;&nbsp;Ver video
               </a>
             </td>
           </tr>
         </table>`
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:12px 12px 0 0;padding:40px 32px 36px;">
              <div style="width:64px;height:64px;background:rgba(255,255,255,0.12);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:30px;line-height:64px;text-align:center;">
                ${icon}
              </div>
              <div style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:20px;padding:4px 14px;margin-bottom:12px;">
                <span style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;">${badgeLabel}</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;line-height:1.3;">${safeTitle}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px 32px;">
              <h2 style="margin:0 0 6px;color:#111827;font-size:18px;font-weight:600;text-align:center;">¡Hola, ${safeOwner}! 👋</h2>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.5;">
                Tenemos ${isNews ? 'una nueva novedad' : 'un nuevo tutorial'} disponible en el sistema.
              </p>

              ${imageBlock}

              ${videoBlock}

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;text-align:center;">
                <tr>
                  <td align="center">
                    <a href="${safeFrontendUrl}"
                      style="display:inline-block;background:linear-gradient(135deg,#0f3460,#1a1a2e);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">
                        Ir al panel →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Info banner -->
          <tr>
            <td style="background:${accentLight};border:1px solid ${accentText}22;border-top:none;padding:14px 32px;">
              <p style="margin:0;color:${accentText};font-size:13px;line-height:1.5;">
                <strong>${isNews ? '📢 Novedad publicada' : '🎓 Tutorial disponible'}:</strong>
                Este contenido fue publicado por el equipo de Sistema Gym y ya está visible para todos los administradores.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                Este correo fue enviado automáticamente por <strong>Sistema Gym</strong>.<br/>
                Recibís este mensaje porque sos administrador de un gimnasio en la plataforma.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

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
      ? `📰 Nueva novedad: ${title}`
      : `🎬 Nuevo tutorial: ${title}`;

    const results = await Promise.allSettled(
      owners.map((owner) => {
        const firstName = owner.name.split(' ')[0];
        return this.resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@tudominio.com',
          to: owner.email,
          subject,
          html: this.buildEmailHtml(type, title, body, firstName, frontendUrl, imageUrl, videoUrl),
        });
      }),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[ContentService] Email send failed:', result.reason);
      } else {
        console.log('[ContentService] Email sent:', (result.value as any)?.data?.id);
      }
    }
  }
}

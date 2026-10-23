import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import PDFDocument from 'pdfkit';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';
import { endOfDayUTC, getTimezone, startOfDayUTC } from '../common/utils/timezone.util';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAYS_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const C = {
  ink: '#111111',
  muted: '#5e5e58',
  line: '#e3e3dc',
  lineSoft: '#edede7',
  chip: '#f1f1ec',
  brand: '#fffb00',
  ok: '#0a6158',
  bad: '#b42318',
  warn: '#7a4e00',
  warnBg: '#fff4db',
  bar: '#d4d4cc',
  plan: ['#111111', '#fffb00', '#8a8a83', '#d4d4cc', '#5e5e58', '#f0d28f'],
};

type Advanced = Awaited<ReturnType<ReportsService['advanced']>>;

interface MonthlyReportData {
  gymName: string;
  currency: string;
  monthLabel: string;
  prevMonthLabel: string;
  current: Advanced;
  previous: Advanced;
  attendance: {
    total: number;
    byWeekday: number[]; // Lun..Dom
    byGroup: { name: string; count: number }[];
    peakDay: string | null;
    peakHour: string | null;
  };
}

/**
 * Monthly report as PDF ("informe" layout: summary + Dinero / Socios / Asistencia).
 * Used for the on-demand download, the on-demand email and the month-end cron.
 * All money values coming from ReportsService are in cents.
 */
@Injectable()
export class ReportPdfService {
  private readonly logger = new Logger(ReportPdfService.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  // ── Public API ────────────────────────────────────────────

  async generate(gymId: string, month: string): Promise<{ buffer: Buffer; filename: string }> {
    if (!MONTH_RE.test(month)) throw new BadRequestException('Mes inválido (formato YYYY-MM)');
    const data = await this.collect(gymId, month);
    const buffer = await this.render(data);
    return { buffer, filename: `reporte-${month}.pdf` };
  }

  /** Sends the month's PDF to the gym owner (falls back to `fallbackEmail` when the gym has no owner). */
  async sendToOwner(gymId: string, month: string, fallbackEmail?: string): Promise<{ sentTo: string }> {
    const recipient = await this.ownerOf(gymId);
    const to = recipient?.email ?? fallbackEmail;
    if (!to) throw new NotFoundException('El gimnasio no tiene un dueño con correo registrado');

    const { buffer, filename } = await this.generate(gymId, month);
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } });
    const gymName = gym?.name ?? 'tu gimnasio';
    const monthLabel = capitalize(monthName(month));

    const { error } = await this.resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@tudominio.com',
      to,
      subject: `Reporte de ${monthLabel} — ${gymName}`,
      html: this.buildEmailHtml(recipient?.name ?? null, gymName, monthLabel),
      attachments: [{ filename, content: buffer }],
    });
    if (error) {
      this.logger.error(`[ReportPdf] Email to gym ${gymId} failed: ${error.message}`);
      throw new BadRequestException('No se pudo enviar el correo');
    }
    return { sentTo: to };
  }

  // ── Cron: previous month's report to every owner (1st of month, 10 AM UTC) ──
  @Cron('0 10 1 * *')
  async sendMonthlyReports() {
    const gyms = await this.prisma.gym.findMany({
      where: { isActive: true },
      select: { id: true, timezone: true, country: true, advancedReportsEnabled: true, subscriptionPlan: true },
    });
    const plansWithReports = new Set(
      (
        await this.prisma.subscriptionPlan.findMany({
          where: { advancedReportsEnabled: true },
          select: { key: true },
        })
      ).map((p) => p.key),
    );

    let sent = 0;
    for (const gym of gyms) {
      if (!gym.advancedReportsEnabled && !plansWithReports.has(gym.subscriptionPlan)) continue;
      const tz = gym.timezone ?? getTimezone(gym.country);
      const month = previousMonth(currentMonthIn(tz));
      try {
        await this.sendToOwner(gym.id, month);
        sent++;
      } catch (e) {
        this.logger.error(`[ReportPdf] Monthly report for gym ${gym.id} failed:`, e);
      }
      await new Promise((r) => setTimeout(r, 600)); // stay under the email provider's rate limit
    }
    this.logger.log(`[ReportPdf] Sent ${sent} monthly report(s)`);
  }

  // ── Data ──────────────────────────────────────────────────

  private async ownerOf(gymId: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        owner: { select: { email: true, name: true, isActive: true } },
        users: { where: { role: 'GYM_OWNER', isActive: true }, select: { email: true, name: true }, take: 1 },
      },
    });
    if (!gym) throw new NotFoundException('Gimnasio no encontrado');
    if (gym.owner?.isActive) return { email: gym.owner.email, name: gym.owner.name };
    return gym.users[0] ?? null;
  }

  private async collect(gymId: string, month: string): Promise<MonthlyReportData> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { name: true, currency: true, timezone: true, country: true },
    });
    if (!gym) throw new NotFoundException('Gimnasio no encontrado');
    const tz = gym.timezone ?? getTimezone(gym.country);

    const cur = monthBounds(month, tz);
    const prevMonth = previousMonth(month);
    const prev = monthBounds(prevMonth, tz);

    const [current, previous, attendances] = await Promise.all([
      this.reports.advanced(gymId, { startDate: cur.start.toISOString(), endDate: cur.end.toISOString(), granularity: 'weekly' }),
      this.reports.advanced(gymId, { startDate: prev.start.toISOString(), endDate: prev.end.toISOString(), granularity: 'weekly' }),
      this.prisma.attendance.findMany({
        where: { gymId, checkIn: { gte: cur.start, lte: cur.end } },
        select: { checkIn: true, group: { select: { name: true } } },
      }),
    ]);

    // Attendance scoped to the reported month (the advanced report only covers the last 7 days)
    const byWeekday = new Array(7).fill(0) as number[];
    const byHour = new Array(24).fill(0) as number[];
    const groups = new Map<string, number>();
    const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
    for (const a of attendances) {
      const [y, m, d] = a.checkIn.toLocaleDateString('en-CA', { timeZone: tz }).split('-').map(Number);
      byWeekday[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7]++;
      const h = parseInt(hourFmt.format(a.checkIn));
      byHour[isNaN(h) ? 0 : h % 24]++;
      const g = a.group?.name ?? 'Sin grupo';
      groups.set(g, (groups.get(g) ?? 0) + 1);
    }
    const total = attendances.length;

    return {
      gymName: gym.name,
      currency: gym.currency ?? 'USD',
      monthLabel: monthName(month),
      prevMonthLabel: monthName(prevMonth),
      current,
      previous,
      attendance: {
        total,
        byWeekday,
        byGroup: Array.from(groups, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        peakDay: total ? DAYS_LONG[byWeekday.indexOf(Math.max(...byWeekday))] : null,
        peakHour: total ? `${String(byHour.indexOf(Math.max(...byHour))).padStart(2, '0')}:00` : null,
      },
    };
  }

  // ── Rendering ─────────────────────────────────────────────

  private render(d: MonthlyReportData): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: `Reporte ${d.monthLabel} — ${d.gymName}` } });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const L = 48;
    const W = doc.page.width - 96;
    const money = (cents: number) => `${d.currency} ${fmtNum(cents / 100)}`;
    const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

    const cur = d.current;
    const prev = d.previous;
    const curMemberships = sum(cur.revenueTrend);
    const prevMemberships = sum(prev.revenueTrend);
    const curTotal = curMemberships + cur.storeRevenue + cur.storeCreditIssued;
    const prevTotal = prevMemberships + prev.storeRevenue + prev.storeCreditIssued;
    const totalDelta = pct(curTotal, prevTotal);
    const netGrowth = cur.newMembers - cur.churned;
    const prevNet = prev.newMembers - prev.churned;
    const activeTotal = cur.membersByPlan.reduce((s, p) => s + p.count, 0);
    const monthCap = capitalize(d.monthLabel);

    const ensure = (h: number) => {
      if (doc.y + h > doc.page.height - 64) doc.addPage();
    };

    // Header
    doc.font('Helvetica-Bold').fontSize(18).fillColor(C.ink).text(d.gymName, L, 48, { width: W * 0.65 });
    doc.font('Helvetica').fontSize(10).fillColor(C.muted).text(`Reporte mensual · ${monthCap}`, L, doc.y + 2);
    doc.fontSize(9).text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, L, 52, { width: W, align: 'right' });
    doc.y = Math.max(doc.y, 92);
    hr(doc, L, W, doc.y + 8, C.line);
    doc.y += 24;

    // Total band
    const bandY = doc.y;
    doc.roundedRect(L, bandY, W, 74, 10).fill(C.brand);
    doc.font('Helvetica').fontSize(9).fillColor(C.ink).text('INGRESOS TOTALES DEL MES', L + 18, bandY + 14, { characterSpacing: 0.8 });
    doc.font('Helvetica-Bold').fontSize(26).text(money(curTotal), L + 18, bandY + 30);
    doc.font('Helvetica').fontSize(10).text(
      totalDelta === null ? `Sin datos de ${d.prevMonthLabel}` : `${signed(totalDelta)}% vs ${d.prevMonthLabel} (${money(prevTotal)})`,
      L + W / 2, bandY + 40, { width: W / 2 - 18, align: 'right' },
    );
    doc.y = bandY + 92;

    // Summary sentence
    const parts = [
      `En ${d.monthLabel} ingresaron ${money(curTotal)}`
        + (totalDelta === null ? '.' : `, un ${Math.abs(totalDelta)}% ${totalDelta >= 0 ? 'más' : 'menos'} que en ${d.prevMonthLabel}.`),
      `Se sumaron ${cur.newMembers} socio${cur.newMembers === 1 ? '' : 's'} y se dieron de baja ${cur.churned}.`,
      cur.expiringNext7Days > 0 ? `Hay ${cur.expiringNext7Days} membresía${cur.expiringNext7Days === 1 ? '' : 's'} que vence${cur.expiringNext7Days === 1 ? '' : 'n'} en los próximos 7 días.` : '',
    ];
    doc.font('Helvetica').fontSize(12).fillColor(C.ink).text(parts.filter(Boolean).join(' '), L, doc.y, { width: W, lineGap: 3 });
    doc.y += 18;

    // 01 Dinero
    sectionTitle(doc, L, W, '01', 'Dinero');
    const deltaCell = (a: number, b: number, goodWhenUp = true) => {
      const p = pct(a, b);
      if (p === null) return { text: '—', color: C.muted };
      return { text: `${signed(p)}%`, color: p === 0 ? C.muted : (p > 0) === goodWhenUp ? C.ok : C.bad };
    };
    table(doc, L, W, ['Concepto', capitalize(shortMonth(d.monthLabel)), capitalize(shortMonth(d.prevMonthLabel)), 'Dif.'], [0.43, 0.2, 0.2, 0.17], [
      ['Membresías', money(curMemberships), money(prevMemberships), deltaCell(curMemberships, prevMemberships)],
      ['Tienda al contado', money(cur.storeRevenue), money(prev.storeRevenue), deltaCell(cur.storeRevenue, prev.storeRevenue)],
      ['Tienda en crédito (por cobrar)', money(cur.storeCreditIssued), money(prev.storeCreditIssued), deltaCell(cur.storeCreditIssued, prev.storeCreditIssued)],
    ], ['Total', money(curTotal), money(prevTotal), deltaCell(curTotal, prevTotal)]);
    doc.y += 14;
    ensure(190);
    cumulativeChart(doc, L, W, cur.revenueTrend.map((x) => x.amount), prev.revenueTrend.map((x) => x.amount), {
      title: 'Membresías acumuladas en el mes',
      curLabel: capitalize(d.monthLabel),
      prevLabel: capitalize(d.prevMonthLabel),
      endLabel: money(curMemberships),
    });
    doc.y += 22;

    // 02 Socios
    ensure(170);
    sectionTitle(doc, L, W, '02', 'Socios');
    const memberDelta = (a: number, b: number, goodWhenUp = true) =>
      a === b ? { text: '=', color: C.muted } : { text: signed(a - b), color: (a > b) === goodWhenUp ? C.ok : C.bad };
    table(doc, L, W, ['Indicador', capitalize(shortMonth(d.monthLabel)), capitalize(shortMonth(d.prevMonthLabel)), 'Dif.'], [0.43, 0.2, 0.2, 0.17], [
      ['Socios nuevos', String(cur.newMembers), String(prev.newMembers), memberDelta(cur.newMembers, prev.newMembers)],
      ['Bajas', String(cur.churned), String(prev.churned), memberDelta(cur.churned, prev.churned, false)],
      ['Crecimiento neto', signed(netGrowth), signed(prevNet), memberDelta(netGrowth, prevNet)],
      ['Vencen en los próximos 7 días', { text: String(cur.expiringNext7Days), color: cur.expiringNext7Days > 0 ? C.warn : C.ink }, '—', { text: '', color: C.muted }],
    ]);
    doc.y += 16;
    if (cur.membersByPlan.length) {
      ensure(60 + Math.ceil(cur.membersByPlan.length / 2) * 18);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text('Membresías activas por plan', L, doc.y);
      doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(`${activeTotal} activas hoy`, L, doc.y - 11, { width: W, align: 'right' });
      doc.y += 6;
      const plans = [...cur.membersByPlan].sort((a, b) => b.count - a.count);
      let x = L;
      const barY = doc.y;
      plans.forEach((p, i) => {
        const w = activeTotal ? (p.count / activeTotal) * W : 0;
        doc.rect(x, barY, Math.max(0, w - 1.5), 14).fill(C.plan[i % C.plan.length]);
        x += w;
      });
      const legendTop = barY + 24;
      plans.forEach((p, i) => {
        const col = i % 2;
        const rowY = legendTop + Math.floor(i / 2) * 18;
        const cx = L + col * (W / 2);
        doc.rect(cx, rowY + 1, 9, 9).fillAndStroke(C.plan[i % C.plan.length], '#c9c9c1');
        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text(p.planName, cx + 15, rowY, { width: W / 2 - 110, lineBreak: false, ellipsis: true });
        doc.font('Helvetica').fillColor(C.muted).text(`${p.count} · ${p.percent}%`, cx, rowY, { width: W / 2 - 16, align: 'right' });
      });
      doc.y = legendTop + Math.ceil(plans.length / 2) * 18 + 10;
    }
    doc.y += 12;

    // 03 Asistencia
    ensure(230);
    sectionTitle(doc, L, W, '03', 'Asistencia', `${fmtNum(d.attendance.total)} check-ins en el mes`);
    if (d.attendance.total === 0) {
      doc.font('Helvetica').fontSize(10).fillColor(C.muted).text('Sin check-ins registrados en este período.', L, doc.y);
    } else {
      const chartW = W * 0.58;
      const top = doc.y;
      weekdayBars(doc, L, top, chartW, 130, d.attendance.byWeekday);
      const sx = L + chartW + 24;
      const sw = W - chartW - 24;
      statBox(doc, sx, top, (sw - 8) / 2, 'Día pico', d.attendance.peakDay ?? '—');
      statBox(doc, sx + (sw + 8) / 2, top, (sw - 8) / 2, 'Hora pico', d.attendance.peakHour ?? '—');
      let gy = top + 62;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.muted).text('Por grupo', sx, gy);
      gy += 14;
      for (const g of d.attendance.byGroup.slice(0, 5)) {
        hr(doc, sx, sw, gy, C.lineSoft);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text(g.name, sx, gy + 6, { width: sw - 50, lineBreak: false, ellipsis: true });
        doc.font('Helvetica').text(fmtNum(g.count), sx, gy + 6, { width: sw, align: 'right' });
        gy += 22;
      }
      doc.y = Math.max(top + 160, gy + 6);
    }

    // Footer on every page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // the footer sits below the content area; don't let it spawn a page
      doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(
        `${d.gymName} · Reporte ${d.monthLabel} · Página ${i + 1} de ${range.count}`,
        L, doc.page.height - 36, { width: W, align: 'center', lineBreak: false },
      );
    }

    doc.end();
    return done;
  }

  private buildEmailHtml(name: string | null, gymName: string, monthLabel: string): string {
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><title>Reporte de ${esc(monthLabel)}</title></head>
<body style="margin:0;padding:0;background:#f3f3ef;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3e3dc;border-radius:16px">
        <tr><td style="padding:28px 28px 8px">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#5e5e58">${esc(gymName)}</p>
          <h1 style="margin:0;font-size:22px">Reporte de ${esc(monthLabel)}</h1>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6">
          <p style="margin:0 0 12px">Hola${name ? ` ${esc(name)}` : ''},</p>
          <p style="margin:0">Te adjuntamos el reporte de ${esc(monthLabel)} en PDF con los ingresos, socios y asistencia del mes comparados con el mes anterior.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}

// ── Date helpers ────────────────────────────────────────────

function monthBounds(month: string, tz: string) {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: startOfDayUTC(`${month}-01`, tz),
    end: endOfDayUTC(`${month}-${String(lastDay).padStart(2, '0')}`, tz),
  };
}

function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function currentMonthIn(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz }).slice(0, 7);
}

/** "octubre de 2026" */
function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** "octubre de 2026" → "oct 2026" */
function shortMonth(label: string): string {
  const [name, , year] = label.split(' ');
  return `${name.slice(0, 3)} ${year ?? ''}`.trim();
}

// ── Formatting helpers ──────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtNum(n: number) {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

function pct(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

// ── Drawing helpers ─────────────────────────────────────────

type Cell = string | { text: string; color: string };

function hr(doc: PDFKit.PDFDocument, x: number, w: number, y: number, color: string) {
  doc.moveTo(x, y).lineTo(x + w, y).lineWidth(1).strokeColor(color).stroke();
}

function sectionTitle(doc: PDFKit.PDFDocument, x: number, w: number, num: string, title: string, aside?: string) {
  const y = doc.y;
  doc.font('Helvetica').fontSize(10).fillColor(C.muted).text(num, x, y + 5);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(C.ink).text(title, x + 22, y);
  if (aside) doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(aside, x, y + 6, { width: w, align: 'right' });
  doc.y = y + 30;
}

function table(
  doc: PDFKit.PDFDocument,
  x: number,
  w: number,
  head: string[],
  cols: number[],
  rows: Cell[][],
  total?: Cell[],
) {
  const widths = cols.map((c) => c * w);
  const drawRow = (cells: Cell[], y: number, opts: { bold?: boolean; header?: boolean }) => {
    let cx = x;
    cells.forEach((cell, i) => {
      const { text, color } = typeof cell === 'string' ? { text: cell, color: i === 2 ? C.muted : C.ink } : cell;
      doc
        .font(opts.header ? 'Helvetica' : opts.bold || i === 0 || i === 3 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(opts.header ? 8.5 : 10)
        .fillColor(opts.header ? C.muted : color)
        .text(text, cx, y, { width: widths[i] - (i === 0 ? 8 : 0), align: i === 0 ? 'left' : 'right', lineBreak: false, ellipsis: true });
      cx += widths[i];
    });
  };
  let y = doc.y;
  drawRow(head, y, { header: true });
  y += 16;
  hr(doc, x, w, y, C.line);
  for (const r of rows) {
    drawRow(r, y + 8, {});
    y += 26;
    hr(doc, x, w, y, C.lineSoft);
  }
  if (total) {
    drawRow(total, y + 9, { bold: true });
    y += 28;
  }
  doc.y = y;
}

function cumulativeChart(
  doc: PDFKit.PDFDocument,
  x: number,
  w: number,
  cur: number[],
  prev: number[],
  labels: { title: string; curLabel: string; prevLabel: string; endLabel: string },
) {
  const top = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text(labels.title, x, top);
  // Legend, right-aligned: [— cur]  [- - prev]
  doc.font('Helvetica').fontSize(8.5);
  const prevX = x + w - doc.widthOfString(labels.prevLabel) - 20;
  const curX = prevX - doc.widthOfString(labels.curLabel) - 34;
  doc.moveTo(curX, top + 5).lineTo(curX + 16, top + 5).lineWidth(2).strokeColor(C.ink).stroke();
  doc.fillColor(C.muted).text(labels.curLabel, curX + 20, top + 1, { lineBreak: false });
  doc.moveTo(prevX, top + 5).lineTo(prevX + 16, top + 5).lineWidth(1.5).dash(3, { space: 2 }).strokeColor('#8a8a83').stroke().undash();
  doc.text(labels.prevLabel, prevX + 20, top + 1, { lineBreak: false });

  const n = Math.max(cur.length, prev.length, 2);
  const acc = (xs: number[]) => {
    let s = 0;
    return Array.from({ length: n }, (_, i) => (s += xs[i] ?? 0));
  };
  const cA = acc(cur);
  const pA = acc(prev);
  const max = Math.max(1, ...cA, ...pA);
  const ch = 130;
  const cy = top + 22;
  const plotX = x + 8;
  const plotW = w - 70;
  const px = (i: number) => plotX + (i / (n - 1)) * plotW;
  const py = (v: number) => cy + ch - (v / max) * (ch - 10);

  for (let g = 0; g <= 4; g++) hr(doc, plotX, plotW, cy + ch - (g / 4) * (ch - 10), g === 0 ? C.line : C.lineSoft);

  // Current month area + line
  doc.save();
  doc.moveTo(px(0), cy + ch);
  cA.forEach((v, i) => doc.lineTo(px(i), py(v)));
  doc.lineTo(px(n - 1), cy + ch).closePath().fillOpacity(0.45).fill(C.brand);
  doc.restore();

  doc.save();
  pA.forEach((v, i) => (i === 0 ? doc.moveTo(px(i), py(v)) : doc.lineTo(px(i), py(v))));
  doc.lineWidth(1.5).dash(4, { space: 3 }).strokeColor('#8a8a83').stroke();
  doc.restore();

  doc.save();
  cA.forEach((v, i) => (i === 0 ? doc.moveTo(px(i), py(v)) : doc.lineTo(px(i), py(v))));
  doc.lineWidth(2).lineJoin('round').strokeColor(C.ink).stroke();
  doc.restore();

  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink).text(labels.endLabel, px(n - 1) + 6, py(cA[n - 1]) - 5, { lineBreak: false });
  for (let i = 0; i < n; i++) {
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(`Sem ${i + 1}`, px(i) - 20, cy + ch + 6, { width: 40, align: 'center', lineBreak: false });
  }
  doc.y = cy + ch + 20;
}

function weekdayBars(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, counts: number[]) {
  const max = Math.max(1, ...counts);
  const gap = 10;
  const bw = (w - gap * 6) / 7;
  const base = y + h - 14;
  hr(doc, x, w, base, C.line);
  counts.forEach((c, i) => {
    const bx = x + i * (bw + gap);
    const bh = Math.max(2, (c / max) * (h - 40));
    const peak = c === max && c > 0;
    doc.rect(bx, base - bh, bw, bh).fill(peak ? C.ink : C.bar);
    doc.font(peak ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(C.ink)
      .text(fmtNum(c), bx - 4, base - bh - 12, { width: bw + 8, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
      .text(DAYS_SHORT[i], bx - 4, base + 4, { width: bw + 8, align: 'center', lineBreak: false });
  });
}

function statBox(doc: PDFKit.PDFDocument, x: number, y: number, w: number, label: string, value: string) {
  doc.roundedRect(x, y, w, 50, 8).lineWidth(1).strokeColor(C.line).stroke();
  doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(label, x + 10, y + 9, { width: w - 20 });
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.ink).text(value, x + 10, y + 24, { width: w - 20, lineBreak: false, ellipsis: true });
}

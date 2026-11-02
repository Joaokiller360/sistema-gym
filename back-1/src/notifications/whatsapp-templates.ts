import type { TemplateParams } from './whatsapp.service';

/** Template names, overridable per environment. Bodies must match the ones approved in Meta. */
export const TEMPLATES = {
  limitWarning:
    process.env.WHATSAPP_TEMPLATE_LIMIT_WARNING ?? 'gymos_limite_plan_aviso',
  limitReached:
    process.env.WHATSAPP_TEMPLATE_LIMIT_REACHED ??
    'gymos_limite_plan_alcanzado',
  contact: process.env.WHATSAPP_TEMPLATE_CONTACT ?? 'gymos_contacto',
  // Marketing: first message to prospects that aren't customers yet
  offer: process.env.WHATSAPP_TEMPLATE_OFFER ?? 'gymos_oferta',
  // Gym → member notifications (sent from the platform number on behalf of the gym)
  memberBirthday:
    process.env.WHATSAPP_TEMPLATE_MEMBER_BIRTHDAY ?? 'gymos_socio_cumpleanos',
  memberExpiry:
    process.env.WHATSAPP_TEMPLATE_MEMBER_EXPIRY ?? 'gymos_socio_vencimiento',
  memberAnnouncement:
    process.env.WHATSAPP_TEMPLATE_MEMBER_ANNOUNCEMENT ?? 'gymos_socio_aviso',
};

// Local copy of each body so the CRM shows what the owner actually received
const BODIES: Record<string, string> = {
  [TEMPLATES.limitWarning]:
    'Hola {{1}} 👋\n\nTu gimnasio *{{2}}* ya usa el {{3}}% de los socios incluidos en tu plan: {{4}} de {{5}} en el plan {{6}}.\n\nCuando llegues al límite no vas a poder registrar socios nuevos. Si esperás seguir creciendo, te recomendamos pasarte a un plan superior.',
  [TEMPLATES.limitReached]:
    'Hola {{1}}, tu gimnasio *{{2}}* llegó al máximo de {{3}} socios del plan {{4}}.\n\nDesde ahora no se pueden registrar socios nuevos. Para seguir sumando, actualizá tu plan o liberá lugares dando de baja socios que ya no asisten.',
  [TEMPLATES.offer]:
    'Hola {{1}} 👋 Te escribimos desde {{2}}.\n\nAyudamos a gimnasios a manejar socios, cobros y asistencias desde un solo lugar.\n\n¿Te gustaría que te contemos cómo funciona? Respondé este mensaje y te asesoramos.',
  [TEMPLATES.memberBirthday]:
    '¡Feliz cumpleaños, {{1}}! 🎂\n\nTodo el equipo de *{{2}}* te desea un día increíble lleno de salud, fuerza y alegría. 💪\n\nGracias por entrenar con nosotros.',
  [TEMPLATES.memberExpiry]:
    'Hola {{1}} 👋\n\nTu membresía *{{2}}* en *{{3}}* vence el *{{4}}*.\n\nRenueva a tiempo para seguir entrenando sin interrupciones. Si ya renovaste, ignora este mensaje.',
  [TEMPLATES.memberAnnouncement]:
    'Hola {{1}}, tienes un aviso de *{{2}}*:\n\n*{{3}}*\n{{4}}\n\nSi tienes dudas, comunícate con tu gimnasio.',
  [TEMPLATES.contact]:
    'Hola {{1}}, te escribimos desde {{2}} por tu gimnasio *{{3}}*. Respondé este mensaje y seguimos la conversación por acá.',
};

/** `fallback`: the approved body as Meta returns it, for templates without a local copy */
export function renderTemplate(
  name: string,
  params: TemplateParams,
  fallback?: string,
): string {
  const body = BODIES[name] ?? fallback;
  if (!body) return `[Plantilla ${name}] ${params.join(' · ')}`;
  return body.replace(/\{\{(\d+)\}\}/g, (_, i: string) =>
    String(params[Number(i) - 1] ?? ''),
  );
}

/**
 * Meta rejects template params with new lines, tabs or more than 4 spaces in a row.
 * Collapses them and trims to `max` chars.
 */
export function templateParam(value: string, max = 1000): string {
  const clean = value
    .replace(/\s*[\r\n\t]+\s*/g, ' · ')
    .replace(/ {2,}/g, ' ')
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

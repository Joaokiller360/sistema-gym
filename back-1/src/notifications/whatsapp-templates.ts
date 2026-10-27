import type { TemplateParams } from './whatsapp.service';

/** Template names, overridable per environment. Bodies must match the ones approved in Meta. */
export const TEMPLATES = {
  limitWarning:
    process.env.WHATSAPP_TEMPLATE_LIMIT_WARNING ?? 'gymos_limite_plan_aviso',
  limitReached:
    process.env.WHATSAPP_TEMPLATE_LIMIT_REACHED ??
    'gymos_limite_plan_alcanzado',
  contact: process.env.WHATSAPP_TEMPLATE_CONTACT ?? 'gymos_contacto',
};

// Local copy of each body so the CRM shows what the owner actually received
const BODIES: Record<string, string> = {
  [TEMPLATES.limitWarning]:
    'Hola {{1}} 👋\n\nTu gimnasio *{{2}}* ya usa el {{3}}% de los socios incluidos en tu plan: {{4}} de {{5}} en el plan {{6}}.\n\nCuando llegues al límite no vas a poder registrar socios nuevos. Si esperás seguir creciendo, te recomendamos pasarte a un plan superior.',
  [TEMPLATES.limitReached]:
    'Hola {{1}}, tu gimnasio *{{2}}* llegó al máximo de {{3}} socios del plan {{4}}.\n\nDesde ahora no se pueden registrar socios nuevos. Para seguir sumando, actualizá tu plan o liberá lugares dando de baja socios que ya no asisten.',
  [TEMPLATES.contact]:
    'Hola {{1}}, te escribimos desde {{2}} por tu gimnasio *{{3}}*. Respondé este mensaje y seguimos la conversación por acá.',
};

export function renderTemplate(name: string, params: TemplateParams): string {
  const body = BODIES[name];
  if (!body) return `[Plantilla ${name}] ${params.join(' · ')}`;
  return body.replace(/\{\{(\d+)\}\}/g, (_, i: string) =>
    String(params[Number(i) - 1] ?? ''),
  );
}

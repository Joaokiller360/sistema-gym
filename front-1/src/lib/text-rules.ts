/**
 * Same character rules as the back (back-1/src/common/validators/text.validator.ts),
 * checked here only to warn before sending; the back is the one that enforces them.
 */

/** Letters (any language), spaces and . ' ’ - */
const PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u
/** Also digits and & ( ) # + / , · : for businesses and aliases */
const SAFE_NAME = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,'’&()#+/·:-]*$/u
/** Tags and button names; emoji allowed */
const LABEL = /^[\p{L}\p{M}\p{N}\p{Extended_Pictographic}](?:[\p{L}\p{M}\p{N}\p{Extended_Pictographic} ._/-]|‍|️)*$/u

const RULES = {
  person: { re: PERSON_NAME, message: 'El nombre solo puede tener letras, espacios, puntos, apóstrofes y guiones' },
  name: { re: SAFE_NAME, message: "Solo letras, números, espacios y . , ' & ( ) # + / · : -" },
  label: { re: LABEL, message: 'Solo letras, números, emojis, espacios y . _ / -' },
}

/** null when fine (or empty), otherwise the message to show */
export function textError(kind: keyof typeof RULES, value: string): string | null {
  const v = value.trim()
  return v && !RULES[kind].re.test(v) ? RULES[kind].message : null
}

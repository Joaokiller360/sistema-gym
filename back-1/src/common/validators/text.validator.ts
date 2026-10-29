import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches, ValidationOptions } from 'class-validator';

/*
 * Input hygiene for user-typed text. SQL injection is not what this guards against:
 * every query goes through Prisma, which sends values as bound parameters. This keeps
 * identity fields to the characters they really use and strips invisible characters
 * (control codes, zero-width, bidi overrides) that can spoof or break what others read.
 */

// C0/C1 controls except \t \n \r, zero-width chars (not U+200D: it joins emoji) and bidi overrides/isolates.
// Built from a string so the escapes stay readable (a literal would hold the invisible chars).
const INVISIBLE = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F' +
    '\\u200B\\u200C\\u200E\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069\\uFEFF]',
  'g',
);

export function cleanText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

/** Letters (any language), spaces and . ' ’ - : "María José", "O'Brien", "J. Pérez" */
export const PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;
/** Also digits and & ( ) # + / , · : for businesses and aliases: "Fit & Co", "Gym #2 · Centro" */
export const SAFE_NAME = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,'’&()#+/·:-]*$/u;
/** Short labels: tags, button names; emoji allowed */
export const LABEL =
  /^[\p{L}\p{M}\p{N}\p{Extended_Pictographic}](?:[\p{L}\p{M}\p{N}\p{Extended_Pictographic} ._/-]|‍|️)*$/u;
/** Digits with an optional + and spacing: "+54 9 11 4821-3390" */
export const PHONE = /^\+?[\d\s()-]{6,20}$/;
/** Meta template names */
export const TEMPLATE_NAME = /^[a-z][a-z0-9_]{0,511}$/;
/** "es", "en_US" */
export const LANGUAGE = /^[a-z]{2}(_[A-Z]{2})?$/;

const each = (o?: ValidationOptions) => (o?.each ? { each: true } : {});

/** Strips invisible characters and trims; for any free text (messages, notes) */
export function CleanText() {
  return Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map(cleanText) : cleanText(value),
  );
}

export function IsPersonName(o?: ValidationOptions) {
  return applyDecorators(
    CleanText(),
    Matches(PERSON_NAME, {
      ...each(o),
      message:
        'El nombre solo puede tener letras, espacios, puntos, apóstrofes y guiones',
    }),
  );
}

export function IsSafeName(o?: ValidationOptions) {
  return applyDecorators(
    CleanText(),
    Matches(SAFE_NAME, {
      ...each(o),
      message: "Solo letras, números, espacios y . , ' & ( ) # + / · : -",
    }),
  );
}

export function IsLabel(o?: ValidationOptions) {
  return applyDecorators(
    CleanText(),
    Matches(LABEL, {
      ...each(o),
      message: 'Solo letras, números, emojis, espacios y . _ / -',
    }),
  );
}

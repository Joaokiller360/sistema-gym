import { describe, it, expect } from 'vitest'
import {
  isValid,
  isCharAllowed,
  sanitize,
  sanitizeNoTrim,
  createHandlers,
  createBlockHandlers,
  inferFieldType,
  zodSafeField,
  type FieldType,
} from './input-validation'

// ─── isValid ────────────────────────────────────────────────

describe('isValid', () => {
  describe('text', () => {
    it('allows alphanumeric and basic punctuation', () => {
      expect(isValid('Hola Mundo 123', 'text')).toBe(true)
      expect(isValid('Plan Full Access.', 'text')).toBe(true)
      expect(isValid('José María', 'text')).toBe(true)
    })
    it('blocks XSS vectors', () => {
      expect(isValid('<script>alert(1)</script>', 'text')).toBe(false)
      expect(isValid('hello`world', 'text')).toBe(false)
      expect(isValid('foo{bar}', 'text')).toBe(false)
      expect(isValid('a|b', 'text')).toBe(false)
      expect(isValid('a^b', 'text')).toBe(false)
      expect(isValid('a~b', 'text')).toBe(false)
    })
    it('blocks SQL injection chars (* = ^ $ | backtick)', () => {
      // * blocks SELECT * FROM style patterns
      expect(isValid('SELECT * FROM users', 'text')).toBe(false)
      // $ { block template injection used in modern ORMs
      expect(isValid('${DROP TABLE}', 'text')).toBe(false)
      // Backtick blocks MySQL identifier injection
      expect(isValid('`admin`', 'text')).toBe(false)
    })
    it('blocks javascript: URIs via backtick or angle brackets', () => {
      // javascript:alert(1) with only safe chars passes char validation;
      // it is blocked by CSP headers and the backend never executes it.
      // What we block is the HTML injection wrapper:
      expect(isValid('<a href="javascript:alert(1)">', 'text')).toBe(false)
      expect(isValid('`javascript:alert(1)`', 'text')).toBe(false)
    })
    it('blocks escaped sequences', () => {
      expect(isValid('foo\\nbar', 'text')).toBe(false)
      expect(isValid('foo\\x41', 'text')).toBe(false)
    })
    it('blocks dollar sign', () => {
      expect(isValid('$foo', 'text')).toBe(false)
    })
    it('empty string is valid', () => {
      expect(isValid('', 'text')).toBe(true)
    })
  })

  describe('name', () => {
    it('allows accented letters and hyphens', () => {
      expect(isValid('José María', 'name')).toBe(true)
      expect(isValid("O'Brien", 'name')).toBe(true)
      expect(isValid('Anne-Marie', 'name')).toBe(true)
    })
    it('blocks numbers', () => {
      expect(isValid('Juan123', 'name')).toBe(false)
    })
    it('blocks XSS', () => {
      expect(isValid('<script>', 'name')).toBe(false)
      expect(isValid('foo`bar', 'name')).toBe(false)
    })
  })

  describe('email', () => {
    it('allows valid email chars', () => {
      expect(isValid('user@domain.com', 'email')).toBe(true)
      expect(isValid('user.name+tag@sub.domain.org', 'email')).toBe(true)
    })
    it('blocks angle brackets', () => {
      expect(isValid('<user@domain.com>', 'email')).toBe(false)
    })
    it('blocks backtick', () => {
      expect(isValid('user`@domain.com', 'email')).toBe(false)
    })
    it('blocks onerror=', () => {
      expect(isValid('user@domain.com onerror=x', 'email')).toBe(false)
    })
  })

  describe('password', () => {
    it('allows all printable ASCII', () => {
      expect(isValid('P@$$w0rd!', 'password')).toBe(true)
      expect(isValid('correcthorsebatterystaple', 'password')).toBe(true)
      expect(isValid('abc123!@#$%^&*()', 'password')).toBe(true)
    })
    it('blocks non-printable chars', () => {
      expect(isValid('pass\x00word', 'password')).toBe(false)
      expect(isValid('pass\x01word', 'password')).toBe(false)
    })
  })

  describe('price', () => {
    it('allows digits and decimal point', () => {
      expect(isValid('99.99', 'price')).toBe(true)
      expect(isValid('1000', 'price')).toBe(true)
    })
    it('blocks letters and special chars', () => {
      expect(isValid('$99', 'price')).toBe(false)
      expect(isValid('99,99', 'price')).toBe(false)
      expect(isValid('1e5', 'price')).toBe(false)
    })
  })

  describe('phone', () => {
    it('allows digits, +, spaces, hyphens, parens', () => {
      expect(isValid('+54 9 11 1234-5678', 'phone')).toBe(true)
      expect(isValid('(011) 4444-5555', 'phone')).toBe(true)
      expect(isValid('0986660737', 'phone')).toBe(true)
    })
    it('blocks letters and symbols', () => {
      expect(isValid('abc', 'phone')).toBe(false)
      expect(isValid('+54<script>', 'phone')).toBe(false)
    })
  })

  describe('slug', () => {
    it('allows lowercase alphanumeric and hyphens/underscores', () => {
      expect(isValid('fitness-club-2024', 'slug')).toBe(true)
      expect(isValid('my_gym', 'slug')).toBe(true)
    })
    it('blocks uppercase', () => {
      expect(isValid('FitnessClub', 'slug')).toBe(false)
    })
    it('blocks spaces', () => {
      expect(isValid('fitness club', 'slug')).toBe(false)
    })
    it('blocks special chars', () => {
      expect(isValid('gym<>/', 'slug')).toBe(false)
    })
  })

  describe('url', () => {
    it('allows full URLs', () => {
      expect(isValid('https://example.com/path?q=1&r=2#anchor', 'url')).toBe(true)
    })
    it('blocks backtick and angle brackets', () => {
      expect(isValid('https://evil.com/`', 'url')).toBe(false)
      expect(isValid('<script>alert(1)</script>', 'url')).toBe(false)
    })
  })

  describe('number', () => {
    it('allows only digits', () => {
      expect(isValid('12345', 'number')).toBe(true)
    })
    it('blocks decimals', () => {
      expect(isValid('12.5', 'number')).toBe(false)
    })
    it('blocks negative sign', () => {
      expect(isValid('-5', 'number')).toBe(false)
    })
  })
})

// ─── sanitize ───────────────────────────────────────────────

describe('sanitize', () => {
  it('strips forbidden chars', () => {
    // < and > are stripped; the text between them stays
    expect(sanitize('<script>alert</script>', 'text')).toBe('scriptalert/script')
    expect(sanitize('Juan<>', 'name')).toBe('Juan')
    expect(sanitize('  hello world  ', 'text')).toBe('hello world')
  })

  it('trims whitespace', () => {
    expect(sanitize('  hello  ', 'text')).toBe('hello')
  })

  it('keeps allowed chars intact', () => {
    expect(sanitize('José María', 'name')).toBe('José María')
    expect(sanitize('user@domain.com', 'email')).toBe('user@domain.com')
    expect(sanitize('99.99', 'price')).toBe('99.99')
  })

  it('strips unicode bypass attempts (categories)', () => {
    // ℓ (U+2113) is not in ASCII letter range, blocked
    expect(sanitize('ℓemail', 'email')).toBe('email')
  })

  it('handles zero-width chars', () => {
    const zwsp = '​'
    expect(sanitize(`hello${zwsp}world`, 'text')).toBe('helloworld')
  })

  it('handles emoji', () => {
    expect(sanitize('hello 👋 world', 'text')).toBe('hello  world')
  })

  it('strips repeated special chars', () => {
    expect(sanitize('<<<<<>>>>>>```', 'text')).toBe('')
  })
})

// ─── sanitizeNoTrim ─────────────────────────────────────────

describe('sanitizeNoTrim', () => {
  it('strips forbidden chars but preserves internal whitespace', () => {
    expect(sanitizeNoTrim('  hello  ', 'text')).toBe('  hello  ')
    expect(sanitizeNoTrim('a<b', 'text')).toBe('ab')
  })
})

// ─── isCharAllowed ──────────────────────────────────────────

describe('isCharAllowed', () => {
  it('text: allows letters and digits', () => {
    expect(isCharAllowed('a', 'text')).toBe(true)
    expect(isCharAllowed('5', 'text')).toBe(true)
    expect(isCharAllowed(' ', 'text')).toBe(true)
  })
  it('text: blocks XSS chars', () => {
    expect(isCharAllowed('<', 'text')).toBe(false)
    expect(isCharAllowed('>', 'text')).toBe(false)
    expect(isCharAllowed('`', 'text')).toBe(false)
    expect(isCharAllowed('\\', 'text')).toBe(false)
    expect(isCharAllowed('{', 'text')).toBe(false)
    expect(isCharAllowed('}', 'text')).toBe(false)
    expect(isCharAllowed('|', 'text')).toBe(false)
    expect(isCharAllowed('^', 'text')).toBe(false)
    expect(isCharAllowed('~', 'text')).toBe(false)
    expect(isCharAllowed('$', 'text')).toBe(false)
  })
  it('email: allows @ and dot', () => {
    expect(isCharAllowed('@', 'email')).toBe(true)
    expect(isCharAllowed('.', 'email')).toBe(true)
  })
  it('price: only digits and dot', () => {
    expect(isCharAllowed('9', 'price')).toBe(true)
    expect(isCharAllowed('.', 'price')).toBe(true)
    expect(isCharAllowed(',', 'price')).toBe(false)
  })
  it('password: allows special chars', () => {
    expect(isCharAllowed('!', 'password')).toBe(true)
    expect(isCharAllowed('@', 'password')).toBe(true)
    expect(isCharAllowed('#', 'password')).toBe(true)
    expect(isCharAllowed('<', 'password')).toBe(true)
  })
  it('slug: only lowercase', () => {
    expect(isCharAllowed('a', 'slug')).toBe(true)
    expect(isCharAllowed('A', 'slug')).toBe(false)
    expect(isCharAllowed('-', 'slug')).toBe(true)
    expect(isCharAllowed('_', 'slug')).toBe(true)
  })
})

// ─── Security attack patterns ───────────────────────────────

describe('security: attack pattern rejection', () => {
  const dangerousInputs = [
    '<script>alert("xss")</script>',
    'javascript:alert(1)',
    'SELECT * FROM users WHERE 1=1',
    'DROP TABLE members; --',
    "' OR '1'='1",
    'onerror=alert(1)',
    'eval(atob("..."))',
    '<img src=x onerror=alert(1)>',
    '{{7*7}}',
    '${7*7}',
    '\x3cscript\x3e',
    '<script>',
    '\x00\x01\x02',
  ]

  const safeTypes: FieldType[] = ['text', 'name', 'email', 'search', 'address', 'slug']

  safeTypes.forEach(type => {
    dangerousInputs.forEach(input => {
      it(`${type}: sanitize removes dangerous "${input.slice(0, 30)}"`, () => {
        const result = sanitize(input, type)
        expect(result).not.toContain('<')
        expect(result).not.toContain('>')
        expect(result).not.toContain('`')
        expect(result).not.toContain('\\')
        expect(result).not.toContain('{')
        expect(result).not.toContain('}')
        expect(result).not.toContain('|')
      })
    })
  })

  it('XSS: isValid rejects script tags for all non-password types', () => {
    const script = '<script>alert(1)</script>'
    const typesToCheck: FieldType[] = ['text', 'name', 'email', 'search', 'address', 'slug', 'number', 'price']
    typesToCheck.forEach(type => {
      expect(isValid(script, type)).toBe(false)
    })
  })

  it('SQL: isValid blocks the dangerous chars in injection patterns', () => {
    // Character-based validation: blocks < > ` \ { } | ^ ~ $ (injection vectors)
    // SQL injection is mitigated at the backend via parameterized queries (ORM)
    // Frontend validates that no injection-capable chars get through
    expect(isValid("foo`; SELECT 1", 'text')).toBe(false)  // backtick blocked
    expect(isValid('${SELECT}', 'text')).toBe(false)         // $ and { blocked
    expect(isValid('<SELECT>', 'text')).toBe(false)           // < and > blocked
    // Pure letter+space SQL keywords pass char validation — backend handles these
    // This is expected: "DROP TABLE" contains only safe chars
    expect(isValid('SELECT * FROM users', 'text')).toBe(false) // * blocked
  })
})

// ─── Unicode bypass attempts ────────────────────────────────

describe('unicode bypass', () => {
  it('blocks lookalike angle brackets (U+02C2, U+02C3)', () => {
    // ˂ (U+02C2) and ˃ (U+02C3) look like < and >
    expect(isCharAllowed('˂', 'text')).toBe(false)
    expect(isCharAllowed('˃', 'text')).toBe(false)
  })

  it('blocks zero-width non-joiner and zero-width joiner', () => {
    expect(isCharAllowed('‌', 'text')).toBe(false)
    expect(isCharAllowed('‍', 'text')).toBe(false)
  })

  it('blocks RTL override character', () => {
    expect(isCharAllowed('‮', 'text')).toBe(false)
  })

  it('sanitize removes unicode control chars', () => {
    const input = 'hello​world‮'
    const result = sanitize(input, 'text')
    expect(result).toBe('helloworld')
  })
})

// ─── inferFieldType ─────────────────────────────────────────

describe('inferFieldType', () => {
  it('maps html types correctly', () => {
    expect(inferFieldType('email')).toBe('email')
    expect(inferFieldType('password')).toBe('password')
    expect(inferFieldType('number')).toBe('number')
    expect(inferFieldType('tel')).toBe('phone')
    expect(inferFieldType('url')).toBe('url')
    expect(inferFieldType('date')).toBe('date')
    expect(inferFieldType('text')).toBe('text')
    expect(inferFieldType(undefined)).toBe('text')
    expect(inferFieldType('unknown')).toBe('text')
  })
})

// ─── zodSafeField ───────────────────────────────────────────

describe('zodSafeField', () => {
  it('returns true for valid values', () => {
    expect(zodSafeField('text')('Hello World')).toBe(true)
    expect(zodSafeField('email')('user@domain.com')).toBe(true)
    expect(zodSafeField('price')('99.99')).toBe(true)
  })

  it('returns false for invalid values', () => {
    expect(zodSafeField('text')('<script>')).toBe(false)
    expect(zodSafeField('name')('abc<123>')).toBe(false)
  })

  it('returns true for empty string (optional fields)', () => {
    expect(zodSafeField('text')('')).toBe(true)
    expect(zodSafeField('name')('')).toBe(true)
  })
})

// ─── createHandlers ─────────────────────────────────────────

describe('createHandlers', () => {
  it('returns all four handlers', () => {
    const h = createHandlers('text')
    expect(typeof h.onKeyDown).toBe('function')
    expect(typeof h.onPaste).toBe('function')
    expect(typeof h.onDrop).toBe('function')
    expect(typeof h.onBlur).toBe('function')
  })
})

describe('createBlockHandlers', () => {
  it('omits onBlur', () => {
    const h = createBlockHandlers('text')
    expect(typeof h.onKeyDown).toBe('function')
    expect(typeof h.onPaste).toBe('function')
    expect(typeof h.onDrop).toBe('function')
    expect((h as Record<string, unknown>).onBlur).toBeUndefined()
  })
})

// ─── Edge cases ──────────────────────────────────────────────

describe('edge cases', () => {
  it('handles very long strings', () => {
    const long = 'a'.repeat(10000)
    expect(isValid(long, 'text')).toBe(true)
    expect(sanitize(long, 'text')).toBe(long.trim())
  })

  it('handles strings with only forbidden chars', () => {
    expect(sanitize('<>{}', 'text')).toBe('')
    expect(sanitize('```', 'text')).toBe('')
  })

  it('handles mixed valid/invalid chars', () => {
    expect(sanitize('Hello<World', 'text')).toBe('HelloWorld')
    // sanitize removes brackets; inner text (script) remains as it's valid chars
    expect(sanitize('Juan<script>Carlos', 'name')).toBe('JuanscriptCarlos')
  })

  it('handles null-byte injection', () => {
    expect(isValid('foo\x00bar', 'text')).toBe(false)
    expect(sanitize('foo\x00bar', 'text')).toBe('foobar')
  })

  it('repeated chars dont bypass', () => {
    expect(sanitize('<<<<<', 'text')).toBe('')
    expect(sanitize('....', 'text')).toBe('....')
  })
})

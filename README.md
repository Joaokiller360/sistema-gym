# GymOS — Plataforma SaaS de Gestión para Gimnasios

Sistema multi-tenant SaaS para gestión integral de gimnasios. Cada gimnasio opera en su propio espacio aislado (tenant), con soporte para múltiples sucursales, membresías, pagos, entrenadores, clases grupales, inventario, tienda interna y marketing por email.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| Backend | NestJS 11, Prisma 5, PostgreSQL 16 |
| Auth | JWT (access 1h) + Refresh Tokens (30 días, rotación, SHA-256 hash en DB) |
| Email | Resend |
| Contenedores | Docker / Docker Compose |

---

## Arquitectura

```
sistema-gym/
├── back-1/      # API REST — NestJS + Prisma
└── front-1/     # Interfaz — Next.js (App Router)
```

### Multi-tenancy

Cada gimnasio (`Gym`) tiene un `slug` único. Rutas del frontend: `/gym/[gymSlug]/*`. El backend filtra todos los recursos por `gymId` via `TenantGuard` en cada endpoint.

---

## Roles de Usuario

| Rol | Alcance | Capacidades |
|-----|---------|-------------|
| `SUPER_ADMIN` | Plataforma completa | Gestión de todos los gimnasios, planes de suscripción SaaS, configuración global, solicitudes de demo, contenido (noticias/tutoriales), soporte |
| `GYM_OWNER` | Su gimnasio | Todo lo de GYM_ADMIN + configuración del gimnasio, gestión de administradores, facturación |
| `GYM_ADMIN` | Su gimnasio | Socios, membresías, pagos, entrenadores, clases, inventario, reportes, marketing, sucursales |
| `TRAINER` | Su gimnasio | Clases asignadas, socios de sus clases |
| `RECEPTIONIST` | Su gimnasio | Check-in/check-out, pagos, membresías |

**Nota de seguridad:** `SUPER_ADMIN` bypasea el `RolesGuard` automáticamente. `GYM_OWNER` tiene whitelist de campos en PATCH para prevenir escalación de permisos. DELETE de productos/ventas/categorías de tienda requiere `SUPER_ADMIN`.

---

## Módulos del Backend

| Módulo | Endpoints | Descripción |
|--------|-----------|-------------|
| `auth` | `/auth/*` | Login, registro, refresh tokens, cambio de contraseña |
| `gyms` | `/gyms/*` | CRUD gimnasios, logo upload (MIME + extensión validados) |
| `branches` | `/branches/*` | Sucursales por gimnasio |
| `plans` | `/plans/*` | Planes de membresía con precios, duración, beneficios |
| `members` | `/members/*` | Socios, foto, datos personales |
| `memberships` | `/memberships/*` | Afiliaciones (ACTIVE, EXPIRED, SUSPENDED, FROZEN, CANCELLED) |
| `payments` | `/payments/*` | Pagos (CASH, CARD, TRANSFER, OTHER) |
| `attendance` | `/attendance/*` | Check-in / check-out |
| `trainers` | `/trainers/*` | Entrenadores y disponibilidad |
| `classes` | `/classes/*` | Clases grupales + inscripciones |
| `inventory` | `/inventory/*` | Equipamiento + historial de mantenimiento |
| `communications` | `/communications/*` | Mensajería interna |
| `marketing` | `/marketing/*` | Campañas de email + templates |
| `store` | `/store/*` | Tienda de productos y créditos de socios |
| `reports` | `/reports/*` | Ingresos, asistencia, métricas |
| `support` | `/support/*` | Tickets de soporte (URGENT→LOW, BUG/BILLING/ACCESS/FEATURE) |
| `content` | `/content/*` | Noticias y tutoriales de la plataforma |
| `demo-requests` | `/demo-requests/*` | Solicitudes de demo desde la landing |
| `super-admin` | `/super-admin/*` | Panel SUPER_ADMIN: gimnasios, suscripciones, configuración |

---

## Rutas del Frontend

```
/                               → Landing pública (planes, features, CTA)
/inicio                         → Login
/gym/[gymSlug]/dashboard        → Panel principal del gimnasio
/gym/[gymSlug]/members          → Gestión de socios
/gym/[gymSlug]/members/[id]     → Perfil del socio (membresías, pagos, clases)
/gym/[gymSlug]/memberships      → Listado de membresías
/gym/[gymSlug]/plans            → Planes del gimnasio
/gym/[gymSlug]/payments/new     → Registrar pago
/gym/[gymSlug]/attendance       → Control de asistencia
/gym/[gymSlug]/classes          → Clases grupales
/gym/[gymSlug]/trainers         → Entrenadores
/gym/[gymSlug]/inventory        → Inventario
/gym/[gymSlug]/store            → Tienda (productos + categorías)
/gym/[gymSlug]/communications   → Comunicaciones internas
/gym/[gymSlug]/marketing        → Email marketing
/gym/[gymSlug]/reports          → Reportes
/gym/[gymSlug]/support          → Soporte / tickets
/gym/[gymSlug]/settings         → Configuración del gimnasio
/admin/dashboard                → Super-admin
/admin/gyms                     → Gestión de gimnasios
/admin/plans                    → Planes de suscripción SaaS
/admin/income                   → Ingresos de la plataforma
/admin/settings                 → Configuración global (branding, landing, footer)
```

---

## Modelos de Datos

```
Gym
├── Branch[]
├── User[] (GYM_OWNER, GYM_ADMIN, TRAINER, RECEPTIONIST)
├── Plan[]
│   └── Membership[]
│       ├── Payment[]
│       └── Member
│           ├── Attendance[]
│           ├── ClassEnrollment[] → Class → Trainer
│           └── MemberProductCredit[]
├── InventoryItem[]
│   └── Maintenance[]
├── EmailCampaign[] → EmailTemplate
├── Communication[]
├── Product[] → ProductCategory
│   └── ProductSaleItem[] → ProductSale
├── PlanStore[]
└── SupportTicket[]

# Plataforma global (sin gymId)
SubscriptionPlan
PlatformSettings (singleton id="1")
NewsPost
Tutorial
DemoRequest
RefreshToken
```

### Estados de Membresía

| Estado | Descripción |
|--------|-------------|
| `ACTIVE` | Vigente |
| `EXPIRED` | Vencida |
| `SUSPENDED` | Suspendida manualmente |
| `FROZEN` | Congelada (días no cuentan) |
| `CANCELLED` | Cancelada |

### Suscripción de Gimnasios (SaaS)

| Estado | Descripción |
|--------|-------------|
| `ACTIVE` | En servicio |
| `TRIAL` | Período de prueba |
| `GRACE` | Período de gracia post-vencimiento |
| `SUSPENDED` | Sin acceso |

---

## Notificaciones Automáticas (Cron)

Ambos jobs corren diariamente a las **9:00 AM UTC**:

- **Cumpleaños** (`sendBirthdayEmails`): busca socios activos con `birthDate` = hoy y envía email de felicitación con branding del gimnasio.
- **Recordatorio de vencimiento** (`sendExpiryReminders`): busca membresías `ACTIVE` con `endDate` entre mañana y pasado mañana; envía recordatorio con nombre del plan y fecha exacta.

---

## Seguridad

- **Helmet** — headers HTTP (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- **Rate limiting global** — `ThrottlerGuard` en todos los endpoints (10 req/60s), límites más estrictos en auth
- **JWT** — access token 1h, crash en boot si `JWT_SECRET` ausente
- **Refresh tokens** — almacenados como SHA-256 hash en DB, TTL 30 días, rotación automática, invalidados al cambiar contraseña
- **CORS** — allowlist estricta de orígenes permitidos
- **File uploads** — validación de MIME type + extensión, almacenado con extensión `.jpg` fija
- **DTOs** — `class-validator` en todos los endpoints (sin `body: any`)
- **SSRF** — validator `IsSafeUrl` bloquea IPs privadas (incluye `169.254.x.x`), protocolo forzado a `http(s)`
- **XSS** — `sanitize()` + `escapeHtml()` en emails; strips tags HTML y atributos `on*=`
- **AllExceptionsFilter** — oculta stack traces en producción
- **Docker** — container corre como usuario `appuser` (no root)
- **Contraseñas generadas** — `crypto.randomBytes()` (no `Math.random()`)

---

## Requisitos

- Node.js ≥ 20
- PostgreSQL 16 (o Docker)
- npm / pnpm

---

## Inicio Rápido

### Con Docker (recomendado)

```bash
cd back-1
cp .env.example .env       # editar variables
docker-compose up -d       # levanta API
```

### Desarrollo Local

**Backend:**
```bash
cd back-1
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev          # puerto 3001
```

**Frontend:**
```bash
cd front-1
cp .env.example .env.local  # editar NEXT_PUBLIC_API_URL
npm install
npm run dev                 # puerto 3000
```

---

## Variables de Entorno

### Backend (`back-1/.env`)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/gymosdb?schema=public"
POSTGRES_USER="gymuser"
POSTGRES_PASSWORD="gympassword"
POSTGRES_DB="gymosdb"

PORT=3001
NODE_ENV="production"

JWT_SECRET="secreto-aleatorio-seguro-minimo-32-chars"
JWT_EXPIRES_IN="1h"

FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:3001"

RESEND_API_KEY="re_your_key_here"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

### Frontend (`front-1/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
API_URL=http://localhost:3001/api/v1
JWT_SECRET=mismo-secreto-que-backend
```

---

## Comandos Útiles

```bash
# Backend
npm run start:dev       # modo desarrollo (watch)
npm run build           # compilar TypeScript
npm run db:migrate      # aplicar migraciones Prisma
npm run db:seed         # seed de datos iniciales
npm run db:studio       # Prisma Studio (GUI de base de datos)
npm run test            # tests unitarios

# Frontend
npm run dev             # modo desarrollo
npm run build           # build de producción
npm run lint            # ESLint
npm run test            # Vitest
```

---

## Estructura de Directorios

```
back-1/
├── prisma/
│   ├── schema.prisma         # modelos de datos
│   ├── migrations/           # historial de migraciones
│   └── seed.ts               # datos iniciales
├── src/
│   ├── app.module.ts
│   ├── main.ts               # bootstrap, Helmet, CORS, filtros globales
│   ├── auth/                 # JWT, login, registro, refresh
│   ├── common/
│   │   ├── decorators/       # @Roles(), @CurrentUser()
│   │   ├── enums/            # Role, etc.
│   │   ├── filters/          # AllExceptionsFilter
│   │   ├── guards/           # JwtAuthGuard, RolesGuard, TenantGuard
│   │   ├── interceptors/     # MoneyTransformInterceptor
│   │   ├── utils/            # proration, timezone
│   │   └── validators/       # IsSafeUrl
│   ├── [módulos]/            # gyms, members, plans, etc.
│   └── super-admin/

front-1/
├── src/
│   ├── app/
│   │   ├── page.tsx          # landing
│   │   ├── inicio/           # login
│   │   ├── gym/[gymSlug]/    # panel por gimnasio
│   │   └── admin/            # super-admin
│   ├── components/
│   │   ├── gym/              # sidebar, header
│   │   ├── admin/            # admin sidebar
│   │   ├── shared/           # KpiCard, StatusBadge, FooterBar
│   │   └── ui/               # shadcn components
│   ├── lib/
│   │   ├── api.ts            # cliente HTTP
│   │   ├── auth.ts           # helpers de autenticación
│   │   ├── sanitize.ts       # sanitización de inputs
│   │   └── input-validation.ts
│   └── types/
│       └── index.ts

uploads/
└── logos/                    # logos de gimnasios (archivos locales)
```

---

## Licencia

Propietario. Ver [LICENSE](LICENSE) para detalles.

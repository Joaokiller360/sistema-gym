# Sistema Gym — Plataforma de Gestión para Gimnasios

Sistema multi-tenant SaaS para gestión integral de gimnasios. Cada gimnasio opera en su propio espacio aislado (tenant), con soporte para múltiples sucursales.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| Backend | NestJS 11, Prisma 5, PostgreSQL 16 |
| Auth | JWT (passport-jwt) |
| Email | Resend |
| Contenedores | Docker / Docker Compose |

## Arquitectura

```
sistema-gym/
├── back-1/      # API REST — NestJS + Prisma
└── front-1/     # Interfaz — Next.js (App Router)
```

### Multi-tenancy

Cada gimnasio (`Gym`) tiene un `slug` único. Las rutas del frontend usan `/gym/[gymSlug]/*`. El backend filtra todos los recursos por `gymId` via un guard de tenant.

### Módulos del Backend

| Módulo | Descripción |
|--------|-------------|
| `auth` | Login, JWT, guards de rol |
| `gyms` | CRUD de gimnasios, logo upload |
| `branches` | Sucursales por gimnasio |
| `members` | Socios |
| `memberships` | Afiliaciones (activa, expirada, congelada, cancelada) |
| `plans` | Planes de membresía |
| `payments` | Pagos de socios (cash, card, transfer) |
| `attendance` | Registro de entradas/salidas |
| `trainers` | Entrenadores y disponibilidad |
| `classes` | Clases grupales + inscripciones |
| `inventory` | Equipamiento + mantenimiento |
| `communications` | Mensajería interna |
| `marketing` | Campañas de email y templates |
| `reports` | Reportes de ingresos y asistencia |
| `super-admin` | Gestión de planes de suscripción SaaS |

### Rutas del Frontend

```
/                          → Landing / login público
/gym/[gymSlug]/            → Panel del gimnasio
/admin/dashboard           → Super-admin
/admin/gyms                → Gestión de gimnasios
/admin/plans               → Planes de suscripción
/admin/income              → Ingresos de la plataforma
/admin/settings            → Configuración global
```

## Requisitos

- Node.js ≥ 20
- PostgreSQL 16 (o Docker)
- pnpm / npm

## Inicio rápido

### Con Docker (recomendado)

```bash
cd back-1
cp .env.example .env          # editar variables
docker-compose up -d          # levanta PostgreSQL + API
```

### Desarrollo local

**Backend:**
```bash
cd back-1
cp .env.example .env          # editar DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate deploy
npx prisma db seed            # datos iniciales
npm run start:dev             # puerto 3001
```

**Frontend:**
```bash
cd front-1
cp .env.example .env.local    # editar NEXT_PUBLIC_API_URL
npm install
npm run dev                   # puerto 3000
```

## Variables de entorno

### Backend (`back-1/.env`)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/gymosdb?schema=public"
JWT_SECRET="secreto-aleatorio-seguro"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="http://localhost:3000"
RESEND_API_KEY=""             # opcional — para emails
```

### Frontend (`front-1/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
API_URL=http://localhost:3001/api/v1
JWT_SECRET=mismo-secreto-que-backend
```

## Comandos útiles

```bash
# Backend
npm run start:dev      # modo desarrollo (watch)
npm run build          # compilar
npm run db:migrate     # aplicar migraciones
npm run db:seed        # seed de datos
npm run db:studio      # Prisma Studio (GUI DB)
npm run test           # tests unitarios

# Frontend
npm run dev            # modo desarrollo
npm run build          # build de producción
npm run lint           # ESLint
```

## Roles de usuario

| Rol | Acceso |
|-----|--------|
| `SUPER_ADMIN` | Plataforma completa |
| `GYM_OWNER` | Su gimnasio completo |
| `GYM_ADMIN` | Operaciones del gimnasio |
| `TRAINER` | Clases y socios asignados |
| `RECEPTIONIST` | Check-in, pagos, membresías |

## Modelos principales

```
Gym → Branch → Member → Membership → Payment
                      → Attendance
                      → ClassEnrollment → Class → Trainer
              InventoryItem → Maintenance
              EmailCampaign → EmailTemplate
```

## Suscripción de gimnasios (SaaS)

Cada `Gym` tiene `subscriptionPlan`, `subscriptionStatus` (`ACTIVE`, `GRACE`, `SUSPENDED`) y fecha de expiración. El super-admin gestiona los planes desde `/admin/plans`.

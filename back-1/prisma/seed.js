'use strict';

const { PrismaClient, Role, MembershipStatus, PaymentMethod, InventoryStatus, MaintenanceType } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function hash(password) {
  return bcrypt.hash(password, 10);
}

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  console.log('Seeding GymOS...');

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@gymos.com' },
    update: {},
    create: {
      email: 'superadmin@gymos.com',
      password: await hash('SuperAdmin123!'),
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
    },
  });
  console.log('Super admin created');

  const owner1 = await prisma.user.upsert({
    where: { email: 'owner@ironfit.com' },
    update: {},
    create: {
      email: 'owner@ironfit.com',
      password: await hash('Owner123!'),
      name: 'Carlos Mendoza',
      role: Role.GYM_OWNER,
    },
  });

  const owner2 = await prisma.user.upsert({
    where: { email: 'owner@flexgym.com' },
    update: {},
    create: {
      email: 'owner@flexgym.com',
      password: await hash('Owner123!'),
      name: 'Laura Sanchez',
      role: Role.GYM_OWNER,
    },
  });

  const gym1 = await prisma.gym.upsert({
    where: { slug: 'ironfit' },
    update: {},
    create: {
      name: 'Iron Fit',
      slug: 'ironfit',
      logoUrl: 'https://placehold.co/200x200?text=IronFit',
      isActive: true,
      subscriptionPlan: 'PRO',
      ownerId: owner1.id,
    },
  });

  await prisma.user.update({ where: { id: owner1.id }, data: { gymId: gym1.id } });

  const gym2 = await prisma.gym.upsert({
    where: { slug: 'flexgym' },
    update: {},
    create: {
      name: 'Flex Gym',
      slug: 'flexgym',
      logoUrl: 'https://placehold.co/200x200?text=FlexGym',
      isActive: true,
      subscriptionPlan: 'BASIC',
      ownerId: owner2.id,
    },
  });

  await prisma.user.update({ where: { id: owner2.id }, data: { gymId: gym2.id } });
  console.log('Gyms created');

  const branch1 = await prisma.branch.create({
    data: { name: 'Sede Centro', address: 'Av. Principal 123, Centro', gymId: gym1.id },
  });
  const branch2 = await prisma.branch.create({
    data: { name: 'Sede Norte', address: 'Calle Norte 456, Zona Norte', gymId: gym1.id },
  });
  const branch3 = await prisma.branch.create({
    data: { name: 'Sede Unica', address: 'Blvd. Sur 789, Zona Sur', gymId: gym2.id },
  });
  console.log('Branches created');

  await prisma.user.upsert({
    where: { email: 'admin@ironfit.com' },
    update: {},
    create: {
      email: 'admin@ironfit.com',
      password: await hash('Admin123!'),
      name: 'Ana Gomez',
      role: Role.GYM_ADMIN,
      gymId: gym1.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'recepcion@ironfit.com' },
    update: {},
    create: {
      email: 'recepcion@ironfit.com',
      password: await hash('Recep123!'),
      name: 'Pedro Ruiz',
      role: Role.RECEPTIONIST,
      gymId: gym1.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'trainer@ironfit.com' },
    update: {},
    create: {
      email: 'trainer@ironfit.com',
      password: await hash('Trainer123!'),
      name: 'Miguel Torres',
      role: Role.TRAINER,
      gymId: gym1.id,
    },
  });
  console.log('Staff users created');

  const planBasic = await prisma.plan.create({
    data: {
      name: 'Basico',
      price: 30,
      currency: 'USD',
      durationDays: 30,
      daysPerWeek: 3,
      benefits: ['Acceso sala de pesas', 'Vestuarios', 'Casillero'],
      isActive: true,
      isFeatured: false,
      gymId: gym1.id,
    },
  });

  const planPro = await prisma.plan.create({
    data: {
      name: 'Pro',
      price: 55,
      currency: 'USD',
      durationDays: 30,
      daysPerWeek: null,
      benefits: ['Acceso ilimitado', 'Clases grupales', 'Vestuarios', 'Casillero', 'Evaluacion fisica mensual'],
      isActive: true,
      isFeatured: true,
      gymId: gym1.id,
    },
  });

  const planAnual = await prisma.plan.create({
    data: {
      name: 'Anual',
      price: 480,
      currency: 'USD',
      durationDays: 365,
      daysPerWeek: null,
      benefits: ['Acceso ilimitado', 'Clases grupales', 'Vestuarios', 'Casillero', 'Evaluacion fisica mensual', '2 sesiones PT gratis'],
      isActive: true,
      isFeatured: false,
      gymId: gym1.id,
    },
  });

  const planFlex = await prisma.plan.create({
    data: {
      name: 'Flex Mensual',
      price: 25,
      currency: 'USD',
      durationDays: 30,
      daysPerWeek: 5,
      benefits: ['Acceso sala principal', 'Duchas'],
      isActive: true,
      isFeatured: true,
      gymId: gym2.id,
    },
  });
  console.log('Plans created');

  const trainer1 = await prisma.trainer.create({
    data: {
      firstName: 'Miguel',
      lastName: 'Torres',
      email: 'miguel.torres@ironfit.com',
      phone: '+1-555-0101',
      specialty: 'Musculacion y Fuerza',
      isActive: true,
      availability: { mon: '08:00-18:00', tue: '08:00-18:00', wed: '08:00-18:00', thu: '08:00-18:00', fri: '08:00-16:00' },
      gymId: gym1.id,
      branchId: branch1.id,
    },
  });

  const trainer2 = await prisma.trainer.create({
    data: {
      firstName: 'Sofia',
      lastName: 'Vargas',
      email: 'sofia.vargas@ironfit.com',
      phone: '+1-555-0102',
      specialty: 'CrossFit y Cardio',
      isActive: true,
      availability: { mon: '07:00-15:00', wed: '07:00-15:00', fri: '07:00-15:00', sat: '08:00-12:00' },
      gymId: gym1.id,
      branchId: branch1.id,
    },
  });

  const trainer3 = await prisma.trainer.create({
    data: {
      firstName: 'Roberto',
      lastName: 'Leon',
      email: 'roberto.leon@ironfit.com',
      phone: '+1-555-0103',
      specialty: 'Yoga y Stretching',
      isActive: true,
      availability: { tue: '09:00-17:00', thu: '09:00-17:00', sat: '09:00-13:00' },
      gymId: gym1.id,
      branchId: branch2.id,
    },
  });
  console.log('Trainers created');

  const class1 = await prisma.class.create({
    data: {
      name: 'CrossFit Matutino',
      description: 'Entrenamiento funcional de alta intensidad',
      maxCapacity: 15,
      schedule: { days: ['mon', 'wed', 'fri'], time: '07:00', duration: 60 },
      isActive: true,
      gymId: gym1.id,
      branchId: branch1.id,
      trainerId: trainer2.id,
    },
  });

  const class2 = await prisma.class.create({
    data: {
      name: 'Yoga Flow',
      description: 'Yoga dinamico para todos los niveles',
      maxCapacity: 20,
      schedule: { days: ['tue', 'thu'], time: '09:00', duration: 75 },
      isActive: true,
      gymId: gym1.id,
      branchId: branch1.id,
      trainerId: trainer3.id,
    },
  });

  const class3 = await prisma.class.create({
    data: {
      name: 'Spinning',
      description: 'Ciclismo indoor de alta intensidad',
      maxCapacity: 12,
      schedule: { days: ['mon', 'wed', 'fri'], time: '18:30', duration: 50 },
      isActive: true,
      gymId: gym1.id,
      branchId: branch2.id,
      trainerId: trainer2.id,
    },
  });
  console.log('Classes created');

  const membersData = [
    { firstName: 'Alejandro', lastName: 'Garcia',     email: 'alex.garcia@email.com',     phone: '+1-555-1001', branchId: branch1.id },
    { firstName: 'Maria',     lastName: 'Lopez',      email: 'maria.lopez@email.com',      phone: '+1-555-1002', branchId: branch1.id },
    { firstName: 'Juan',      lastName: 'Martinez',   email: 'juan.martinez@email.com',    phone: '+1-555-1003', branchId: branch1.id },
    { firstName: 'Valentina', lastName: 'Rodriguez',  email: 'vale.rodriguez@email.com',   phone: '+1-555-1004', branchId: branch1.id },
    { firstName: 'Diego',     lastName: 'Hernandez',  email: 'diego.hernandez@email.com',  phone: '+1-555-1005', branchId: branch2.id },
    { firstName: 'Camila',    lastName: 'Gonzalez',   email: 'camila.gonzalez@email.com',  phone: '+1-555-1006', branchId: branch2.id },
    { firstName: 'Andres',    lastName: 'Perez',      email: 'andres.perez@email.com',     phone: '+1-555-1007', branchId: branch2.id },
    { firstName: 'Isabella',  lastName: 'Sanchez',    email: 'isabella.sanchez@email.com', phone: '+1-555-1008', branchId: branch1.id },
    { firstName: 'Sebastian', lastName: 'Ramirez',    email: 'seba.ramirez@email.com',     phone: '+1-555-1009', branchId: branch1.id },
    { firstName: 'Lucia',     lastName: 'Flores',     email: 'lucia.flores@email.com',     phone: '+1-555-1010', branchId: branch2.id },
  ];

  const members = await Promise.all(
    membersData.map(m =>
      prisma.member.create({
        data: { ...m, gymId: gym1.id, birthDate: new Date('1995-06-15') },
      }),
    ),
  );

  const members2Data = [
    { firstName: 'Paula', lastName: 'Jimenez', email: 'paula.jimenez@email.com', phone: '+1-555-2001' },
    { firstName: 'Tomas', lastName: 'Castro',  email: 'tomas.castro@email.com',  phone: '+1-555-2002' },
    { firstName: 'Elena', lastName: 'Morales', email: 'elena.morales@email.com', phone: '+1-555-2003' },
  ];

  const members2 = await Promise.all(
    members2Data.map(m =>
      prisma.member.create({
        data: { ...m, gymId: gym2.id, branchId: branch3.id },
      }),
    ),
  );
  console.log('Members created');

  const membershipScenarios = [
    { member: members[0], plan: planPro,   status: MembershipStatus.ACTIVE,    startOffset: -15, amount: 55,  method: PaymentMethod.CARD },
    { member: members[1], plan: planBasic, status: MembershipStatus.ACTIVE,    startOffset: -10, amount: 30,  method: PaymentMethod.CASH },
    { member: members[2], plan: planAnual, status: MembershipStatus.ACTIVE,    startOffset: -60, amount: 480, method: PaymentMethod.TRANSFER },
    { member: members[3], plan: planPro,   status: MembershipStatus.ACTIVE,    startOffset: -5,  amount: 55,  method: PaymentMethod.CARD },
    { member: members[4], plan: planBasic, status: MembershipStatus.SUSPENDED, startOffset: -20, amount: 30,  method: PaymentMethod.CASH },
    { member: members[5], plan: planPro,   status: MembershipStatus.FROZEN,    startOffset: -30, amount: 55,  method: PaymentMethod.CARD },
    { member: members[6], plan: planBasic, status: MembershipStatus.EXPIRED,   startOffset: -45, amount: 30,  method: PaymentMethod.CASH },
    { member: members[7], plan: planPro,   status: MembershipStatus.ACTIVE,    startOffset: -2,  amount: 55,  method: PaymentMethod.CARD },
    { member: members[8], plan: planAnual, status: MembershipStatus.ACTIVE,    startOffset: -90, amount: 480, method: PaymentMethod.TRANSFER },
    { member: members[9], plan: planBasic, status: MembershipStatus.CANCELLED, startOffset: -50, amount: 30,  method: PaymentMethod.CASH },
  ];

  for (const s of membershipScenarios) {
    const startDate = daysAgo(-s.startOffset);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + s.plan.durationDays);

    const membership = await prisma.membership.create({
      data: {
        startDate,
        endDate,
        status: s.status,
        gymId: gym1.id,
        memberId: s.member.id,
        planId: s.plan.id,
        branchId: s.member.branchId || branch1.id,
      },
    });

    await prisma.payment.create({
      data: {
        amount: s.amount,
        currency: 'USD',
        method: s.method,
        gymId: gym1.id,
        memberId: s.member.id,
        membershipId: membership.id,
        branchId: s.member.branchId || branch1.id,
      },
    });
  }

  for (const m of members2) {
    const startDate = daysAgo(10);
    const endDate = daysFromNow(20);
    const membership = await prisma.membership.create({
      data: {
        startDate,
        endDate,
        status: MembershipStatus.ACTIVE,
        gymId: gym2.id,
        memberId: m.id,
        planId: planFlex.id,
        branchId: branch3.id,
      },
    });
    await prisma.payment.create({
      data: {
        amount: 25,
        currency: 'USD',
        method: PaymentMethod.CASH,
        gymId: gym2.id,
        memberId: m.id,
        membershipId: membership.id,
        branchId: branch3.id,
      },
    });
  }
  console.log('Memberships & payments created');

  const activeMembers = members.filter((_, i) => [0, 1, 2, 3, 7, 8].includes(i));
  for (let day = 6; day >= 0; day--) {
    for (const member of activeMembers.slice(0, 4)) {
      const checkIn = daysAgo(day);
      checkIn.setHours(8 + Math.floor(Math.random() * 4), 0, 0, 0);
      const checkOut = new Date(checkIn);
      checkOut.setHours(checkOut.getHours() + 1 + Math.floor(Math.random() * 2));

      await prisma.attendance.create({
        data: {
          checkIn,
          checkOut,
          gymId: gym1.id,
          memberId: member.id,
          branchId: member.branchId || branch1.id,
        },
      });
    }
  }
  console.log('Attendance records created');

  const enrollments = [
    { classId: class1.id, memberIds: [members[0].id, members[1].id, members[3].id, members[7].id] },
    { classId: class2.id, memberIds: [members[1].id, members[2].id, members[5].id] },
    { classId: class3.id, memberIds: [members[4].id, members[6].id, members[8].id] },
  ];

  for (const e of enrollments) {
    for (const memberId of e.memberIds) {
      await prisma.classEnrollment.create({
        data: {
          gymId: gym1.id,
          classId: e.classId,
          memberId,
          attended: Math.random() > 0.3,
        },
      });
    }
  }
  console.log('Class enrollments created');

  const inventoryItems = [
    { name: 'Barra Olimpica 20kg',     description: 'Barra olimpica estandar',          quantity: 10, status: InventoryStatus.ACTIVE },
    { name: 'Mancuernas 5-50kg',       description: 'Set completo de mancuernas',        quantity: 1,  status: InventoryStatus.ACTIVE },
    { name: 'Cinta Caminadora Pro',    description: 'Trotadora comercial NordicTrack',   quantity: 8,  status: InventoryStatus.ACTIVE },
    { name: 'Bicicleta Spinning',      description: 'Bike de spinning Keiser M3',        quantity: 12, status: InventoryStatus.ACTIVE },
    { name: 'Rack Sentadillas',        description: 'Rack de sentadillas con jaula',     quantity: 4,  status: InventoryStatus.ACTIVE },
    { name: 'Cinta Caminadora Antigua',description: 'Modelo antiguo, en reparacion',    quantity: 2,  status: InventoryStatus.MAINTENANCE },
  ];

  for (const item of inventoryItems) {
    const inv = await prisma.inventoryItem.create({
      data: { ...item, gymId: gym1.id, branchId: branch1.id, purchaseDate: daysAgo(365) },
    });

    if (item.status === InventoryStatus.MAINTENANCE) {
      await prisma.maintenance.create({
        data: {
          type: MaintenanceType.CORRECTIVE,
          description: 'Reemplazo de banda de rodaje',
          responsibleName: 'Tecnico Externo',
          scheduledAt: daysFromNow(3),
          gymId: gym1.id,
          inventoryItemId: inv.id,
        },
      });
    }
  }
  console.log('Inventory created');

  const template = await prisma.emailTemplate.create({
    data: {
      name: 'Bienvenida',
      subject: 'Bienvenido a Iron Fit, {{nombre}}!',
      body: '<h1>Bienvenido {{nombre}}</h1><p>Tu membresia {{plan}} esta activa. A entrenar!</p>',
      isActive: true,
      gymId: gym1.id,
    },
  });

  await prisma.emailCampaign.create({
    data: {
      name: 'Campana Mayo 2026',
      status: 'SENT',
      segment: { plan: 'Pro', status: 'ACTIVE' },
      sentAt: daysAgo(5),
      metrics: { sent: 4, opened: 3, clicked: 2, unsubscribed: 0 },
      gymId: gym1.id,
      templateId: template.id,
    },
  });
  console.log('Email templates & campaigns created');

  await prisma.communication.create({
    data: {
      subject: 'Mantenimiento programado - Sede Norte',
      body: 'Estimados socios, el proximo lunes la Sede Norte estara cerrada por mantenimiento de 08:00 a 12:00.',
      recipientIds: members.map(m => m.id),
      gymId: gym1.id,
    },
  });
  console.log('Communications created');

  console.log('\nSeed completado.\n');
  console.log('Credenciales de acceso:');
  console.log('SUPER_ADMIN   superadmin@gymos.com    / SuperAdmin123!');
  console.log('GYM_OWNER     owner@ironfit.com        / Owner123!      (Iron Fit)');
  console.log('GYM_OWNER     owner@flexgym.com        / Owner123!      (Flex Gym)');
  console.log('GYM_ADMIN     admin@ironfit.com        / Admin123!');
  console.log('RECEPTIONIST  recepcion@ironfit.com    / Recep123!');
  console.log('TRAINER       trainer@ironfit.com      / Trainer123!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

'use strict';

const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function hash(password) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('Seeding...');

  // Super Admin
  await prisma.user.upsert({
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

  // Gym 1 owner
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

  // Gym 2 owner
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

  // Gym 1
  const gym1 = await prisma.gym.upsert({
    where: { slug: 'ironfit' },
    update: {},
    create: {
      name: 'Iron Fit',
      slug: 'ironfit',
      isActive: true,
      subscriptionPlan: 'PRO',
      ownerId: owner1.id,
    },
  });
  await prisma.user.update({ where: { id: owner1.id }, data: { gymId: gym1.id } });

  // Gym 2
  const gym2 = await prisma.gym.upsert({
    where: { slug: 'flexgym' },
    update: {},
    create: {
      name: 'Flex Gym',
      slug: 'flexgym',
      isActive: true,
      subscriptionPlan: 'BASIC',
      ownerId: owner2.id,
    },
  });
  await prisma.user.update({ where: { id: owner2.id }, data: { gymId: gym2.id } });
  console.log('Gyms created');

  // 5 members gym1
  const gym1Members = [
    { firstName: 'Alejandro', lastName: 'Garcia',    email: 'alex.garcia@email.com',    phone: '+1-555-1001' },
    { firstName: 'Maria',     lastName: 'Lopez',     email: 'maria.lopez@email.com',     phone: '+1-555-1002' },
    { firstName: 'Juan',      lastName: 'Martinez',  email: 'juan.martinez@email.com',   phone: '+1-555-1003' },
    { firstName: 'Valentina', lastName: 'Rodriguez', email: 'vale.rodriguez@email.com',  phone: '+1-555-1004' },
    { firstName: 'Diego',     lastName: 'Hernandez', email: 'diego.hernandez@email.com', phone: '+1-555-1005' },
  ];

  for (const m of gym1Members) {
    await prisma.member.create({ data: { ...m, gymId: gym1.id } });
  }
  console.log('Gym1 members created');

  // 5 members gym2
  const gym2Members = [
    { firstName: 'Paula',  lastName: 'Jimenez', email: 'paula.jimenez@email.com', phone: '+1-555-2001' },
    { firstName: 'Tomas',  lastName: 'Castro',  email: 'tomas.castro@email.com',  phone: '+1-555-2002' },
    { firstName: 'Elena',  lastName: 'Morales', email: 'elena.morales@email.com', phone: '+1-555-2003' },
    { firstName: 'Carlos', lastName: 'Vega',    email: 'carlos.vega@email.com',   phone: '+1-555-2004' },
    { firstName: 'Sofia',  lastName: 'Reyes',   email: 'sofia.reyes@email.com',   phone: '+1-555-2005' },
  ];

  for (const m of gym2Members) {
    await prisma.member.create({ data: { ...m, gymId: gym2.id } });
  }
  console.log('Gym2 members created');

  console.log('\nSeed completado.');
  console.log('superadmin@gymos.com  / SuperAdmin123!');
  console.log('owner@ironfit.com     / Owner123!');
  console.log('owner@flexgym.com     / Owner123!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

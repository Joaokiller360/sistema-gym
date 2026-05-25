'use strict';

const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { Resend } = require('resend');
const crypto = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

function generatePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  return Array.from(crypto.randomBytes(length))
    .map(b => chars[b % chars.length])
    .join('');
}

async function sendCredentials(email, password) {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject: 'GymOS — Credenciales Super Admin',
    html: `
      <h2>Credenciales de acceso</h2>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Password:</strong> ${password}</p>
      <p>Cambia tu contraseña tras el primer inicio de sesión.</p>
    `,
  });
}

async function main() {
  const email = process.argv[2];
  if (!email || !email.includes('@')) {
    console.error('Usage: node prisma/seed.js <email>');
    process.exit(1);
  }

  const password = generatePassword();

  await prisma.user.upsert({
    where: { email },
    update: { password: await bcrypt.hash(password, 10) },
    create: {
      email,
      password: await bcrypt.hash(password, 10),
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
    },
  });

  console.log(`Super admin creado: ${email}`);
  console.log('Enviando credenciales al correo...');

  await sendCredentials(email, password);
  console.log('Correo enviado.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

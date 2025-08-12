
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Upsert admin
  await prisma.user.upsert({
    where: { email: 'iewedairo@capplc.com' },
    update: {},
    create: {
      email: 'iewedairo@capplc.com',
      name: 'isreal ewedairo',
      department: 'IT',
      role: 'ADMIN',
      isActive: true,
    },
  });

  // Upsert staff
  await prisma.user.upsert({
    where: { email: 'oagboibin@capplc.com' },
    update: {},
    create: {
      email: 'oagboibin@capplc.com',
      name: 'olagoke agboibon',
      department: 'IT',
      role: 'STAFF',
      isActive: true,
    },
  });

  console.log('Seeded admin and staff users.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

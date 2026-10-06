const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function test() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Create a test user with status = PENDING
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        status: 'PENDING',
        isActive: true,
      },
    });

    console.log('Created user:', JSON.stringify(user, null, 2));

    // Retrieve the user back
    const retrieved = await prisma.user.findUnique({
      where: { id: user.id },
    });

    console.log('Retrieved user:', JSON.stringify(retrieved, null, 2));
    console.log('Status matches:', retrieved.status === 'PENDING');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

test().catch(console.error);

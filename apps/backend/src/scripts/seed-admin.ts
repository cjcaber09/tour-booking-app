import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/password';

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password || !name) {
    console.error('Usage: npm run seed:admin --workspace=apps/backend -- <email> <password> "<name>"');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.admin.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`Admin ready: ${admin.email} (${admin.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { normalizeEmail } from '../lib/customers';

// One-off backfill for the resolveCustomer case-insensitive-email fix: normalizeEmail() only
// prevents *new* duplicates going forward. Any Customer row already stored with a non-lowercase
// email needs fixing here too, otherwise its next booking would fail to findUnique() against the
// normalized email and silently create a second, orphaned row for the same person.
// Run once via: npm run normalize:customer-emails --workspace=apps/backend
async function main() {
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'asc' } });

  const groups = new Map<string, typeof customers>();
  for (const customer of customers) {
    const key = normalizeEmail(customer.email);
    const group = groups.get(key);
    if (group) {
      group.push(customer);
    } else {
      groups.set(key, [customer]);
    }
  }

  let normalized = 0;
  let merged = 0;
  let bookingsReassigned = 0;

  for (const [email, group] of groups) {
    if (group.length === 1) {
      const [customer] = group;
      if (customer.email !== email) {
        await prisma.customer.update({ where: { id: customer.id }, data: { email } });
        normalized += 1;
      }
      continue;
    }

    // Oldest row is canonical — matches resolveCustomer's own "first write wins" precedent
    // for a shared Customer record (see resolveCustomer's comment in lib/bookings.ts).
    const [canonical, ...duplicates] = group;
    const duplicateIds = duplicates.map((d) => d.id);

    await prisma.$transaction(async (tx) => {
      const reassign = await tx.booking.updateMany({
        where: { customerId: { in: duplicateIds } },
        data: { customerId: canonical.id },
      });
      bookingsReassigned += reassign.count;

      await tx.customer.deleteMany({ where: { id: { in: duplicateIds } } });

      if (canonical.email !== email) {
        await tx.customer.update({ where: { id: canonical.id }, data: { email } });
      }
    });

    merged += duplicates.length;
    console.log(
      `merged ${duplicates.length} duplicate(s) of "${email}" into ${canonical.id}` +
        ` (${duplicates.map((d) => d.id).join(', ')})`,
    );
  }

  console.log(`done: ${normalized} email(s) lowercased, ${merged} duplicate row(s) merged, ${bookingsReassigned} booking(s) reassigned`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

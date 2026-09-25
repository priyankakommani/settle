import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isNull } from 'drizzle-orm';
import { db, closeDb } from '../index.js';
import { employees, policyConfig } from '../schema/index.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { hashPassword } from '../../lib/password.js';
import { EMPLOYEE_SEED } from './employees.data.js';
import { POLICY_SEED } from './policy.data.js';
import { tripRepository } from '../../repositories/trip.repository.js';
import { ingestService } from '../../services/ingest.service.js';

/**
 * Idempotent seed. Run with `pnpm db:seed` (after `db:migrate`).
 *
 * The first run also loads the demo inbox into a draft trip
 * for Chaitanya Reddy. That makes the product demonstrable immediately while
 * preserving the actual claimant workflow (the trip is not auto-submitted).
 */
async function seed() {
  logger.info('seed.start');

  await db
    .insert(employees)
    .values(EMPLOYEE_SEED)
    .onConflictDoNothing({ target: employees.empCode });
  logger.info({ count: EMPLOYEE_SEED.length }, 'seed.employees');

  await db
    .insert(policyConfig)
    .values(POLICY_SEED)
    .onConflictDoNothing({ target: [policyConfig.key, policyConfig.cityTier] });
  logger.info({ count: POLICY_SEED.length }, 'seed.policy_config');

  // Give every not-yet-registered employee the default password so sign-in
  // works out of the box. Anyone can still self-register on a DB where the
  // hashes are still null.
  const unregistered = await db
    .update(employees)
    .set({ passwordHash: await hashPassword(env.SEED_DEFAULT_PASSWORD) })
    .where(isNull(employees.passwordHash))
    .returning({ empCode: employees.empCode });
  if (unregistered.length > 0) {
    logger.info(
      { count: unregistered.length, password: env.SEED_DEFAULT_PASSWORD },
      'seed.default_passwords',
    );
  }

  await seedDemoTrip();
  logger.info('seed.done');
}

/**
 * Seed exactly once, and only into an otherwise empty claim database. This
 * avoids mixing a fixture into an organisation that has started real work.
 */
async function seedDemoTrip(): Promise<void> {
  const existingTrips = await tripRepository.listAll();
  if (existingTrips.length > 0) {
    logger.info({ count: existingTrips.length }, 'seed.demo_trip.skipped_existing_claims');
    return;
  }

  // The demo inbox is kept out of git; without it, skip the fixture trip.
  const packDir = join(process.cwd(), 'seed-data', 'demo');
  if (!existsSync(packDir)) {
    logger.info({ packDir }, 'seed.demo_trip.skipped_no_demo_data');
    return;
  }

  const travelRequestId = await tripRepository.nextTravelRequestId();
  const trip = await tripRepository.create({
    travelRequestId,
    employeeCode: 'AC-4471',
    purpose: 'Vertex account review and plant visit',
    originCity: 'Pune',
    destCity: 'Bengaluru',
    destTier: 'TIER_1',
    isInternational: 'false',
    startDate: '2026-06-16',
    endDate: '2026-06-20',
    fullDays: 5,
    estimatedCost: '48000.00',
    advanceRequested: '20000.00',
  });

  const emailDir = join(packDir, 'sample_emails');
  const receiptDir = join(packDir, 'receipts');
  const emailNames = (await readdir(emailDir)).filter((name) => name.endsWith('.eml')).sort();
  const receiptNames = (await readdir(receiptDir)).filter((name) => /\.png$/i.test(name)).sort();

  const files = await Promise.all([
    ...emailNames.map(async (filename) => ({
      filename,
      buffer: await readFile(join(emailDir, filename)),
      mime: 'message/rfc822',
    })),
    ...receiptNames.map(async (filename) => ({
      filename,
      buffer: await readFile(join(receiptDir, filename)),
      mime: 'image/png',
    })),
  ]);

  const result = await ingestService.ingestUpload(trip.id, trip.employeeCode, files);
  logger.info(
    {
      travelRequestId,
      documents: result.documents.length,
      claimLines: result.claimLines.length,
      duplicatesDropped: result.duplicatesDropped,
    },
    'seed.demo_trip.created',
  );
}

seed()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error({ err }, 'seed.failed');
    await closeDb();
    process.exit(1);
  });

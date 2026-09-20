import { getAllRawRecords } from '@core/db/backupRepository';
import { getAllQuarantineEntries } from '@core/db/quarantineStore';

/**
 * Decides whether wiping this device for an update is safe.
 *
 * The offline balance is derived from encrypted amounts, so it cannot be
 * summed at sign-in, where no key is available. This therefore checks the
 * plaintext columns only, and errs on the side of keeping data:
 *
 *   hasUnsynced  - a transfer not yet accepted by the server
 *   mayHoldFunds - any ledger entry that counts toward the balance, so the
 *                  balance cannot be shown to be zero
 *
 * A device that signed out normally has neither: logout is refused while
 * funds or unsynced transfers remain, and it clears the ledger. Both the
 * live store and every quarantined session are inspected, because a wipe
 * would otherwise strand a quarantined session's unsynced transfers.
 */

const COUNTABLE_STATUSES = ['PENDING', 'SUCCESS', 'SYNCED'];

export async function getUpdateBlockers() {
  try {
    const [liveRecords, quarantineEntries] = await Promise.all([
      getAllRawRecords(),
      getAllQuarantineEntries(),
    ]);

    const records = [
      ...(liveRecords ?? []),
      ...quarantineEntries.flatMap((entry) => entry.rawRecords ?? []),
    ];

    const hasUnsynced = records.some(
      (record) => record.synced === false && record.type === 'TRANSFER'
    );
    const mayHoldFunds = records.some(
      (record) =>
        COUNTABLE_STATUSES.includes(record.status) &&
        (record.entryType === 'CREDIT' || record.entryType === 'DEBIT')
    );

    return { blocked: hasUnsynced || mayHoldFunds, hasUnsynced, mayHoldFunds, unknown: false };
  } catch (err) {
    // If the device cannot be inspected, it must not be wiped.
    console.warn('[updateGuard] Could not inspect local data:', err);
    return { blocked: true, hasUnsynced: false, mayHoldFunds: false, unknown: true };
  }
}

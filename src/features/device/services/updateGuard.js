// Decides whether wiping the device for an update is safe.
import { getAllRawRecords } from '@core/db/backupRepository';
import { getAllQuarantineEntries } from '@core/db/quarantineStore';

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
    console.warn('[updateGuard] Could not inspect local data:', err);
    return { blocked: true, hasUnsynced: false, mayHoldFunds: false, unknown: true };
  }
}

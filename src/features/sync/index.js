// Public exports of the sync feature.
export { getSyncTags, registerBackgroundSync } from './services/backgroundSync.js';
export {
  getSyncBadgeCount,
  startAutoSync,
  stopAutoSync,
  syncPendingTransactions,
  syncPendingTransactionsGuarded,
} from './services/syncService.js';

import { useCallback, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Button, Modal } from '@shared/components/ui';
import { PAYMENT_LIMITS } from '@features/wallet/utils/paymentRequest';
import { useUpdateReminder } from '@features/device/hooks/useUpdateReminder';
import { usePeriodicSync } from '@features/sync/hooks/usePeriodicSync';
import { useSessionExpiry } from '@features/auth/hooks/useSessionExpiry';
import AppLockGate from '@app/router/guards/AppLockGate.jsx';
import AppRouter from '@app/router/AppRouter.jsx';

/**
 * Application shell: routing, app-wide gates, and the two reminders that can
 * surface on any screen.
 *
 * Everything that used to live here directly — the guards, the route table,
 * the route transition, the periodic sync loop, the update poll and the
 * session-expiry listener — now sits in its own module. This file only wires
 * them together.
 */
function App() {
  const [syncReminder, setSyncReminder] = useState(null);

  const handleOfflineReminder = useCallback((pendingCount) => {
    setSyncReminder({ pendingCount });
  }, []);

  const update = useUpdateReminder();

  useSessionExpiry();
  usePeriodicSync({ onOfflineReminder: handleOfflineReminder });

  const isAtOfflineLimit =
    (syncReminder?.pendingCount ?? 0) >= PAYMENT_LIMITS.MAX_OFFLINE_PENDING;

  return (
    <BrowserRouter>
      <AppLockGate />
      <AppRouter />

      <Modal
        open={update.isAvailable}
        icon="⬆️"
        title="Update available"
        onClose={update.dismiss}
        actions={<Button onClick={update.dismiss}>OK</Button>}
      >
        A new version of SyncPoint is ready. To update safely, sync any pending
        transactions, sign out, and update from the sign-in screen. We will remind you
        again shortly if you are not ready yet.
      </Modal>

      <Modal
        open={syncReminder !== null}
        icon="📡"
        title="You have pending transactions"
        onClose={() => setSyncReminder(null)}
        actions={<Button onClick={() => setSyncReminder(null)}>OK</Button>}
      >
        You have {syncReminder?.pendingCount} transaction
        {syncReminder?.pendingCount === 1 ? '' : 's'} waiting to sync. Connect to the
        internet soon so they do not get stuck.
        {isAtOfflineLimit &&
          ' You have reached the maximum offline limit — you must go online to sync before creating any new transactions.'}
      </Modal>
    </BrowserRouter>
  );
}

export default App;
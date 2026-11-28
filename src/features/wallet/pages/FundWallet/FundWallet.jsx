// Moves funds into the offline wallet or back to the online account.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AmountField, Button, InfoBanner, Modal, PinField, TextField } from '@shared/components/ui';
import { AppShell, PageHeader } from '@shared/components/layout';
import { NoInternetModal } from '@shared/components/feedback';
import { useNetwork } from '@shared/hooks/useNetwork';
import { formatNaira } from '@shared/utils';
import { fundOfflineWallet, transferToOnline } from '@features/wallet/api/walletApi';
import { saveLedgerTransaction } from '@core/db/ledgerRepository';
import { calculateOfflineBalance } from '@features/wallet/services/walletLedger';
import { addNotification } from '@features/wallet/services/notificationStore';
import { getFullName, readIdentity } from '@features/wallet/utils/identity';
import SegmentedTabs from '@features/wallet/components/SegmentedTabs/SegmentedTabs.jsx';
import styles from './FundWallet.module.css';

const MINIMUM_AMOUNT = 100;

const Direction = {
  TO_OFFLINE: 'offline',
  TO_ONLINE: 'online',
};

const TABS = [
  { value: Direction.TO_OFFLINE, label: 'Offline wallet', description: 'Top up from online' },
  { value: Direction.TO_ONLINE, label: 'Online account', description: 'Move to online' },
];

const DIRECTION_CONFIG = {
  [Direction.TO_OFFLINE]: {
    title: 'Fund offline wallet',
    submitLabel: 'Fund offline wallet',
    placeholder: 'e.g. Weekly wallet top-up',
    request: fundOfflineWallet,
    ledgerType: 'FUND',
    entryType: 'CREDIT',
    defaultDescription: 'Offline wallet funding',
    notificationType: 'fund',
    notificationTitle: 'Offline wallet funded',
  },
  [Direction.TO_ONLINE]: {
    title: 'Transfer to online account',
    submitLabel: 'Transfer to online',
    placeholder: 'e.g. Moving funds back online',
    request: transferToOnline,
    ledgerType: 'TRANSFER_TO_ONLINE',
    entryType: 'DEBIT',
    defaultDescription: 'Transfer to online account',
    notificationType: 'transfer',
    notificationTitle: 'Transfer to online account',
  },
};

const EMPTY_FORM = { amount: '', description: '', transactionPin: '' };

function generateRequestRef() {
  return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function FundWallet() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOffline } = useNetwork();

  const [direction, setDirection] = useState(() =>
    location.state?.fromLogout || location.state?.autoTab === Direction.TO_ONLINE
      ? Direction.TO_ONLINE
      : Direction.TO_OFFLINE
  );

  const [currentBalance, setCurrentBalance] = useState(0);
  const [isBalanceLoaded, setIsBalanceLoaded] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNoInternet, setShowNoInternet] = useState(false);
  const [dialog, setDialog] = useState(null);

  const [requestRef, setRequestRef] = useState(null);

  const config = DIRECTION_CONFIG[direction];
  const isFundingOffline = direction === Direction.TO_OFFLINE;

  useEffect(() => {
    let cancelled = false;

    calculateOfflineBalance()
      .then((balance) => {
        if (!cancelled) setCurrentBalance(balance);
      })
      .catch((err) => console.error('[FundWallet] Balance load failed:', err))
      .finally(() => {
        if (!cancelled) setIsBalanceLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function handleDirectionChange(next) {
    setDirection(next);
    setFormData(EMPTY_FORM);
    setErrors({});
    setRequestRef(null);
  }

  function validate() {
    const amount = Number(formData.amount);
    const validationErrors = {};

    if (!formData.amount || Number.isNaN(amount) || amount <= 0) {
      validationErrors.amount = 'Enter a valid amount';
    } else if (amount < MINIMUM_AMOUNT) {
      validationErrors.amount = `Minimum transfer amount is ${formatNaira(MINIMUM_AMOUNT)}`;
    } else if (!isFundingOffline && amount > currentBalance) {
      validationErrors.amount = `Insufficient offline balance. You have ${formatNaira(currentBalance)}`;
    }

    if (!formData.transactionPin || formData.transactionPin.length < 4) {
      validationErrors.transactionPin = 'Enter your 4-digit transaction PIN';
    }

    return validationErrors;
  }

  function buildSuccessMessage(amount, newBalance) {
    if (isFundingOffline) {
      return `${formatNaira(amount)} has been added to your offline wallet. New balance: ${formatNaira(newBalance)}`;
    }
    if (newBalance === 0) {
      return `${formatNaira(amount)} transferred. Your offline wallet is now empty — you can complete logout from the dashboard.`;
    }
    return `${formatNaira(amount)} transferred to your online account. Remaining offline balance: ${formatNaira(newBalance)}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      setShowNoInternet(true);
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    const reference = requestRef ?? generateRequestRef();
    if (!requestRef) setRequestRef(reference);

    try {
      const amount = Number(formData.amount);
      const description = formData.description || null;

      await config.request({
        amount,
        description,
        transactionPin: formData.transactionPin,
        requestRef: reference,
      });

      const walletId = readIdentity('walletId', null);
      const phoneNumber = readIdentity('phoneNumber', null);
      const fullName = getFullName();

      await saveLedgerTransaction({
        transactionRef: reference,
        requestRef: reference,
        type: config.ledgerType,
        entryType: config.entryType,
        status: 'SUCCESS',
        amount,
        currency: 'NGN',
        description: description || config.defaultDescription,
        senderWalletId: walletId,
        senderPhone: phoneNumber,
        senderName: fullName,
        receiverWalletId: walletId,
        receiverPhone: phoneNumber,
        receiverName: fullName,
        createdAt: new Date().toISOString(),
      });

      const newBalance = await calculateOfflineBalance();
      setCurrentBalance(newBalance);

      window.dispatchEvent(
        new CustomEvent('balance-updated', { detail: { balance: newBalance } })
      );

      addNotification({
        type: config.notificationType,
        title: config.notificationTitle,
        desc: isFundingOffline
          ? `${fullName} funded offline wallet with ${formatNaira(amount)}`
          : `${fullName} transferred ${formatNaira(amount)} to online account`,
        amount,
      });

      setFormData(EMPTY_FORM);
      setRequestRef(null);
      setDialog({ kind: 'success', message: buildSuccessMessage(amount, newBalance) });
    } catch (err) {
      console.error('[FundWallet] Transfer failed:', err);
      setDialog({
        kind: 'error',
        message: err.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AppShell
        header={<PageHeader title={config.title} onBack={() => navigate('/dashboard')} />}
      >
        <div className={styles.body}>
          <InfoBanner tone="success">
            <strong>Current offline balance:</strong>{' '}
            {isBalanceLoaded ? formatNaira(currentBalance) : 'Loading...'}
          </InfoBanner>

          <SegmentedTabs
            tabs={TABS}
            value={direction}
            onChange={handleDirectionChange}
            ariaLabel="Transfer direction"
          />

          <InfoBanner>
            {isFundingOffline ? (
              <>
                💳 Funds move from your <strong>online account</strong> into your{' '}
                <strong>offline wallet</strong>, where they can be spent without a
                connection.
              </>
            ) : (
              <>
                🏦 Funds move from your <strong>offline wallet</strong> back into your{' '}
                <strong>online account</strong>. This requires an internet connection.
              </>
            )}
          </InfoBanner>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <AmountField
              label="Amount"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              error={errors.amount}
              hint={
                isFundingOffline
                  ? `Minimum transfer: ${formatNaira(MINIMUM_AMOUNT)}`
                  : `Maximum transfer: ${formatNaira(currentBalance)}`
              }
              max={isFundingOffline ? undefined : currentBalance}
            />

            <TextField
              label="Description"
              name="description"
              optional
              placeholder={config.placeholder}
              value={formData.description}
              onChange={handleChange}
              autoComplete="off"
              reserveMessageSpace={false}
            />

            <PinField
              label="Transaction PIN"
              name="transactionPin"
              value={formData.transactionPin}
              onChange={handleChange}
              error={errors.transactionPin}
            />

            <Button
              type="submit"
              disabled={!isBalanceLoaded}
              loading={isSubmitting}
              loadingLabel="Processing..."
            >
              {config.submitLabel}
            </Button>
          </form>
        </div>
      </AppShell>

      <Modal
        open={dialog?.kind === 'success'}
        icon="✅"
        title="Transfer successful"
        dismissOnOverlayClick={false}
        actions={
          <Button
            onClick={() => {
              setDialog(null);
              navigate('/dashboard');
            }}
          >
            Back to dashboard
          </Button>
        }
      >
        {dialog?.message}
      </Modal>

      <Modal
        open={dialog?.kind === 'error'}
        icon="⚠️"
        title="Transfer failed"
        onClose={() => setDialog(null)}
        actions={<Button onClick={() => setDialog(null)}>Try again</Button>}
      >
        {dialog?.message}
      </Modal>

      <NoInternetModal show={showNoInternet} onClose={() => setShowNoInternet(false)} />
    </>
  );
}

export default FundWallet;

// Send flow: scan a payment request, confirm with the PIN and show the signed transfer QR.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  Button,
  ButtonGroup,
  Card,
  DetailRow,
  FormError,
  InfoBanner,
  Modal,
  PinField,
} from '@shared/components/ui';
import { AppShell, PageHeader } from '@shared/components/layout';
import { useQrScanner } from '@shared/hooks/useQrScanner';
import { formatNaira, formatShortDateTime } from '@shared/utils';
import { verifyOfflinePin } from '@core/crypto/pinVerifier';
import { getIsOnline } from '@core/network/networkService';
import {
  getPendingCount,
  saveTransaction,
  updateTransactionStatus,
} from '@core/db/transactionRepository';
import { calculateOfflineBalance } from '@features/wallet/services/walletLedger';
import { signTransferWithDeviceKey } from '@features/wallet/services/signingKeyService';
import { getFullName, readIdentity } from '@features/wallet/utils/identity';
import {
  buildTransferPayload,
  generateTransactionRef,
  validatePaymentRequest,
} from '@features/wallet/utils/paymentRequest';
import { usePersistedFlow } from '@features/wallet/hooks/usePersistedFlow';
import QrDisplay from '@features/wallet/components/QrDisplay/QrDisplay.jsx';
import QrScanner from '@features/wallet/components/QrScanner/QrScanner.jsx';
import ReceiverCard from '@features/wallet/components/ReceiverCard/ReceiverCard.jsx';
import styles from './SendMoney.module.css';

const SCANNER_ELEMENT_ID = 'qr-reader';
const MAX_PIN_ATTEMPTS = 3;

const Step = {
  SCAN: 'scan',
  REVIEW: 'review',
  PIN: 'pin',
  SHOW_QR: 'showQr',
  CONFIRM: 'confirmDetails',
  COMPLETE: 'success',
};

const STEP_TITLES = {
  [Step.SCAN]: 'Send money',
  [Step.REVIEW]: 'Review payment',
  [Step.PIN]: 'Enter PIN',
  [Step.SHOW_QR]: 'Show QR to receiver',
  [Step.CONFIRM]: 'Confirm transaction',
  [Step.COMPLETE]: 'Payment sent',
};

const PREVIOUS_STEP = {
  [Step.SCAN]: null,
  [Step.REVIEW]: Step.SCAN,
  [Step.PIN]: Step.REVIEW,
  [Step.SHOW_QR]: Step.PIN,
  [Step.CONFIRM]: Step.SHOW_QR,
  [Step.COMPLETE]: Step.CONFIRM,
};

function SendMoney() {
  const navigate = useNavigate();

  const { initial, persist, clear } = usePersistedFlow('send:flow');

  const [step, setStep] = useState(() => initial?.step ?? Step.SCAN);
  const [request, setRequest] = useState(() => initial?.request ?? null);
  const [transferPayload, setTransferPayload] = useState(() => initial?.transferPayload ?? null);
  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [offlineBalance, setOfflineBalance] = useState(0);

  const sender = {
    walletId: readIdentity('walletId', null),
    phone: readIdentity('phoneNumber', null),
    name: getFullName() || 'User',
  };

  const isSessionValid = Boolean(sender.walletId && sender.phone);

  const balanceRef = useRef(0);
  useEffect(() => {
    balanceRef.current = offlineBalance;
  }, [offlineBalance]);

  useEffect(() => {
    calculateOfflineBalance()
      .then(setOfflineBalance)
      .catch((err) => {
        console.error('[SendMoney] Balance load failed:', err);
        setOfflineBalance(0);
      });
  }, []);

  useEffect(() => {
    if (!isSessionValid) {
      navigate('/login', { replace: true });
    }
  }, [isSessionValid, navigate]);

  useEffect(() => {
    persist({ step, request, transferPayload });
  }, [step, request, transferPayload, persist]);

  async function handleScan(decodedText) {
    let payload;

    try {
      payload = JSON.parse(decodedText);
    } catch (err) {
      console.error('[SendMoney] QR parse error:', err);
      setErrorMessage('Could not read QR code. Please try again.');
      return;
    }

    const pendingCount = getIsOnline() ? 0 : await getPendingCount();

    const validationError = validatePaymentRequest(payload, {
      senderWalletId: sender.walletId,
      balance: balanceRef.current,
      pendingCount,
      isOnline: getIsOnline(),
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setRequest(payload);
    setStep(Step.REVIEW);
  }

  const { permission, error, recheckPermission } = useQrScanner({
    elementId: SCANNER_ELEMENT_ID,
    active: step === Step.SCAN && isSessionValid,
    onScan: handleScan,
  });

  function handleBack() {
    const previous = PREVIOUS_STEP[step];

    if (previous === null) {
      clear();
      navigate('/dashboard');
      return;
    }

    if (previous === Step.SCAN) setRequest(null);
    if (step === Step.PIN || step === Step.SHOW_QR) setPin('');

    setStep(previous);
  }

  function handleAccept() {
    if (!localStorage.getItem('pin_verifier')) {
      setErrorMessage('PIN not set up. Please configure your PIN in settings.');
      return;
    }
    setStep(Step.PIN);
  }

  function handleReject() {
    setRequest(null);
    setStep(Step.SCAN);
  }

  async function handleVerifyPin(e) {
    e.preventDefault();

    if (!localStorage.getItem('pin_verifier') || !localStorage.getItem('pin_salt')) {
      setErrorMessage('Session expired. Please sign in again.');
      navigate('/login');
      return;
    }

    if (pin.length !== 4) {
      setErrors({ pin: 'Please enter your 4-digit PIN.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const isValid = await verifyOfflinePin(pin);

      if (!isValid) {
        const attempts = Number(sessionStorage.getItem('pinAttempts') || '0') + 1;
        sessionStorage.setItem('pinAttempts', String(attempts));

        if (attempts >= MAX_PIN_ATTEMPTS) {
          setErrorMessage('Too many failed PIN attempts. Please sign in again.');
          setTimeout(() => {
            sessionStorage.clear();
            navigate('/login');
          }, 2000);
          return;
        }

        setErrors({ pin: 'Invalid PIN. Please try again.' });
        setPin('');
        return;
      }

      sessionStorage.removeItem('pinAttempts');

      const currentBalance = await calculateOfflineBalance();
      setOfflineBalance(currentBalance);
      if (currentBalance < Number(request.amount)) {
        setErrorMessage(
          `Insufficient balance. Your offline balance is now ${formatNaira(currentBalance)}, but this payment needs ${formatNaira(request.amount)}.`
        );
        setPin('');
        setStep(Step.REVIEW);
        return;
      }

      const transactionRef = generateTransactionRef();
      const createdAt = new Date().toISOString();

      const signature = await signTransferWithDeviceKey({
        transactionRef,
        requestRef: request.requestRef,
        senderWalletId: sender.walletId,
        receiverWalletId: request.receiverWalletId,
        amount: Number(request.amount),
        currency: request.currency || 'NGN',
        createdAt,
      });

      setTransferPayload(buildTransferPayload({ request, transactionRef, createdAt, sender, signature }));
      setRequest((prev) => ({ ...prev, transactionRef, createdAt, signature }));
      setStep(Step.SHOW_QR);
    } catch (err) {
      console.error('[SendMoney] PIN verification error:', err);
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFinalizeDebit() {
    setIsFinalizing(true);

    try {
      await saveTransaction({
        type: 'TRANSFER',
        transactionRef: request.transactionRef,
        requestRef: request.requestRef,
        status: 'PENDING',
        amount: Number(request.amount),
        currency: request.currency || 'NGN',
        description: request.description || `Payment to ${request.receiverName}`,
        senderWalletId: sender.walletId,
        senderPhone: sender.phone,
        senderName: sender.name,
        receiverWalletId: request.receiverWalletId,
        receiverPhone: request.receiverPhone,
        receiverName: request.receiverName,
        entryType: 'DEBIT',
        createdAt: request.createdAt,
        signature: request.signature,
      });

      await updateTransactionStatus(request.transactionRef, 'SUCCESS');

      const newBalance = await calculateOfflineBalance();
      setOfflineBalance(newBalance);
      window.dispatchEvent(
        new CustomEvent('balance-updated', { detail: { balance: newBalance } })
      );

      clear();
      navigate('/dashboard');
    } catch (err) {
      console.error('[SendMoney] Finalize debit error:', err);
      setErrorMessage(err.message || 'Could not complete the debit. Please try again.');
    } finally {
      setIsFinalizing(false);
    }
  }

  if (!isSessionValid) return null;

  const hasSufficientBalance = request ? offlineBalance >= Number(request.amount) : false;

  return (
    <>
      <AppShell header={<PageHeader title={STEP_TITLES[step]} onBack={handleBack} />}>
        {step === Step.SCAN && (
          <div className={styles.body}>
            <QrScanner
              elementId={SCANNER_ELEMENT_ID}
              permission={permission}
              error={error}
              onRetryPermission={recheckPermission}
              instruction="Ask the receiver to open their Receive page and show you their QR code. Point your camera at it to scan."
              hint="Only scan QR codes from people you trust"
            />
          </div>
        )}

        {step === Step.REVIEW && request && (
          <div className={styles.body}>
            <ReceiverCard name={request.receiverName} phone={request.receiverPhone} />

            <div className={styles.reviewCard}>
              <div className={styles.reviewAmountRow}>
                <span className={styles.reviewLabel}>Amount requested</span>
                <span className={styles.reviewAmount}>{formatNaira(request.amount)}</span>
              </div>

              <div className={styles.divider} />

              {request.description && (
                <DetailRow size="md" label="Description" value={request.description} />
              )}
              <DetailRow size="md" label="Request reference" value={request.requestRef} mono />

              <div className={styles.divider} />

              <DetailRow size="md" label="Your offline balance">
                <span
                  className={hasSufficientBalance ? styles.balanceOk : styles.balanceShort}
                >
                  {formatNaira(offlineBalance)}
                </span>
              </DetailRow>
            </div>

            <InfoBanner>
              ℹ️ You are about to send <strong>{formatNaira(request.amount)}</strong> to{' '}
              <strong>{request.receiverName}</strong>. This cannot be reversed offline.
            </InfoBanner>

            <ButtonGroup>
              <Button onClick={handleAccept} disabled={!hasSufficientBalance}>
                {hasSufficientBalance ? 'Accept & continue' : 'Insufficient balance'}
              </Button>
              <Button variant="danger" onClick={handleReject}>
                Reject payment request
              </Button>
            </ButtonGroup>
          </div>
        )}

        {step === Step.PIN && request && (
          <div className={styles.pinScreen}>
            <div className={styles.pinInner}>
              <div className={styles.pinHeader}>
                <div className={styles.pinIcon} aria-hidden="true">
                  🔐
                </div>
                <h2 className={styles.pinTitle}>Enter your PIN</h2>
                <p className={styles.pinSubtitle}>
                  Confirm payment of <strong>{formatNaira(request.amount)}</strong> to{' '}
                  <strong>{request.receiverName}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyPin} noValidate>
                <PinField
                  name="pin"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (errors.pin) setErrors({});
                  }}
                  error={errors.pin}
                  hint="Enter your 4-digit PIN to confirm"
                  disabled={isSubmitting}
                  autoFocus
                />

                <Button
                  type="submit"
                  className={styles.pinSubmit}
                  disabled={pin.length < 4}
                  loading={isSubmitting}
                  loadingLabel="Verifying..."
                >
                  Continue — send {formatNaira(request.amount)}
                </Button>
              </form>
            </div>
          </div>
        )}

        {step === Step.SHOW_QR && request && transferPayload && (
          <div className={styles.body}>
            <InfoBanner tone="warning">
              ⚠️ <strong>Do not tap the button below until the receiver has actually
              scanned this QR code.</strong> Nothing has been deducted from your wallet
              yet — that happens only after you confirm the handoff on the next screens.
            </InfoBanner>

            <QrDisplay
              payload={transferPayload}
              label="Show this QR to the receiver"
              amount={request.amount}
              reference={request.transactionRef}
            />

            <Button onClick={() => setStep(Step.CONFIRM)}>Receiver has scanned this QR</Button>
          </div>
        )}

        {step === Step.CONFIRM && request && (
          <div className={styles.body}>
            <InfoBanner>Please check every detail below carefully before confirming.</InfoBanner>

            <Card>
              <div className={styles.confirmList}>
                <DetailRow label="Sending to" value={request.receiverName} />
                <DetailRow label="Receiver phone" value={request.receiverPhone} />

                <div className={styles.divider} />

                <DetailRow label="Amount" value={formatNaira(request.amount)} />
                {request.description && (
                  <DetailRow label="Description" value={request.description} />
                )}

                <div className={styles.divider} />

                <DetailRow label="Sender" value={sender.name} />
                <DetailRow label="Transaction ref" value={request.transactionRef} mono />
                <DetailRow label="Request ref" value={request.requestRef} mono />
              </div>
            </Card>

            <Button onClick={() => setStep(Step.COMPLETE)}>Confirm transaction details</Button>
          </div>
        )}

        {step === Step.COMPLETE && request && (
          <div className={styles.completeScreen}>
            <div className={styles.completeCard}>
              <div className={styles.completeAmount}>{formatNaira(request.amount)}</div>
              <div className={styles.completeTo}>Sending to</div>
              <div className={styles.completeName}>{request.receiverName}</div>

              <div className={styles.completeDivider} />

              <div className={styles.completeRows}>
                <DetailRow label="Transaction ref" value={request.transactionRef} mono />
                <DetailRow label="Request ref" value={request.requestRef} mono />
                <DetailRow
                  label="Date & time"
                  value={formatShortDateTime(request.createdAt)}
                />
              </div>
            </div>

            <p className={styles.completeNote}>
              Tapping below will mark this transaction as sent.
            </p>

            <Button
              className={styles.completeCta}
              onClick={handleFinalizeDebit}
              loading={isFinalizing}
              loadingLabel="Processing..."
            >
              Complete
              <ArrowRight size={16} className={styles.ctaArrow} />
            </Button>
          </div>
        )}

        <FormError>{errors.general}</FormError>
      </AppShell>

      <Modal
        open={Boolean(errorMessage)}
        icon="⚠️"
        title="Payment failed"
        onClose={() => setErrorMessage('')}
        actions={<Button onClick={() => setErrorMessage('')}>OK</Button>}
      >
        {errorMessage}
      </Modal>
    </>
  );
}

export default SendMoney;

// Receive flow: show a payment request QR and scan the sender's signed transfer.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  AmountField,
  Button,
  ButtonGroup,
  Card,
  DetailRow,
  InfoBanner,
  Modal,
  TextField,
} from '@shared/components/ui';
import { AppShell, PageHeader } from '@shared/components/layout';
import { useCountdown } from '@shared/hooks/useCountdown';
import { useQrScanner } from '@shared/hooks/useQrScanner';
import { formatNaira } from '@shared/utils';
import {
  getTransactionByRef,
  saveTransaction,
  updateTransactionStatus,
} from '@core/db/transactionRepository';
import { calculateOfflineBalance } from '@features/wallet/services/walletLedger';
import { getFullName, readIdentity } from '@features/wallet/utils/identity';
import {
  PAYMENT_LIMITS,
  buildPaymentRequest,
  generateRequestRef,
  validateRequestedAmount,
  validateTransferPayload,
} from '@features/wallet/utils/paymentRequest';
import { usePersistedFlow } from '@features/wallet/hooks/usePersistedFlow';
import QrDisplay from '@features/wallet/components/QrDisplay/QrDisplay.jsx';
import QrScanner from '@features/wallet/components/QrScanner/QrScanner.jsx';
import styles from './ReceivePayment.module.css';

const SCANNER_ELEMENT_ID = 'sender-qr-reader';
const QR_LIFETIME_SECONDS = 300;

const Step = {
  FORM: 'form',
  QR: 'qr',
  SCAN: 'confirm',
  REVIEW: 'reviewDetails',
  COMPLETE: 'success',
};

const STEP_TITLES = {
  [Step.FORM]: 'Receive payment',
  [Step.QR]: 'Payment QR code',
  [Step.SCAN]: 'Scan sender QR',
  [Step.REVIEW]: 'Confirm transaction',
  [Step.COMPLETE]: 'Payment received',
};

const PREVIOUS_STEP = {
  [Step.FORM]: null,
  [Step.QR]: Step.FORM,
  [Step.SCAN]: Step.QR,
  [Step.REVIEW]: Step.SCAN,
  [Step.COMPLETE]: Step.REVIEW,
};

function ReceivePayment() {
  const navigate = useNavigate();

  const { initial, persist, clear } = usePersistedFlow('receive:flow');

  const [step, setStep] = useState(() => initial?.step ?? Step.FORM);
  const [formData, setFormData] = useState(
    () => initial?.formData ?? { amount: '', description: '' }
  );
  const [errors, setErrors] = useState({});
  const [request, setRequest] = useState(() => initial?.request ?? null);
  const [senderPayload, setSenderPayload] = useState(() => initial?.senderPayload ?? null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const receiver = {
    walletId: readIdentity('walletId', null),
    phone: readIdentity('phoneNumber', null),
    name: getFullName() || 'User',
  };

  const isSessionValid = Boolean(receiver.walletId && receiver.phone);

  const { formatted, restart, isComplete } = useCountdown(0);
  const isQrExpired = step === Step.QR && request !== null && isComplete;

  const requestRef = useRef(null);
  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  const descriptionRef = useRef('');
  useEffect(() => {
    descriptionRef.current = formData.description;
  }, [formData.description]);

  useEffect(() => {
    if (!isSessionValid) {
      navigate('/login', { replace: true });
    }
  }, [isSessionValid, navigate]);

  useEffect(() => {
    if (initial?.step === Step.QR && initial?.request?.expiresAt) {
      const remainingMs = new Date(initial.request.expiresAt).getTime() - Date.now();
      if (remainingMs > 0) {
        restart(Math.floor(remainingMs / 1000));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    persist({ step, formData, request, senderPayload });
  }, [step, formData, request, senderPayload, persist]);

  const qrPayload = useMemo(() => (request ? JSON.stringify(request) : ''), [request]);

  async function handleScan(decodedText) {
    setIsProcessing(true);

    try {
      const current = requestRef.current;
      let payload;

      try {
        payload = JSON.parse(decodedText);
      } catch {
        setErrorMessage('Invalid QR code format. Please scan a valid transaction QR.');
        return;
      }

      const validationError = validateTransferPayload(payload, {
        requestRef: current.requestRef,
        receiverWalletId: receiver.walletId,
        expectedAmount: current.amount,
        expiresAt: current.expiresAt,
      });

      if (validationError) {
        setErrorMessage(validationError);
        return;
      }

      if (await getTransactionByRef(payload.transactionRef)) {
        setErrorMessage('This transaction has already been processed.');
        return;
      }

      setSenderPayload({
        ...payload,
        creditDescription: payload.description || descriptionRef.current || null,
      });
      setStep(Step.REVIEW);
    } catch (err) {
      console.error('[ReceivePayment] Scan validation error:', err);
      setErrorMessage(err.message || 'Failed to read payment QR. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }

  const { permission, error, recheckPermission } = useQrScanner({
    elementId: SCANNER_ELEMENT_ID,
    active: step === Step.SCAN && isSessionValid,
    onScan: handleScan,
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function handleGenerate(e) {
    e.preventDefault();

    const amountError = validateRequestedAmount(formData.amount);
    if (amountError) {
      setErrors({ amount: amountError });
      return;
    }

    const createdAt = new Date().toISOString();

    setRequest(
      buildPaymentRequest({
        requestRef: generateRequestRef(),
        amount: formData.amount,
        description: formData.description,
        receiver,
        createdAt,
        expiresAt: new Date(Date.now() + QR_LIFETIME_SECONDS * 1000).toISOString(),
      })
    );

    restart(QR_LIFETIME_SECONDS);
    setStep(Step.QR);
  }

  function handleBack() {
    const previous = PREVIOUS_STEP[step];

    if (previous === null) {
      clear();
      navigate('/dashboard');
      return;
    }

    if (step === Step.REVIEW) setSenderPayload(null);

    setStep(previous);
  }

  async function handleFinalizeCredit() {
    if (!senderPayload || !request) return;

    setIsFinalizing(true);

    try {
      if (await getTransactionByRef(senderPayload.transactionRef)) {
        setErrorMessage('This transaction has already been processed.');
        return;
      }

      await saveTransaction({
        type: 'TRANSFER',
        transactionRef: senderPayload.transactionRef,
        requestRef: request.requestRef,
        status: 'PENDING',
        amount: Number(senderPayload.amount),
        currency: senderPayload.currency || 'NGN',
        description: senderPayload.creditDescription,
        senderWalletId: senderPayload.senderWalletId,
        senderPhone: senderPayload.senderPhone,
        senderName: senderPayload.senderName,
        receiverWalletId: receiver.walletId,
        receiverPhone: receiver.phone,
        receiverName: receiver.name,
        entryType: 'CREDIT',
        createdAt: senderPayload.createdAt || new Date().toISOString(),
        signature: senderPayload.signature,
      });

      await updateTransactionStatus(senderPayload.transactionRef, 'SUCCESS');

      const newBalance = await calculateOfflineBalance();
      window.dispatchEvent(
        new CustomEvent('balance-updated', { detail: { balance: newBalance } })
      );

      clear();
      navigate('/dashboard');
    } catch (err) {
      console.error('[ReceivePayment] Finalize credit error:', err);
      setErrorMessage(err.message || 'Could not complete the credit. Please try again.');
    } finally {
      setIsFinalizing(false);
    }
  }

  if (!isSessionValid) return null;

  return (
    <>
      <AppShell header={<PageHeader title={STEP_TITLES[step]} onBack={handleBack} />}>
        {step === Step.FORM && (
          <div className={styles.formScreen}>
            <div className={styles.formInner}>
              <div className={styles.formHeader}>
                <h2 className={styles.formTitle}>Receive payment</h2>
                <p className={styles.formSubtitle}>
                  Enter the amount and generate a QR code for the sender to scan.
                </p>
              </div>

              <form className={styles.form} onSubmit={handleGenerate} noValidate>
                <AmountField
                  label="Amount to receive"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  error={errors.amount}
                  hint={`Minimum ${formatNaira(PAYMENT_LIMITS.MIN_AMOUNT)} · Maximum ${formatNaira(PAYMENT_LIMITS.MAX_AMOUNT)}`}
                  step="100"
                />

                <TextField
                  label="Description"
                  name="description"
                  optional
                  placeholder="e.g. Payment for goods"
                  value={formData.description}
                  onChange={handleChange}
                  maxLength={100}
                  reserveMessageSpace={false}
                />

                <Button type="submit">Generate payment QR</Button>
              </form>
            </div>
          </div>
        )}

        {step === Step.QR && request && (
          <div className={styles.body}>
            <QrDisplay
              payload={qrPayload}
              label="Show this QR to the sender"
              amount={request.amount}
              reference={request.requestRef}
              expired={isQrExpired}
            >
              {request.description && (
                <div className={styles.qrDescription}>{request.description}</div>
              )}

              <div
                className={[styles.expiry, isQrExpired ? styles.expiryExpired : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {isQrExpired
                  ? '❌ QR expired — generate a new one'
                  : `⏱ Expires in ${formatted}`}
              </div>
            </QrDisplay>

            <InfoBanner>
              📱 Show this QR to the sender. Once they have scanned it, tap{' '}
              <strong>Sender has scanned</strong> — your camera will open to read their
              confirmation QR.
            </InfoBanner>

            <ButtonGroup>
              {isQrExpired ? (
                <Button onClick={() => setStep(Step.FORM)}>Generate new QR</Button>
              ) : (
                <>
                  <Button onClick={() => setStep(Step.SCAN)} disabled={isProcessing}>
                    Sender has scanned
                  </Button>
                  <Button variant="secondary" onClick={() => setStep(Step.FORM)}>
                    Generate new QR
                  </Button>
                </>
              )}
            </ButtonGroup>
          </div>
        )}

        {step === Step.SCAN && (
          <div className={styles.body}>
            <QrScanner
              elementId={SCANNER_ELEMENT_ID}
              permission={permission}
              error={error}
              onRetryPermission={recheckPermission}
              instruction="Ask the sender to show their Payment Sent screen. Point your camera at the QR code on their device."
            />

            {isProcessing && <InfoBanner>⏳ Verifying payment...</InfoBanner>}

            <InfoBanner tone="warning">
              ⚠️ Only scan a QR shown live on the sender&apos;s device. Do not scan
              screenshots.
            </InfoBanner>

            <Button variant="secondary" onClick={() => setStep(Step.QR)} disabled={isProcessing}>
              Go back
            </Button>
          </div>
        )}

        {step === Step.REVIEW && senderPayload && request && (
          <div className={styles.body}>
            <InfoBanner>Please check every detail below carefully before confirming.</InfoBanner>

            <Card>
              <div className={styles.confirmList}>
                <DetailRow label="Received from" value={senderPayload.senderName} />
                <DetailRow label="Sender phone" value={senderPayload.senderPhone} />

                <div className={styles.divider} />

                <DetailRow label="Amount" value={formatNaira(senderPayload.amount)} />
                {senderPayload.creditDescription && (
                  <DetailRow label="Description" value={senderPayload.creditDescription} />
                )}

                <div className={styles.divider} />

                <DetailRow label="Receiving as" value={receiver.name} />
                <DetailRow label="Transaction ref" value={senderPayload.transactionRef} mono />
                <DetailRow label="Request ref" value={request.requestRef} mono />
              </div>
            </Card>

            <Button onClick={() => setStep(Step.COMPLETE)}>Confirm transaction details</Button>
          </div>
        )}

        {step === Step.COMPLETE && senderPayload && (
          <div className={styles.completeScreen}>
            <div className={styles.completeCard}>  
              <div className={styles.completeAmount}>{formatNaira(senderPayload.amount)}</div>
              <div className={styles.completeTo}>From</div>
              <div className={styles.completeName}>{senderPayload.senderName}</div>
              <p className={styles.completeDesc}>
                Tap below to complete this transaction.
                <br />
                It will sync automatically when you are back online.
              </p>
            </div>

            <Button
              className={styles.completeCta}
              onClick={handleFinalizeCredit}
              loading={isFinalizing}
              loadingLabel="Processing..."
            >
              Complete
              <ArrowRight size={16} className={styles.ctaArrow} />
            </Button>
          </div>
        )}
      </AppShell>

      <Modal
        open={Boolean(errorMessage)}
        icon="⚠️"
        title="Payment confirmation failed"
        onClose={() => setErrorMessage('')}
        actions={<Button onClick={() => setErrorMessage('')}>OK</Button>}
      >
        {errorMessage}
      </Modal>
    </>
  );
}

export default ReceivePayment;

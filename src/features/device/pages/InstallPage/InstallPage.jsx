import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, InfoBanner } from '@shared/components/ui';
import { isPWAInstalled } from '@features/device/services/deviceCompatibility';
import { InstallPhase, useInstallPrompt } from '@features/device/hooks/useInstallPrompt';
import { ROUTES } from '@app/router/routes';
import styles from './InstallPage.module.css';

/**
 * Drives PWA installation.
 *
 * Once installation is underway or confirmed, this page deliberately does not
 * navigate anywhere in the browser tab. The point of the flow is to move the
 * user off the browser and onto the installed app, so it ends on a hand-off
 * screen whose button closes the tab. Opening the installed app lands on
 * Onboarding, which redirects to the welcome screen on its own.
 */

/**
 * How long to wait after window.close() before assuming the browser refused.
 * Browsers silently ignore close() on tabs they did not open themselves.
 */
const CLOSE_FALLBACK_DELAY_MS = 400;

const BENEFITS = [
  'Works offline — send money anywhere',
  'Opens instantly from your home screen',
  'Full-screen, no browser bars',
];

const MANUAL_STEPS = [
  {
    platform: 'Android · Chrome or Edge',
    steps: [
      'Tap the ⋮ menu in the top-right corner',
      'Tap "Add to Home Screen" or "Install app"',
      'Tap "Add" or "Install" to confirm',
      'Open SyncPoint from your home screen',
    ],
  },
  {
    platform: 'iPhone / iPad · Safari',
    steps: [
      'Tap the Share button (square with arrow)',
      'Scroll down and tap "Add to Home Screen"',
      'Tap "Add" in the top-right corner',
      'Open SyncPoint from your home screen',
    ],
  },
];

function InstallPage() {
  const navigate = useNavigate();
  const { phase, setPhase, secondsLeft, progressPercent, error, install, retry } =
    useInstallPrompt();

  const [isCloseBlocked, setIsCloseBlocked] = useState(false);

  useEffect(() => {
    if (isPWAInstalled()) {
      navigate(ROUTES.WELCOME, { replace: true });
    }
  }, [navigate]);

  function handleContinue() {
    window.close();
    setTimeout(() => setIsCloseBlocked(true), CLOSE_FALLBACK_DELAY_MS);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        {(phase === InstallPhase.WAITING || phase === InstallPhase.INSTALLING) && (
          <section className={styles.section}>
            <div className={styles.spinner} aria-hidden="true" />

            <p className={styles.title}>
              {phase === InstallPhase.WAITING ? 'Preparing installation…' : 'Installing…'}
            </p>

            <p className={styles.body}>
              {phase === InstallPhase.WAITING
                ? 'Getting everything ready. This usually takes just a moment.'
                : 'Follow the prompt on your screen to complete the installation.'}
            </p>

            {phase === InstallPhase.WAITING && (
              <>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressBar}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className={styles.progressLabel}>{secondsLeft}s remaining</p>
              </>
            )}
          </section>
        )}

        {phase === InstallPhase.READY && (
          <section className={styles.section}>
            <div className={styles.icon} aria-hidden="true">
              📲
            </div>

            <p className={styles.title}>Ready to install</p>

            <p className={styles.body}>
              Install SyncPoint on your device for the full offline payments experience —
              no browser chrome, works like a native app.
            </p>

            <ul className={styles.benefits}>
              {BENEFITS.map((benefit) => (
                <li className={styles.benefit} key={benefit}>
                  <span className={styles.tick} aria-hidden="true">
                    ✓
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>

            <Button onClick={install}>Install now</Button>
          </section>
        )}

        {phase === InstallPhase.CLOSE && (
          <section className={styles.section}>
            <div className={styles.icon} aria-hidden="true">
              📲
            </div>

            <p className={styles.title}>
              {isCloseBlocked ? "You're all set!" : 'Installing SyncPoint…'}
            </p>

            <p className={styles.body}>
              SyncPoint is being added to your device. Find the <strong>SyncPoint</strong>{' '}
              icon on your home screen, open the app from there, and sign in to continue.
            </p>

            <InfoBanner>
              This browser tab is no longer needed — use the SyncPoint app from your home
              screen from now on, not this browser.
            </InfoBanner>

            {isCloseBlocked ? (
              <p className={styles.footnote}>You can now close this browser tab.</p>
            ) : (
              <Button onClick={handleContinue}>Continue</Button>
            )}
          </section>
        )}

        {phase === InstallPhase.MANUAL && (
          <section className={styles.section}>
            {error && <InfoBanner tone="error">{error}</InfoBanner>}

            <p className={styles.title}>Install manually</p>
            <p className={styles.body}>
              Follow these steps to add SyncPoint to your home screen:
            </p>

            {MANUAL_STEPS.map(({ platform, steps }) => (
              <div className={styles.instructions} key={platform}>
                <p className={styles.platform}>{platform}</p>
                <ol className={styles.steps}>
                  {steps.map((step, index) => (
                    <li className={styles.step} key={step}>
                      <span className={styles.stepNumber}>{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}

            <p className={styles.footnote}>
              After installing, open SyncPoint from your home screen to continue.
            </p>

            {/*
              A manual install cannot be detected — iOS Safari fires neither
              beforeinstallprompt nor appinstalled — so the user confirms it
              and joins the same hand-off screen as the automatic flow.
            */}
            <Button onClick={() => setPhase(InstallPhase.CLOSE)}>
              I&apos;ve installed — continue
            </Button>

            <Button variant="secondary" onClick={retry}>
              Try automatic install again
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}

export default InstallPage;
# SyncPoint — Deferred Hardening Backlog (reusable prompt)

Paste this whole document to start the work later. It is written to be understood cold, without the original conversation.

---

## Context you need first

SyncPoint is an offline-first P2P wallet. A React/Vite PWA client lets a user load an offline balance and pay peers over QR codes with no network; a Spring Boot backend reconciles those transfers when connectivity returns.

Two design decisions already shipped and are the backdrop for everything below:

**Model B settlement.** Offline float is the client's money once loaded.
- Funding an offline wallet moves money out of the server mirror balance (`mirror −= amount`).
- On **sync**, a transfer's **DEBIT does not touch the sender's mirror** (charging it again would double-spend the sender — the money already left the mirror at funding time). Only the **CREDIT applies**, raising the receiver's mirror.
- Funding and transfer-to-online still adjust the mirror directly; that is unchanged.

**Signed offline transfers.** Because a receiver must be able to settle received money even if the sender never reconnects, authorization is a per-transfer signature, not caller identity.
- ECDSA P-256 / SHA-256. Signature is raw IEEE-P1363, base64. Public key is SPKI base64, stored on `wallets.signing_public_key`.
- Canonical signed string (identical on client and server): `SYNCPOINT-TRANSFER|v1|{transactionRef}|{requestRef}|{senderWalletId}|{receiverWalletId}|{amountInKobo}|{currency}|{createdAtEpochMillis}`.
- Server verifies via `TransferSignatureVerifier` (`SHA256withECDSAinP1363Format`), and this **replaced** the old `assertOwnsPhoneNumber` ownership check on the sync endpoint.
- Client generates a non-extractable keypair, stores it in its own IndexedDB (`syncpoint_signing_keys`), and registers the public key via `POST /wallet/signing-key` at login and as a hard gate before the first send.

The items below were consciously deferred during that work. None are regressions; they are known, bounded gaps.

---

## The deferred items, in priority order

### 1. Server-side float tracking — the only remaining money-integrity gap (HIGH)

**Problem.** Under Model B the sync DEBIT touches nothing on the server, so the server never verifies that a sender actually had the offline float to cover a transfer. Signatures prove *authorization*, not *funds*.

**What this allows.**
- **Collusion minting.** Two accounts (or one person with two accounts) can inflate a mirror. Account A validly signs "A pays B ₦X" with A's own key; the server credits B's mirror `+X` and debits nothing from A. Ping-pong between the two accounts mints unlimited money. Note: single-actor *self*-minting is already closed by the signature scheme (an attacker cannot sign as a wallet whose private key they do not hold) — **collusion is the only remaining minting path.**
- **Re-spend before sync.** A receiver can spend received-but-unsynced money offline. When both the receipt and the re-spend later sync, the received amount lands in full in the receiver's mirror while a portion was also handed to a third party — a system-level double-count. The client offline balance was deliberately made conservative (see item 3), so this cannot cause a *client-side* overspend, but server-side conservation still leaks.

**Root cause.** There is no server-side representation of each wallet's offline float (the loaded-but-unsettled balance). Funding decrements the mirror but records no corresponding float; sync neither draws from nor returns to any tracked float.

**Fix direction (design task, not a patch).** Introduce a per-wallet `offlineFloat`:
- Funding offline: `mirror −= X`, `offlineFloat += X`.
- Transfer-to-online: `mirror += X`, `offlineFloat −= X` (bounded by available float).
- Sync of transfer A→B: `A.offlineFloat −= amount` **and reject if insufficient** — this is exactly the missing funds check — then credit B.
- This keeps the user's rule intact ("the online/mirror balance is never re-debited for offline spending") because the DEBIT now draws from A's *float*, not A's mirror.

**Open questions to resolve before building.**
- Does the receiver's credit land in their **mirror** (online, as today — item 3's client fix already assumes this) or in their **offlineFloat** (device-equivalent)? This changes the client offline-balance model.
- Sync **ordering / holds**: a DEBIT must find sufficient float, but the receipt that funded it may not have synced yet. Decide whether to enforce ordering, hold, or allow negative-float-with-later-reconcile.
- Migration: `offlineFloat` is a new column; decide backfill for existing wallets (probably `offlineFloat = 0`, since existing offline balances live only on devices).

**Touch points.** `Wallet` model (+ column + migration), `WalletFundingServiceImpl` (funding + transfer-to-online already touch mirror — add float), `TransactionSyncServiceImpl.processSingleTransfer` (add the float debit + sufficiency check), possibly `walletLedger.js` on the client if the receiver-credit destination changes.

---

### 2. Endpoint authorization — `@PreAuthorize` (MEDIUM, quick)

**Problem.** `POST /wallet/sync-transaction` and the new `POST /wallet/signing-key` are protected only by JWT authentication — no role/scope gate. Most other endpoints use `@PreAuthorize("@rolesEvaluator.<...>")`.

**Risk.** Any authenticated principal, even one lacking the offline-payment role, can call these. Practical risk is low (signature verification protects sync money-integrity; signing-key registration only affects the caller's own wallet), but it is inconsistent with the rest of the API surface.

**Fix.** Add `@PreAuthorize` to both endpoints, mirroring the existing role-evaluator pattern used elsewhere (confirm the exact role string / evaluator method for offline-payment access). Verify nothing in the client flow breaks for legitimately-roled users.

---

### 3. Receiver re-spend undercount — client symptom of item 1 (LOW, tied to item 1)

**Problem.** `calculateOfflineBalance` excludes synced P2P `TRANSFER` credits (they've moved to the online mirror under Model B) and clamps a negative total to 0. If a receiver re-spends received money *before* it syncs, the offline balance can undercount after sync (clamped to 0).

**Why it's acceptable today.** Undercounting is conservative — it can never permit an overspend. The displayed offline figure may just be lower than the user's true device position until a mirror refresh / next login.

**Resolution.** Falls out of item 1. If float tracking lands and received money is credited to the receiver's `offlineFloat` (rather than mirror), revisit whether the client should still drop synced transfer credits from the offline balance. Do not fix in isolation — decide alongside item 1's "where does the receiver credit land" question.

---

### 4. CORS breadth (LOW)

**Problem.** The security config's `setAllowedOriginPatterns` includes `https://*.onrender.com` together with `setAllowCredentials(true)`. Anyone can register an `onrender.com` subdomain, so any such origin can make credentialed requests.

**Why it's low.** Auth is Bearer tokens, not cookies, so credentialed CORS carries little here.

**Fix.** Restrict allowed origins to the specific frontend origin(s), or drop `allowCredentials` if it isn't actually used.

---

### 5. Money precision on the client (LOW)

**Problem.** The client derives the offline balance with JS floating-point arithmetic (`balance += Number(amount)`). Fine for whole-naira amounts; a risk if kobo (decimal) amounts ever appear.

**Fix.** Represent money as integer kobo throughout the client ledger, or use a decimal library. Note the signing canonical form already uses integer kobo, so aligning the ledger is consistent.

---

### 6. Signing-key re-enrollment overwrite (LOW, note only)

**Problem.** Registering a signing key overwrites any previous one (needed so re-install / new-device / "enroll on next login" works under the single-active-device model). A transfer still in flight that was signed with a *superseded* key would then fail verification.

**Why it's low.** Sign-out is already gated on nothing being unsynced, and login enforces single active device, so in practice there is no in-flight transfer at a re-enrollment moment. Only note it if multi-device or key-rotation-with-pending-transfers becomes a real scenario — the fix would be a small key history (accept signatures from recent prior keys).

---

## How to start when you come back

1. Decide item 1's two open questions first (receiver-credit destination; sync ordering/holds) — everything else about float tracking follows from them, and item 3 is downstream of it.
2. Item 2 (`@PreAuthorize`) is independent and quick; do it any time.
3. Ask me to work one item at a time, and to return **full corrected files** for each changed class as individual downloads (no zip, only files that actually changed) — same working style as the original build. For any server class whose behavior or constructor changes, ask for the corrected unit test alongside it.

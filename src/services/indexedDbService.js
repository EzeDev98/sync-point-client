// ============================================
// INDEXEDDB SERVICE — SyncPoint
// Encrypted offline transaction storage (AES-GCM via cryptoService)
//
// Store shape per record:
//   { id, iv, data, status, entryType, type, createdAt, synced,
//     syncAttempts, lastSyncError }
//
// ONLY the fields above are stored in plaintext.
// ALL sensitive payload (amounts, wallet IDs, phones, names, refs)
// lives exclusively inside the encrypted `data` blob.
// ============================================

import { encryptData, decryptData, isEncryptionReady } from "./cryptoService";

const DB_NAME = "syncpoint_db";
const DB_VERSION = 3;
const STORE_NAME = "transactions";

// ─────────────────────────────────────────────
// DB OPEN + MIGRATION
// ─────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Wipe old unencrypted stores from v1/v2 — they cannot be migrated
      // because we have no way to encrypt existing plaintext records
      // without re-processing them, and v1/v2 used a different keyPath.
      if (oldVersion < 3) {
        const storesToDrop = ["pending_transactions", "transactions", "metadata"];
        for (const name of storesToDrop) {
          if (db.objectStoreNames.contains(name)) {
            db.deleteObjectStore(name);
            console.log(`[IndexedDB] Dropped old store: ${name}`);
          }
        }
      }

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });

        // Only non-sensitive metadata fields are indexed.
        // Wallet IDs, phone numbers, amounts, names stay in the encrypted blob.
        store.createIndex("status", "status", { unique: false });
        store.createIndex("entryType", "entryType", { unique: false });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("synced", "synced", { unique: false });

        console.log("[IndexedDB] Encrypted transactions store created (v3).");
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => {
      console.error("[IndexedDB] Open error:", event.target.error);
      reject(event.target.error);
    };
  });
}

// ─────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────

/**
 * Encrypt and save a transaction to IndexedDB.
 *
 * The full transaction payload (including amounts, wallet IDs, phones,
 * names, refs) is encrypted before storage. Only status/entryType/type
 * are kept as plaintext for querying.
 *
 * @param {object} transaction
 * @param {string} transaction.transactionRef
 * @param {string} transaction.type           — "TRANSFER"
 * @param {string} transaction.entryType      — "DEBIT" | "CREDIT"
 * @param {string} [transaction.status]       — defaults to "PENDING"
 * @param {string} [transaction.createdAt]    — defaults to now
 */
export async function saveTransaction(transaction) {
  
  if (!isEncryptionReady()) {
    throw new Error("[IndexedDB] Encryption not ready. Please log in again.");
  }

  if (!transaction.transactionRef) {
    throw new Error("[IndexedDB] saveTransaction: transactionRef is required.");
  }

  const db = await openDB();
  const { iv, data } = await encryptData(transaction);

  const record = {
    id: transaction.transactionRef,
    iv,
    data,
    // Plaintext metadata — for querying only
    status: transaction.status || "PENDING",
    entryType: transaction.entryType,   // "DEBIT" | "CREDIT"
    type: transaction.type,             // "TRANSFER"
    createdAt: transaction.createdAt || new Date().toISOString(),
    synced: false,
    syncAttempts: 0,
    lastSyncError: null,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record); // add (not put) — reject duplicates

    req.onsuccess = () => {
      console.log("[IndexedDB] Transaction saved:", transaction.transactionRef);
      resolve(record);
    };

    req.onerror = (event) => {
      console.error("[IndexedDB] Save failed:", event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Update the status and sync metadata of a record without re-encrypting.
 * Only touches plaintext metadata fields.
 */
export async function updateTransactionStatus(transactionRef, status, meta = {}) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(transactionRef);

    req.onsuccess = () => {
      const record = req.result;
      if (!record) {
        reject(new Error("[IndexedDB] Transaction not found: " + transactionRef));
        return;
      }

      record.status = status;
      if (meta.synced !== undefined) record.synced = meta.synced;
      if (meta.syncAttempts !== undefined) record.syncAttempts = meta.syncAttempts;
      if (meta.lastSyncError !== undefined) record.lastSyncError = meta.lastSyncError;
      if (meta.syncedAt !== undefined) record.syncedAt = meta.syncedAt;

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = (event) => reject(event.target.error);
    };

    req.onerror = (event) => reject(event.target.error);
  });
}

export async function markTransactionSynced(transactionRef) {
  return updateTransactionStatus(transactionRef, "SYNCED", {
    synced: true,
    syncedAt: new Date().toISOString(),
  });
}

/**
 * Mark a transaction as FAILED and correctly increment syncAttempts.
 * Fix for issue #14 — was hardcoding syncAttempts: 1.
 */
export async function markTransactionFailed(transactionRef, errorMessage) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(transactionRef);

    req.onsuccess = () => {
      const record = req.result;
      if (!record) {
        reject(new Error("[IndexedDB] Transaction not found: " + transactionRef));
        return;
      }

      record.syncAttempts = (record.syncAttempts || 0) + 1; // correct increment
      record.lastSyncError = errorMessage || "Sync failed";

      const putReq = store.put(record);
      putReq.onsuccess = () => {
        console.log("[IndexedDB] Transaction marked FAILED:", transactionRef);
        resolve(record);
      };
      putReq.onerror = (event) => reject(event.target.error);
    };

    req.onerror = (event) => reject(event.target.error);
  });
}

// ─────────────────────────────────────────────
// READ — DECRYPTED
// ─────────────────────────────────────────────

/**
 * Decrypt a single raw IndexedDB record into a full transaction object.
 * Returns null if the record is null.
 */
async function decryptRecord(record) {
  if (!record) return null;

  try {
    const payload = await decryptData(record.data, record.iv);
    return {
      ...payload,
      // Overlay current plaintext metadata (status may have been updated
      // without re-encrypting the blob)
      status: record.status,
      synced: record.synced,
      syncAttempts: record.syncAttempts || 0,
      lastSyncError: record.lastSyncError || null,
    };
  } catch (err) {
    console.error("[IndexedDB] Decryption failed for record:", record.id, err);
    return {
      transactionRef: record.id,
      status: "CORRUPTED",
      synced: record.synced,
      syncAttempts: record.syncAttempts || 0,
      error: "Data corruption — could not decrypt",
    };
  }
}

/**
 * Get all PENDING transactions (not FAILED, not SYNCED, not CORRUPTED).
 *
 * Fix for issue #15: previously queried by synced=false which included
 * FAILED records. Now queries by status="PENDING" only so failed
 * transactions are not silently retried on every sync cycle.
 */
// export async function getPendingTransactions() {
//   if (!isEncryptionReady()) {
//     throw new Error("[IndexedDB] Encryption not ready. Please log in again.");
//   }
//   const db = await openDB();
//   return new Promise((resolve, reject) => {
//     const tx = db.transaction(STORE_NAME, "readonly");
//     const store = tx.objectStore(STORE_NAME);
//     const index = store.index("synced");
//     const req = index.getAll(false);
//     req.onsuccess = async () => {
//       try {
//         const decrypted = await Promise.all(req.result.map(decryptRecord));
//         resolve(decrypted.filter((t) => t.status !== "CORRUPTED"));
//       } catch (err) { reject(err); }
//     };
//     req.onerror = (event) => reject(event.target.error);
//   });
// }

/**
 * Get all transactions sorted by createdAt descending.
 */
export async function getAllTransactions() {
  if (!isEncryptionReady()) {
    throw new Error("[IndexedDB] Encryption not ready. Please log in again.");
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = async () => {
      try {
        const decrypted = await Promise.all(req.result.map(decryptRecord));
        decrypted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(decrypted);
      } catch (err) {
        reject(err);
      }
    };

    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get a single transaction by its transactionRef (decrypted).
 */
export async function getTransactionByRef(transactionRef) {
  if (!isEncryptionReady()) {
    throw new Error("[IndexedDB] Encryption not ready. Please log in again.");
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(transactionRef);

    req.onsuccess = async () => {
      try {
        resolve(await decryptRecord(req.result));
      } catch (err) {
        reject(err);
      }
    };

    req.onerror = (event) => reject(event.target.error);
  });
}

// ─────────────────────────────────────────────
// COUNT — NO DECRYPTION NEEDED
// ─────────────────────────────────────────────

/**
 * Count PENDING transactions without decrypting any records.
 *
 * Fix for issue #12: previous implementation called getPendingTransactions()
 * which decrypted every record just to count them.
 */
export async function getPendingCount() {
  const pending = await getPendingTransactions();
  return pending.length;
}

export async function getPendingTransactions() {
  if (!isEncryptionReady()) {
    throw new Error("[IndexedDB] Encryption not ready. Please log in again.");
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = async () => {
      try {
        const decrypted = await Promise.all(req.result.map(decryptRecord));

        resolve(
          decrypted.filter(
            (t) => t.status !== "CORRUPTED" && t.type === "TRANSFER" && t.synced === false
          )
        );
      } catch (err) {
        reject(err);
      }
    };

    req.onerror = (event) => reject(event.target.error);
  });
}

// ─────────────────────────────────────────────
// DELETE / CLEAR
// ─────────────────────────────────────────────

export async function deleteTransaction(transactionRef) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(transactionRef);

    req.onsuccess = () => {
      console.log("[IndexedDB] Transaction deleted:", transactionRef);
      resolve(true);
    };
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get all synced records (metadata only — no decryption needed for cleanup).
 */
export async function getSyncedTransactions() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("synced");
    const req = index.getAll(true);

    req.onsuccess = () => resolve(req.result);
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Delete all SYNCED records. Safe to call after a successful server sync.
 */
export async function clearSyncedTransactions() {
  const db = await openDB();
  const synced = await getSyncedTransactions();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    let count = 0;

    for (const record of synced) {
      store.delete(record.id);
      count++;
    }

    tx.oncomplete = () => {
      console.log(`[IndexedDB] Cleared ${count} synced transactions.`);
      resolve(count);
    };
    tx.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Nuclear option — wipe all transactions. Use only in dev/testing.
 */
export async function clearAllTransactions() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => {
      console.log("[IndexedDB] All transactions cleared.");
      resolve(true);
    };
    req.onerror = (event) => reject(event.target.error);
  });
}


/**
 * Save a financial ledger transaction (FUND, TRANSFER_TO_ONLINE, etc.)
 * that affects the wallet balance.
 *
 * This is distinct from saveTransaction() which is for P2P transfers.
 * Both ultimately write to the same store — the distinction is conceptual.
 *
 * entryType must be "CREDIT" or "DEBIT".
 */
export async function saveLedgerTransaction(transaction) {
  if (!transaction.transactionRef) {
    throw new Error("[IndexedDB] saveLedgerTransaction: transactionRef is required.");
  }
  if (!transaction.entryType || !["CREDIT", "DEBIT"].includes(transaction.entryType)) {
    throw new Error("[IndexedDB] saveLedgerTransaction: entryType must be CREDIT or DEBIT.");
  }
  return saveTransaction(transaction);
}
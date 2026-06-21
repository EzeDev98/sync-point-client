const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:2000/api/v1";

function getToken() {
  return sessionStorage.getItem("sessionToken") || null;
}

function getPhoneNumber() {
  return sessionStorage.getItem("phoneNumber") || null;
}

// ============================================
// USER REGISTRATION
// ============================================
export async function registerUser(formData) {
  const response = await fetch(`${BASE_URL}/register-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: formData.firstName,
      middleName: formData.middleName || null,
      lastName: formData.lastName,
      username: formData.username,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      gender: formData.gender,
      dateOfBirth: formData.dateOfBirth,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Registration failed. Please try again.");
  }
  return data;
}

// ============================================
// WALLET LOGIN
// ============================================
export async function loginUser(phoneNumber, password) {
  const response = await fetch(`${BASE_URL}/wallet/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    const errorMessage = data.detail || data.message || "Login failed. Please try again.";
    throw new Error(errorMessage);
  }
  return data;
}

// ============================================
// CONFIRM PIN SET 
// ============================================
export async function checkPinSet(walletId) {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token found. Please log in again.");
  }

  const response = await fetch(`${BASE_URL}/wallet/has-pin?walletId=${walletId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    const statusMessages = {
      400: "Bad request while verifying PIN status.",
      401: "Session expired. Please log in again.",
      403: "Access denied while verifying PIN status.",
      500: "Server error while verifying PIN status. Please try again.",
    };
    sessionStorage.clear();
    throw new Error(data.detail || data.message || statusMessages[response.status] || "Unable to verify PIN status. Please try again.");
  }
  return data;
}

// ============================================
// SET PIN 
// ============================================
export async function setWalletPin(pin, confirmNewPin) {
  const phoneNumber = getPhoneNumber();
  if (!phoneNumber) {
    throw new Error("Phone number not found. Please log in again.");
  }

  const token = getToken();
  if (!token) {
    throw new Error("No authentication token found. Please log in again.");
  }

  const response = await fetch(`${BASE_URL}/wallet/set-pin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ phoneNumber, pin, confirmNewPin }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Failed to set PIN. Please try again.");
  }
  return data;
}

// ============================================
// WALLET LOGOUT 
// ============================================
export async function logoutUser() {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token found.");
  }

  const response = await fetch(`${BASE_URL}/user/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Logout failed. Please try again.");
  }
  return data;
}

// ============================================
// FUND WALLET
// ============================================
export async function fundOfflineWallet({ amount, description, transactionPin, requestRef }) {
  const phoneNumber = getPhoneNumber();
  if (!phoneNumber) {
    throw new Error("Phone number not found. Please log in again.");
  }

  const response = await fetch(`${BASE_URL}/wallet/funding/offline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ phoneNumber, amount, description, transactionPin, requestRef }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Failed to fund offline wallet.");
  }
  return data;
}

// ============================================
// TRANSFER TO ONLINE
// ============================================
export async function transferToOnline({ amount, description, transactionPin, requestRef }) {
  const phoneNumber = getPhoneNumber();
  if (!phoneNumber) {
    throw new Error("Phone number not found. Please log in again.");
  }

  const response = await fetch(`${BASE_URL}/wallet/transfer/online`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ phoneNumber, amount, description, transactionPin, requestRef }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Failed to transfer to online account.");
  }
  return data;
}

// ============================================
// VERIFY WALLET PIN 
// ============================================
export async function verifyWalletPin(walletId, pin) {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token found. Please log in again.");
  }

  const response = await fetch(
    `${BASE_URL}/wallet/verify/pin?walletId=${walletId}&unverifiedPin=${pin}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  
  const data = await response.json();
  
  if (!response.ok) {
    const errorMessage = data.detail || data.message || "PIN verification failed";
    throw new Error(errorMessage);
  }
  
  return data;
}

// ============================================
// SYNC OFFLINE TRANSACTIONS 
// ============================================
export async function syncTransaction({transactionRef, requestRef, type, entryType, status, amount, currency, description, senderWalletId, senderPhone, senderName, receiverWalletId, receiverPhone, receiverName, createdAt, }) {

  const token = getToken();
  if (!token) {
    throw new Error("No authentication token found. Please log in again.");
  }

  const response = await fetch(`${BASE_URL}/wallet/sync-transaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({transactionRef, requestRef, type, entryType, status, amount, currency, description, senderWalletId, senderPhone, senderName, receiverWalletId, receiverPhone, receiverName, createdAt,}),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data.detail || data.message || "Sync failed for transaction: " + transactionRef
    );
  }
  return data;
}

// ============================================
// FETCH UPDATED BALANCE
// ============================================
export async function fetchUpdatedBalance(walletId) {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token found. Please log in again.");
  }

  const response = await fetch(`${BASE_URL}/wallet/balance?walletId=${walletId}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Failed to fetch balance.");
  }
  return data;
}

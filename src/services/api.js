import { getValidToken } from "./token";
// const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:2000/api/v1";
const BASE_URL = "http://localhost:2000/api/v1";
import { readPersisted } from "./sessionUtils"; 

function getPhoneNumber() {
  return readPersisted("phoneNumber");
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
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }
  return data;
}

// ============================================
// CONFIRM PIN SET 
// ============================================
export async function checkPinSet(walletId) {
  const token = await getValidToken();
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

  const token = await getValidToken();
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
// CHANGE PIN
// ============================================
export async function changeWalletPin(oldPin, pin, confirmNewPin) {
  const phoneNumber = getPhoneNumber();
  if (!phoneNumber) {
    throw new Error("Phone number not found. Please log in again.");
  }
 
  const token = await getValidToken();
  if (!token) {
    throw new Error("No authentication token found. Please log in again.");
  }
 
  const response = await fetch(`${BASE_URL}/wallet/change-pin`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ phoneNumber, oldPin, pin, confirmNewPin }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Failed to change PIN. Please try again.");
  }
  return data;
}

// ============================================
// WALLET LOGOUT 
// ============================================
export async function logoutUser() {
  const token = await getValidToken();
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

  const token = await getValidToken();
  if (!token) {
    throw new Error("No authentication token found.");
  }

  const response = await fetch(`${BASE_URL}/wallet/funding/offline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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

   const token = await getValidToken();
    if (!token) {
      throw new Error("No authentication token found.");
    }

  const response = await fetch(`${BASE_URL}/wallet/transfer/online`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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
  const token = await getValidToken();
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
export async function syncTransaction(transaction) {

  if (!Array.isArray(transaction) || transaction.length === 0) {
      return { 
        succes: true,
        message: "No transaction to sync."
      };
  }

  const token = await getValidToken();
  if (!token) {
    throw new Error("No authentication token found. Please log in again.");
  }

  const response = await fetch(`${BASE_URL}/wallet/sync-transaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(transaction),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data.detail || data.message || `Sync failed for ${transaction.length} transaction(s).`
    );
  }
  return data;
}

export async function refreshToken() {
  const storedRefreshToken = localStorage.getItem("refreshToken");
  if (!storedRefreshToken) {
    throw new Error("NO_REFRESH_TOKEN");
  }

  const phoneNumber = getPhoneNumber();

  const response = await fetch(`${BASE_URL}/auth/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: storedRefreshToken, phoneNumber }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("REFRESH_INVALID");
    }
    throw new Error("REFRESH_TRANSIENT");
  }

  return response.json();
}

// ============================================
// PASSWORD RESET (Phone-number OTP)
// ============================================

export async function requestPasswordResetOtp(phoneNumber) {
  const response = await fetch(`${BASE_URL}/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });
  const data = await response.json();
  if (!response.ok) {
    const errorMessage = data.detail || data.message || "Something went wrong. Please try again.";
    const error = new Error(errorMessage);
    error.status = response.status;
    error.remainingSeconds = data.remainingSeconds;
    throw error;
  }
  return data;
}

export async function verifyPasswordResetOtp(phoneNumber, otp) {
  const response = await fetch(`${BASE_URL}/password-reset/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber, otp }),
  });
  const data = await response.json();
  if (!response.ok) {
    const errorMessage = data.detail || data.message || "The verification code is invalid.";
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function completePasswordReset(resetToken, newPassword, confirmPassword) {
  const response = await fetch(`${BASE_URL}/password-reset/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resetToken, newPassword, confirmPassword }),
  });
  const data = await response.json();
  if (!response.ok) {
    const errorMessage = data.detail || data.message || "Something went wrong. Please try again.";
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }
  return data;
}

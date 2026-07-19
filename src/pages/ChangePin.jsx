import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changeWalletPin } from "../services/api";
import { useNetwork } from "../hooks/useNetwork";
import { saveOfflinePinVerifier } from "../services/savePinVerifier.js";
import { rotateEncryptionPin } from "../services/cryptoService";
import "../styles/auth.css";

function ChangePin() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ oldPin: "", pin: "", confirmNewPin: "" });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOldPin, setShowOldPin] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmNewPin, setShowConfirmNewPin] = useState(false);
  const { isOffline } = useNetwork();

  function handleChange(e) {
    const { name, value } = e.target;
    // Only allow digits, max 4
    if (!/^\d*$/.test(value) || value.length > 4) return;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function validate() {
    const newErrors = {};
    if (!formData.oldPin || formData.oldPin.length < 4) {
      newErrors.oldPin = "Enter your current 4-digit PIN";
    }
    if (!formData.pin || formData.pin.length < 4) {
      newErrors.pin = "New PIN must be exactly 4 digits";
    } else if (formData.oldPin && formData.pin === formData.oldPin) {
      newErrors.pin = "New PIN must be different from your current PIN";
    }
    if (!formData.confirmNewPin) {
      newErrors.confirmNewPin = "Please confirm your new PIN";
    } else if (formData.confirmNewPin !== formData.pin) {
      newErrors.confirmNewPin = "PINs do not match";
    }
    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate("/offline", {
        state: { returnTo: "/change-pin" },
      });
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await changeWalletPin(formData.oldPin, formData.pin, formData.confirmNewPin);
      // Server accepted the change — now bring the local, PIN-derived
      // encryption key and offline verifier in line with the new PIN.
      await rotateEncryptionPin(formData.oldPin, formData.pin);
      await saveOfflinePinVerifier(formData.pin);
      navigate("/dashboard");
    } catch (err) {
      setErrors({ general: err.message || "Failed to change PIN. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔑</div>
          <h1 className="auth-title">Change your PIN</h1>
          <p className="auth-subtitle">
            Enter your current PIN, then choose a new 4-digit transaction PIN
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-field">
              <label htmlFor="oldPin">Current PIN</label>
              <div className="input-wrapper">
                <input
                  type={showOldPin ? "text" : "password"}
                  id="oldPin"
                  name="oldPin"
                  placeholder="• • • •"
                  value={formData.oldPin}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  className={errors.oldPin ? "has-error" : ""}
                  style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowOldPin((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showOldPin ? "Hide" : "Show"}
                </button>
              </div>
              {errors.oldPin && <p className="field-error">{errors.oldPin}</p>}
            </div>

            <div className="form-field">
              <label htmlFor="pin">New PIN</label>
              <div className="input-wrapper">
                <input
                  type={showPin ? "text" : "password"}
                  id="pin"
                  name="pin"
                  placeholder="• • • •"
                  value={formData.pin}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={4}
                  className={errors.pin ? "has-error" : ""}
                  style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPin((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showPin ? "Hide" : "Show"}
                </button>
              </div>
              {errors.pin && <p className="field-error">{errors.pin}</p>}
            </div>

            <div className="form-field">
              <label htmlFor="confirmNewPin">Confirm new PIN</label>
              <div className="input-wrapper">
                <input
                  type={showConfirmNewPin ? "text" : "password"}
                  id="confirmNewPin"
                  name="confirmNewPin"
                  placeholder="• • • •"
                  value={formData.confirmNewPin}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={4}
                  className={errors.confirmNewPin ? "has-error" : ""}
                  style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmNewPin((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showConfirmNewPin ? "Hide" : "Show"}
                </button>
              </div>
              {errors.confirmNewPin && <p className="field-error">{errors.confirmNewPin}</p>}
            </div>

            <p className="field-hint" style={{ textAlign: "center" }}>
              Avoid simple PINs like 1234 or 0000
            </p>
          </div>

          {errors.general && <p className="field-error">{errors.general}</p>}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Changing PIN..." : "Confirm change"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangePin;







// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { changeWalletPin } from "../services/api";
// import { useNetwork } from "../hooks/useNetwork";
// import { saveOfflinePinVerifier } from "../services/savePinVerifier.js";
// import { rotateEncryptionPin } from "../services/cryptoService";
// import "../styles/auth.css";

// function ChangePin() {
//   const navigate = useNavigate();

//   const [formData, setFormData] = useState({ oldPin: "", pin: "", confirmNewPin: "" });
//   const [errors, setErrors] = useState({});
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const { isOffline } = useNetwork();

//   function handleChange(e) {
//     const { name, value } = e.target;
//     // Only allow digits, max 4
//     if (!/^\d*$/.test(value) || value.length > 4) return;
//     setFormData((prev) => ({ ...prev, [name]: value }));
//     if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
//   }

//   function validate() {
//     const newErrors = {};
//     if (!formData.oldPin || formData.oldPin.length < 4) {
//       newErrors.oldPin = "Enter your current 4-digit PIN";
//     }
//     if (!formData.pin || formData.pin.length < 4) {
//       newErrors.pin = "New PIN must be exactly 4 digits";
//     } else if (formData.oldPin && formData.pin === formData.oldPin) {
//       newErrors.pin = "New PIN must be different from your current PIN";
//     }
//     if (!formData.confirmNewPin) {
//       newErrors.confirmNewPin = "Please confirm your new PIN";
//     } else if (formData.confirmNewPin !== formData.pin) {
//       newErrors.confirmNewPin = "PINs do not match";
//     }
//     return newErrors;
//   }

//   async function handleSubmit(e) {
//     e.preventDefault();

//     if (isOffline) {
//       navigate("/offline", {
//         state: { returnTo: "/change-pin" },
//       });
//       return;
//     }

//     const validationErrors = validate();
//     if (Object.keys(validationErrors).length > 0) {
//       setErrors(validationErrors);
//       return;
//     }

//     setIsSubmitting(true);

//     try {
//       await changeWalletPin(formData.oldPin, formData.pin, formData.confirmNewPin);
//       // Server accepted the change — now bring the local, PIN-derived
//       // encryption key and offline verifier in line with the new PIN.
//       await rotateEncryptionPin(formData.oldPin, formData.pin);
//       await saveOfflinePinVerifier(formData.pin);
//       navigate("/dashboard");
//     } catch (err) {
//       setErrors({ general: err.message || "Failed to change PIN. Please try again." });
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   return (
//     <div className="auth-page">
//       <div className="auth-card">
//         <div className="auth-header">
//           <div style={{ fontSize: 28, marginBottom: 12 }}>🔑</div>
//           <h1 className="auth-title">Change your PIN</h1>
//           <p className="auth-subtitle">
//             Enter your current PIN, then choose a new 4-digit transaction PIN
//           </p>
//         </div>

//         <form className="auth-form" onSubmit={handleSubmit} noValidate>
//           <div className="form-section">
//             <div className="form-field">
//               <label htmlFor="oldPin">Current PIN</label>
//               <div className="input-wrapper">
//                 <input
//                   type="password"
//                   id="oldPin"
//                   name="oldPin"
//                   placeholder="• • • •"
//                   value={formData.oldPin}
//                   onChange={handleChange}
//                   inputMode="numeric"
//                   maxLength={4}
//                   autoFocus
//                   className={errors.oldPin ? "has-error" : ""}
//                   style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
//                 />
//               </div>
//               {errors.oldPin && <p className="field-error">{errors.oldPin}</p>}
//             </div>

//             <div className="form-field">
//               <label htmlFor="pin">New PIN</label>
//               <div className="input-wrapper">
//                 <input
//                   type="password"
//                   id="pin"
//                   name="pin"
//                   placeholder="• • • •"
//                   value={formData.pin}
//                   onChange={handleChange}
//                   inputMode="numeric"
//                   maxLength={4}
//                   className={errors.pin ? "has-error" : ""}
//                   style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
//                 />
//               </div>
//               {errors.pin && <p className="field-error">{errors.pin}</p>}
//             </div>

//             <div className="form-field">
//               <label htmlFor="confirmNewPin">Confirm new PIN</label>
//               <div className="input-wrapper">
//                 <input
//                   type="password"
//                   id="confirmNewPin"
//                   name="confirmNewPin"
//                   placeholder="• • • •"
//                   value={formData.confirmNewPin}
//                   onChange={handleChange}
//                   inputMode="numeric"
//                   maxLength={4}
//                   className={errors.confirmNewPin ? "has-error" : ""}
//                   style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
//                 />
//               </div>
//               {errors.confirmNewPin && <p className="field-error">{errors.confirmNewPin}</p>}
//             </div>

//             <p className="field-hint" style={{ textAlign: "center" }}>
//               Avoid simple PINs like 1234 or 0000
//             </p>
//           </div>

//           {errors.general && <p className="field-error">{errors.general}</p>}

//           <button type="submit" className="btn-primary" disabled={isSubmitting}>
//             {isSubmitting ? "Changing PIN..." : "Confirm change"}
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// }

// export default ChangePin;
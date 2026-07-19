import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setWalletPin } from "../services/api";
import { useNetwork } from "../hooks/useNetwork";
import { saveOfflinePinVerifier } from "../services/savePinVerifier.js";
import { initializeEncryption } from "../services/cryptoService";
import "../styles/auth.css";

function SetPin() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ pin: "", confirmNewPin: "" });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    if (!formData.pin || formData.pin.length < 4) {
      newErrors.pin = "PIN must be exactly 4 digits";
    }
    if (!formData.confirmNewPin) {
      newErrors.confirmNewPin = "Please confirm your PIN";
    } else if (formData.confirmNewPin !== formData.pin) {
      newErrors.confirmNewPin = "PINs do not match";
    }
    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();

      if (isOffline) {
        navigate("/offline", {
          state: { returnTo: "/set-pin" },
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
        await setWalletPin(formData.pin, formData.confirmNewPin);
        await saveOfflinePinVerifier(formData.pin);
        await initializeEncryption(formData.pin);
        navigate("/dashboard");
    } catch (err) {
      setErrors({ general: err.message || "Failed to set PIN. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔐</div>
          <h1 className="auth-title">Create your PIN</h1>
          <p className="auth-subtitle">
            Choose a 4-digit transaction PIN to secure your wallet
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-field">
              <label htmlFor="pin">Transaction PIN</label>
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
              <label htmlFor="confirmNewPin">Confirm PIN</label>
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
            {isSubmitting ? "Setting PIN..." : "Confirm PIN"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SetPin;




// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { setWalletPin } from "../services/api";
// import { useNetwork } from "../hooks/useNetwork";
// import { saveOfflinePinVerifier } from "../services/savePinVerifier.js";
// import { initializeEncryption } from "../services/cryptoService";
// import "../styles/auth.css";

// function SetPin() {
//   const navigate = useNavigate();

//   const [formData, setFormData] = useState({ pin: "", confirmNewPin: "" });
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
//     if (!formData.pin || formData.pin.length < 4) {
//       newErrors.pin = "PIN must be exactly 4 digits";
//     }
//     if (!formData.confirmNewPin) {
//       newErrors.confirmNewPin = "Please confirm your PIN";
//     } else if (formData.confirmNewPin !== formData.pin) {
//       newErrors.confirmNewPin = "PINs do not match";
//     }
//     return newErrors;
//   }

//   async function handleSubmit(e) {
//     e.preventDefault();

//       if (isOffline) {
//         navigate("/offline", {
//           state: { returnTo: "/set-pin" },
//         });
//         return;
//       }

//     const validationErrors = validate();
//     if (Object.keys(validationErrors).length > 0) {
//       setErrors(validationErrors);
//       return;
//     }

//     setIsSubmitting(true);

//     try {
//         await setWalletPin(formData.pin, formData.confirmNewPin);
//         await saveOfflinePinVerifier(formData.pin);
//         await initializeEncryption(formData.pin);
//         navigate("/dashboard");
//     } catch (err) {
//       setErrors({ general: err.message || "Failed to set PIN. Please try again." });
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   return (
//     <div className="auth-page">
//       <div className="auth-card">
//         <div className="auth-header">
//           <div style={{ fontSize: 28, marginBottom: 12 }}>🔐</div>
//           <h1 className="auth-title">Create your PIN</h1>
//           <p className="auth-subtitle">
//             Choose a 4-digit transaction PIN to secure your wallet
//           </p>
//         </div>

//         <form className="auth-form" onSubmit={handleSubmit} noValidate>
//           <div className="form-section">
//             <div className="form-field">
//               <label htmlFor="pin">Transaction PIN</label>
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
//               <label htmlFor="confirmNewPin">Confirm PIN</label>
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
//             {isSubmitting ? "Setting PIN..." : "Confirm PIN"}
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// }

// export default SetPin;
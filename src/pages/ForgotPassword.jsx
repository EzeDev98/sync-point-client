import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { requestPasswordResetOtp } from "../services/api";
import { useNetwork } from "../hooks/useNetwork";
import { setPhoneNumber as savePhoneNumber } from "../services/PasswordResetState";
import "../styles/auth.css";

function ForgotPassword() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();

  const [phoneNumber, setPhoneNumberInput] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(e) {
    setPhoneNumberInput(e.target.value);
    if (errors.phoneNumber) setErrors((prev) => ({ ...prev, phoneNumber: "" }));
  }

  function validate() {
    const newErrors = {};
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    } else if (!/^\d{10,11}$/.test(phoneNumber.replace(/\D/g, ""))) {
      newErrors.phoneNumber = "Please enter a valid phone number";
    }
    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate("/offline", { state: { returnTo: "/forgot-password" } });
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await requestPasswordResetOtp(phoneNumber);
      savePhoneNumber(phoneNumber);
      navigate("/forgot-password/verify");
    } catch (err) {
      if (err.status === 429) {
        setErrors({
          general: err.message || "Please wait before requesting another code.",
        });
      } else {
        setErrors({ general: err.message || "Something went wrong. Please try again." });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Forgot password?</h1>
          <p className="auth-subtitle">
            Enter the phone number associated with your account.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-field">
              <label htmlFor="phoneNumber">Phone Number</label>
              <div className="input-wrapper">
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  placeholder="08012345678"
                  value={phoneNumber}
                  onChange={handleChange}
                  className={errors.phoneNumber ? "has-error" : ""}
                />
              </div>
              {errors.phoneNumber && <p className="field-error">{errors.phoneNumber}</p>}
            </div>
          </div>

          {errors.general && <p className="field-error">{errors.general}</p>}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Sending code..." : "Send OTP"}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login" className="auth-link">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
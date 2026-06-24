import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";
import "../styles/register.css";

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    username: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    gender: "",
    dateOfBirth: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for this field as user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  }

  function validateStep1() {
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.username.trim()) newErrors.username = "Username is required";
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Enter a valid email address";
    }
    
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    }

    return newErrors;
  }

  function validateStep2() {
    const newErrors = {};

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.gender) newErrors.gender = "Please select a gender";
    if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";

    return newErrors;
  }

  async function handleNext() {
    const validationErrors = validateStep1();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setStep(2);
    setErrors({});
  }

  async function handleBack() {
    setStep(1);
    setErrors({});
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validationErrors = validateStep2();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {

      await registerUser(formData);
    
      navigate('/login', {
        state: {message: 'Registration successful! Please login'}
      });

    } catch (err) {
    console.error("Registration error:", err);
    if (err.response) {
      setErrors({ general: err.response.data.message || "Registration failed. Please try again." });
    } else if (err.request) {
      setErrors({ general: "No response from server. Please check your connection." });
    } else {
      setErrors({ general: "Registration failed. Please try again." });
    }
  } finally {
    setIsSubmitting(false);
  }
}

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <div className="auth-header auth-header--centered">
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">Join SyncPoint Today</p>
          <div className="step-indicator">
            <div className={`step ${step === 1 ? "active" : "completed"}`}>
              <span className="step-number">1</span>
              <span className="step-label">Basic Info</span>
            </div>
            <div className="step-line"></div>
            <div className={`step ${step === 2 ? "active" : ""}`}>
              <span className="step-number">2</span>
              <span className="step-label">Security & Demographics</span>
            </div>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-slider-horizontal">
            <div className={`form-steps-container step-${step}`}>
              {/* Step 1 */}
              <div className="form-step-horizontal">
                <div className="form-section">
                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor="firstName">First name</label>
                      <div className="input-wrapper">
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          placeholder="John"
                          value={formData.firstName}
                          onChange={handleChange}
                          className={errors.firstName ? "has-error" : ""}
                        />
                      </div>
                      {errors.firstName && <p className="field-error">{errors.firstName}</p>}
                    </div>

                    <div className="form-field">
                      <label htmlFor="lastName">Last name</label>
                      <div className="input-wrapper">
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          placeholder="Doe"
                          value={formData.lastName}
                          onChange={handleChange}
                          className={errors.lastName ? "has-error" : ""}
                        />
                      </div>
                      {errors.lastName && <p className="field-error">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="middleName">Middle name <span className="optional-label">(optional)</span></label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        id="middleName"
                        name="middleName"
                        placeholder="Optional"
                        value={formData.middleName}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="username">Username</label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        id="username"
                        name="username"
                        placeholder="johndoe"
                        value={formData.username}
                        onChange={handleChange}
                        className={errors.username ? "has-error" : ""}
                      />
                    </div>
                    {errors.username && <p className="field-error">{errors.username}</p>}
                  </div>

                  <div className="form-field">
                    <label htmlFor="email">Email</label>
                    <div className="input-wrapper">
                      <input
                        type="email"
                        id="email"
                        name="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        className={errors.email ? "has-error" : ""}
                      />
                    </div>
                    {errors.email && <p className="field-error">{errors.email}</p>}
                  </div>

                  <div className="form-field">
                    <label htmlFor="phoneNumber">Phone number</label>
                    <div className="input-wrapper">
                      <input
                        type="tel"
                        id="phoneNumber"
                        name="phoneNumber"
                        placeholder="08012345678"
                        value={formData.phoneNumber}
                        onChange={handleChange}
                        className={errors.phoneNumber ? "has-error" : ""}
                      />
                    </div>
                    {errors.phoneNumber && <p className="field-error">{errors.phoneNumber}</p>}
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="form-step-horizontal">
                <div className="form-section">
                  <div className="form-field">
                    <label htmlFor="password">Password</label>
                    <div className="input-wrapper">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        name="password"
                        placeholder="Enter a password"
                        value={formData.password}
                        onChange={handleChange}
                        className={errors.password ? "has-error" : "password-field"}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword((prev) => !prev)}
                        tabIndex={-1}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    {errors.password ? (
                      <p className="field-error">{errors.password}</p>
                    ) : (
                      <p className="field-hint">Minimum 6 characters</p>
                    )}
                  </div>

                  <div className="form-field">
                    <label htmlFor="confirmPassword">Confirm password</label>
                    <div className="input-wrapper">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        name="confirmPassword"
                        placeholder="Re-enter your password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={errors.confirmPassword ? "has-error" : "password-field"}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
                  </div>

                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor="gender">Gender</label>
                      <div className="input-wrapper">
                        <select
                          id="gender"
                          name="gender"
                          value={formData.gender}
                          onChange={handleChange}
                          className={errors.gender ? "has-error" : ""}
                        >
                          <option value="">Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      {errors.gender && <p className="field-error">{errors.gender}</p>}
                    </div>

                    <div className="form-field">
                      <label htmlFor="dateOfBirth">Date of birth</label>
                      <div className="input-wrapper">
                        <input
                          type="date"
                          id="dateOfBirth"
                          name="dateOfBirth"
                          value={formData.dateOfBirth}
                          onChange={handleChange}
                          className={errors.dateOfBirth ? "has-error" : ""}
                        />
                      </div>
                      {errors.dateOfBirth && <p className="field-error">{errors.dateOfBirth}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {errors.general && <p className="field-error">{errors.general}</p>}

          <div className="button-group">
            {step === 1 && (
              <button type="button" className="btn-primary" onClick={handleNext}>
                Next
              </button>
            )}
            {step === 2 && (
              <>
                <button type="button" className="btn-secondary" onClick={handleBack}>
                  Back
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Register"}
                </button>
              </>
            )}
          </div>
        </form>

        <div className="auth-links">
          <p className="auth-footer-text">
            Already have an account?
            <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
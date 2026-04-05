import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("adopter");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "",
    address: "", city: "", state: "", cityPIN: "",
    shelterName: "", ownerName: "",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const extraData = role === "shelter"
        ? { name: form.shelterName, ownerName: form.ownerName, address: form.address, city: form.city, state: form.state, cityPIN: form.cityPIN, phone: form.phone }
        : { name: form.name, address: form.address, city: form.city, state: form.state, cityPIN: form.cityPIN, phone: form.phone };
      await register(form.email, form.password, role, extraData);
      navigate(role === "shelter" ? "/shelter-dashboard" : "/adopter-dashboard");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    try {
      const extraData = role === "shelter"
        ? { name: form.shelterName, ownerName: form.ownerName, address: form.address, city: form.city, state: form.state, cityPIN: form.cityPIN, phone: form.phone }
        : { name: form.name, address: form.address, city: form.city, state: form.state, cityPIN: form.cityPIN, phone: form.phone };
      await loginWithGoogle(role, extraData);
      navigate(role === "shelter" ? "/shelter-dashboard" : "/adopter-dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Join PawsFind</h1>
        <p className="auth-subtitle">Create your account to get started</p>

        <div className="auth-role-tabs">
          <button type="button" className={role === "adopter" ? "active" : ""} onClick={() => setRole("adopter")}>
            🏠 Adopter
          </button>
          <button type="button" className={role === "shelter" ? "active" : ""} onClick={() => setRole("shelter")}>
            🏢 Shelter
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {role === "adopter" ? (
            <div><label>Full Name</label>
              <input name="name" placeholder="Your name" onChange={handleChange} required /></div>
          ) : (
            <>
              <div><label>Shelter Name</label>
                <input name="shelterName" placeholder="Shelter or organisation name" onChange={handleChange} required /></div>
              <div><label>Shelter Owner Name</label>
                <input name="ownerName" placeholder="Shelter Owner's full name" onChange={handleChange} required /></div>
            </>
          )}
          <div><label>Email</label>
            <input name="email" type="email" placeholder="email@example.com" onChange={handleChange} required /></div>
          <div><label>Password</label>
            <div style={{ position: "relative" }}>
              <input name="password" type={showPassword ? "text" : "password"} placeholder="Min 6 characters" onChange={handleChange} required style={{ width: "100%", paddingRight: "40px", boxSizing: "border-box" }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }} title={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <div><label>Phone</label>
            <input name="phone" placeholder="10-digit phone" onChange={handleChange} required /></div>
          <div><label>Address</label>
            <input name="address" placeholder="Street address" onChange={handleChange} required /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div><label>City</label>
              <input name="city" placeholder="City" onChange={handleChange} required /></div>
            <div><label>State</label>
              <input name="state" placeholder="State" onChange={handleChange} required /></div>
          </div>
          <div><label>PIN Code</label>
            <input name="cityPIN" placeholder="6-digit PIN" onChange={handleChange} required /></div>
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: "100%", padding: "14px" }}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-divider">or</div>
        <button type="button" className="btn-google" onClick={handleGoogle}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="G" />
          Continue with Google
        </button>
        <p className="auth-link" style={{ marginTop: "24px" }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/navbar.css";

export default function Navbar() {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          🐾 Paws<span>Find</span>
        </Link>
        <div className="navbar-links">
          <Link to="/">Browse Pets</Link>
          {!currentUser && (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">
                <button className="btn-primary" style={{ padding: "8px 20px", fontSize: "0.88rem" }}>
                  Register
                </button>
              </Link>
            </>
          )}
          {currentUser && userRole === "shelter" && (
            <Link to="/shelter-dashboard">Dashboard</Link>
          )}
          {currentUser && userRole === "adopter" && (
            <Link to="/adopter-dashboard">My Adoptions</Link>
          )}
        </div>
        {currentUser && (
          <div className="navbar-user">
            <div className="avatar">
              {currentUser.email[0].toUpperCase()}
            </div>
            <button className="btn-outline" onClick={handleLogout}
              style={{ padding: "7px 16px", fontSize: "0.85rem" }}>
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
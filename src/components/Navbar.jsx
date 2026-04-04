import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/navbar.css";

export default function Navbar() {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const isActive = (path) => location.pathname === path ? "active" : "";

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <span className="logo-paw">🐾</span> Paws<span>Find</span>
        </Link>

        <div className="navbar-links">
          <Link to="/" className={isActive("/")}>Browse Pets</Link>
          {!currentUser && (
            <>
              <Link to="/login" className={isActive("/login")}>Login</Link>
              <Link to="/register">
                <button className="btn-primary" style={{ padding: "8px 20px", fontSize: "0.85rem" }}>
                  Register
                </button>
              </Link>
            </>
          )}
          {currentUser && userRole === "shelter" && (
            <Link to="/shelter-dashboard" className={isActive("/shelter-dashboard")}>Dashboard</Link>
          )}
          {currentUser && userRole === "adopter" && (
            <Link to="/adopter-dashboard" className={isActive("/adopter-dashboard")}>My Adoptions</Link>
          )}
        </div>

        {currentUser && (
          <div className="navbar-user">
            {userRole && (
              <span className="navbar-role">{userRole}</span>
            )}
            <div className="avatar" title={currentUser.email}>
              {currentUser.email[0].toUpperCase()}
            </div>
            <button className="btn-outline" onClick={handleLogout}
              style={{ padding: "7px 16px", fontSize: "0.83rem" }}>
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
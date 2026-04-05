import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import "../styles/navbar.css";

export default function Navbar() {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const dropdownRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    async function fetchName() {
      if (!currentUser) { setUserName(""); return; }
      if (currentUser.displayName) setUserName(currentUser.displayName);
      try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        if (snap.exists() && snap.data().name) {
          setUserName(snap.data().name);
        }
      } catch (err) { console.error(err); }
    }
    fetchName();
  }, [currentUser]);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setMenuOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (path) => location.pathname === path ? "active" : "";

  return (
    <nav className="navbar">
      <style>{`
        .mobile-toggle { display: none; cursor: pointer; }
        @keyframes dropdownAnim {
          0% { opacity: 0; transform: translateY(-10px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mobile-overlay {
          position: fixed; top: 66px; left: 0; right: 0; bottom: 0;
          background: rgba(5, 8, 16, 0.5); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
          z-index: 9998; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
        }
        .mobile-dropdown-menu {
          position: absolute; top: calc(100% + 16px); right: 0;
          background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(16px);
          border: 1px solid var(--border, #334155);
          border-radius: 12px; padding: 12px; display: flex;
          flex-direction: column; gap: 4px; box-shadow: 0 16px 40px rgba(0,0,0,0.6);
          min-width: 210px; z-index: 9999;
          transform-origin: top right;
          animation: dropdownAnim 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .profile-dropdown-menu {
          position: absolute; top: calc(100% + 16px); right: 0;
          background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(16px);
          border: 1px solid var(--border, #334155);
          border-radius: 12px; padding: 12px; display: flex;
          flex-direction: column; gap: 4px; box-shadow: 0 16px 40px rgba(0,0,0,0.6);
          min-width: 210px; z-index: 9999;
          transform-origin: top right;
          animation: dropdownAnim 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .mobile-dropdown-menu a { color: var(--text); text-decoration: none; padding: 10px 14px; border-radius: 8px; transition: 0.2s; font-size: 0.95rem; font-weight: 500; }
        .mobile-dropdown-menu a:hover, .mobile-dropdown-menu a.active { background: rgba(79,142,247,0.15); color: var(--accent); }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: block; }
          .mobile-overlay.open { opacity: 1; pointer-events: auto; }
        }
      `}</style>
      <div className={`mobile-overlay ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)}></div>
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <span className="logo-paw">🐾</span> Paws<span>Find</span>
        </Link>

        <div className="navbar-links desktop-nav">
          <Link to="/" className={isActive("/")}>Browse Pets</Link>
          {!currentUser && (
            <>
              <Link to="/login" className={isActive("/login")}>Login</Link>
              <Link to="/register">
                <button className="btn-primary" style={{ padding: "8px 18px", fontSize: "0.83rem" }}>
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
          <div className="navbar-user desktop-nav" ref={profileRef} style={{ position: "relative" }}>
            {userRole && <span className="navbar-role">{userRole}</span>}
            <div className="avatar" onClick={() => setProfileOpen(!profileOpen)} style={{ cursor: "pointer" }} title="Profile">
              {userName ? userName[0].toUpperCase() : currentUser.email[0].toUpperCase()}
            </div>
            {profileOpen && (
              <div className="profile-dropdown-menu">
                <div style={{ padding: "4px 12px 12px", borderBottom: "1px solid var(--border)", marginBottom: "8px" }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", marginBottom: "2px" }}>
                    {userName || (userRole === "shelter" ? "Shelter" : "Adopter")}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>
                    {currentUser.email}
                  </div>
                </div>
                <button className="btn-outline" onClick={handleLogout}
                  style={{ padding: "8px", fontSize: "0.85rem", width: "100%", textAlign: "center" }}>
                  Logout
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mobile Toggle & Dropdown */}
        <div className="mobile-toggle" ref={dropdownRef} style={{ position: "relative" }}>
          <div onClick={() => setMenuOpen(!menuOpen)} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {currentUser && userRole && <span className="navbar-role">{userRole}</span>}
            {currentUser ? (
              <div className="avatar" title="Menu">
                {userName ? userName[0].toUpperCase() : currentUser.email[0].toUpperCase()}
              </div>
            ) : (
              <div style={{ fontSize: "1.8rem", color: "var(--text)" }}>☰</div>
            )}
          </div>

          {menuOpen && (
            <div className="mobile-dropdown-menu">
              {currentUser && (
                <div style={{ padding: "4px 12px 12px", borderBottom: "1px solid var(--border)", marginBottom: "8px" }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", marginBottom: "2px" }}>
                    {userName || (userRole === "shelter" ? "Shelter" : "Adopter")}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>
                    {currentUser.email}
                  </div>
                </div>
              )}
              <Link to="/" className={isActive("/")}>Browse Pets</Link>
              {!currentUser && (
                <>
                  <Link to="/login" className={isActive("/login")}>Login</Link>
                  <Link to="/register" className={isActive("/register")}>Register</Link>
                </>
              )}
              {currentUser && userRole === "shelter" && (
                <Link to="/shelter-dashboard" className={isActive("/shelter-dashboard")}>Dashboard</Link>
              )}
              {currentUser && userRole === "adopter" && (
                <Link to="/adopter-dashboard" className={isActive("/adopter-dashboard")}>My Adoptions</Link>
              )}
              {currentUser && (
                <button className="btn-outline" onClick={handleLogout}
                  style={{ padding: "8px", fontSize: "0.85rem", width: "100%", marginTop: "4px", textAlign: "center" }}>
                  Logout
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
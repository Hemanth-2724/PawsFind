import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import {
  collection, getDocs, query, where,
  doc, updateDoc, getDoc, deleteDoc, onSnapshot
} from "firebase/firestore";
import "../styles/dashboard.css";

function AnimatedNumber({ value }) {
  const [count, setCount] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = parseInt(value, 10) || 0;
    if (start === end) { setCount(end); return; }
    
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / 1200, 1);
      const easeOut = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOut * (end - start) + start));
      if (progress < 1) window.requestAnimationFrame(step);
      else { setCount(end); prevValue.current = end; }
    };
    window.requestAnimationFrame(step);
  }, [value]);
  return <>{count}</>;
}

export default function AdopterDashboard() {
  const { currentUser } = useAuth();
  const [loading,        setLoading]        = useState(true);
  const [profile,        setProfile]        = useState({});
  const [adoptions,      setAdoptions]      = useState([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [activeTab,      setActiveTab]      = useState("adoptions");
  const [refreshing,     setRefreshing]     = useState(false);

  useEffect(() => { 
    loadData(); 
    
    if (!currentUser) return;
    // Listen for approval/rejection updates in real-time!
    const q = query(collection(db, "adoptions"), where("adopterID", "==", currentUser.uid));
    const unsubscribe = onSnapshot(q, () => {
      loadData();
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  async function loadData() {
    if (!currentUser) return;
    setRefreshing(true);
    const snap = await getDoc(doc(db, "adopters", currentUser.uid));
    if (snap.exists()) setProfile(snap.data());

    const adSnap = await getDocs(
      query(collection(db, "adoptions"), where("adopterID", "==", currentUser.uid))
    );
    const adData = adSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const enriched = await Promise.all(adData.map(async ad => {
      const petSnap = await getDoc(doc(db, "pets", ad.petID));
      return { ...ad, pet: petSnap.exists() ? petSnap.data() : null };
    }));
    setAdoptions(enriched);
    setLoading(false);
    setRefreshing(false);
  }

  async function cancelAdoption(id) {
    if (!window.confirm("Are you sure you want to withdraw this adoption request?")) return;
    
    // Optimistically remove it from the UI so it disappears instantly for the adopter
    setAdoptions(prev => prev.filter(ad => ad.id !== id));
    
    try {
      // Permanently deleting it from Firestore ensures the shelter's 
      // real-time listener will instantly erase it from their table as well!
      await deleteDoc(doc(db, "adoptions", id));
    } catch (err) {
      console.error("Failed to cancel request:", err);
      alert("Failed to withdraw request. Please try again.");
      await loadData(); // Revert the UI if the database deletion fails
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    await updateDoc(doc(db, "adopters", currentUser.uid), profile);
    await updateDoc(doc(db, "users",    currentUser.uid), { name: profile.name });
    setEditingProfile(false);
  }

  const TABS = [
    { key: "adoptions", label: "My Adoptions", icon: "", badge: adoptions.filter(a => !a.status || a.status === "Pending").length || null },
    { key: "profile",   label: "My Profile",   icon: "👤" },
  ];

  return (
    <div className="dashboard">
      <div className="container">

        {/* ── Header ── */}
        <div className="dashboard-header">
          <div className="dashboard-header-left">
            <div className="dashboard-eyebrow">Adopter Portal</div>
            <h1 className="dashboard-title">My Dashboard</h1>
            <p className="dashboard-subtitle">Welcome back, {profile.name || "Adopter"} </p>
          </div>
          <div className="dashboard-actions">
            <button className={`btn-refresh${refreshing ? " loading" : ""}`} onClick={() => window.location.reload()}>
              <span className="refresh-icon">↻</span> Refresh
            </button>
            <Link to="/">
              <button className="btn-primary">Browse Pets</button>
            </Link>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-icon"></span>
            <div className="number">{loading ? <div className="skeleton skeleton-number" /> : <AnimatedNumber value={adoptions.length} />}</div>
            <div className="label">Applications</div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎉</span>
            <div className="number">{loading ? <div className="skeleton skeleton-number" /> : <AnimatedNumber value={adoptions.filter(a => a.status === "Approved").length} />}</div>
            <div className="label">Approved</div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">⏱️</span>
            <div className="number" style={{ color: "var(--clr-warning)" }}>
              {loading ? <div className="skeleton skeleton-number" /> : <AnimatedNumber value={adoptions.filter(a => !a.status || a.status === "Pending").length} />}
            </div>
            <div className="label">Pending</div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="tab-row">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`tab-btn${activeTab === tab.key ? " active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="tab-badge">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Adoptions Tab ── */}
        {activeTab === "adoptions" && (
          <div className="table-wrap">
            <table className="pets-table">
              <thead>
                <tr><th>#</th><th>Pet</th><th>Species</th><th>Shelter / Owner</th><th>Date Applied</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {adoptions.length === 0 && (
                  <tr><td colSpan={7}>
                    <div className="table-empty">
                      <span className="empty-icon">📭</span>
                      No adoption requests yet.{" "}
                      <Link to="/" style={{ color: "var(--clr-accent)" }}>Browse pets →</Link>
                    </div>
                  </td></tr>
                )}
                {adoptions.map((ad, index) => (
                  <tr key={ad.id}>
                    <td style={{ color: "var(--clr-muted)" }}>{index + 1}</td>
                    <td>
                      <Link to={`/pet/${ad.petID}`}
                        style={{ color: "var(--clr-accent)", fontWeight: 500 }}>
                        {ad.pet?.name || ad.petID}
                      </Link>
                    </td>
                    <td style={{ color: "var(--clr-muted2)" }}>{ad.pet?.species || "—"}</td>
                    <td style={{ color: "var(--clr-muted2)" }}>
                      <div style={{ fontWeight: 500, color: "var(--clr-text)" }}>{ad.pet?.shelterName || "—"}</div>
                      {ad.pet?.shelterOwnerName && <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>Owner: {ad.pet.shelterOwnerName}</div>}
                    </td>
                    <td style={{ color: "var(--clr-muted2)", fontSize: "0.85rem" }}>
                      {ad.date?.toDate?.()?.toLocaleDateString() || ad.date}
                    </td>
                    <td>
                      <span className={`badge ${
                        ad.status === "Approved" ? "badge-success" :
                        ad.status === "Rejected" ? "" :
                        "badge-warning"
                      }`} style={ad.status === "Rejected" ? {
                        background: "rgba(240,112,112,0.1)",
                        color: "var(--clr-danger)",
                        border: "1px solid rgba(240,112,112,0.2)",
                      } : {}}>
                        {ad.status || "Pending"}
                      </span>
                    </td>
                    <td>
                      {(!ad.status || ad.status === "Pending") ? (
                        <div className="table-actions">
                          <button
                            className="btn-danger has-tooltip"
                            data-tooltip="Withdraw request"
                            style={{ padding: "6px 12px", fontSize: "0.8rem", background: "transparent", color: "var(--clr-danger)", border: "1px solid var(--clr-danger)" }}
                            onClick={() => cancelAdoption(ad.id)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.85rem", color: "var(--clr-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Profile Tab ── */}
        {activeTab === "profile" && (
          <div className="profile-section">
            <div className="profile-header">
              <h2 className="profile-title">My Profile</h2>
              <button className="btn-outline" onClick={() => setEditingProfile(!editingProfile)}>
                {editingProfile ? "Cancel" : "Edit Profile"}
              </button>
            </div>
            {editingProfile ? (
              <form onSubmit={saveProfile}>
                <div className="profile-grid">
                  {[
                    ["name",    "Full Name"],
                    ["phone",   "Phone"],
                    ["address", "Address"],
                    ["city",    "City"],
                    ["state",   "State"],
                    ["cityPIN", "PIN Code"],
                  ].map(([field, label]) => (
                    <div className="form-group" key={field}>
                      <label>{label}</label>
                      <input
                        value={profile[field] || ""}
                        onChange={e => setProfile({ ...profile, [field]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <button className="btn-primary" type="submit" style={{ marginTop: "20px" }}>
                  Save Changes
                </button>
              </form>
            ) : (
              <div className="profile-grid">
                {[
                  ["name",    "Full Name"],
                  ["phone",   "Phone"],
                  ["email",   "Email"],
                  ["address", "Address"],
                  ["city",    "City"],
                  ["state",   "State"],
                  ["cityPIN", "PIN Code"],
                ].map(([field, label]) => (
                  <div className="profile-field" key={field}>
                    <div className="field-label">{label}</div>
                    <div className="field-value">{profile[field] || "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
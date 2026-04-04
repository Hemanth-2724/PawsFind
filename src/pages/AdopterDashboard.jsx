import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import {
  collection, getDocs, query, where,
  doc, updateDoc, getDoc,
} from "firebase/firestore";
import "../styles/dashboard.css";

export default function AdopterDashboard() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState({});
  const [adoptions, setAdoptions] = useState([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState("adoptions");

  useEffect(() => {
    loadData();
  }, [currentUser]);

  async function loadData() {
    if (!currentUser) return;
    const snap = await getDoc(doc(db, "adopters", currentUser.uid));
    if (snap.exists()) setProfile(snap.data());
    const adSnap = await getDocs(query(collection(db, "adoptions"), where("adopterID", "==", currentUser.uid)));
    const adData = adSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Enrich with pet details
    const enriched = await Promise.all(adData.map(async ad => {
      const petSnap = await getDoc(doc(db, "pets", ad.petID));
      return { ...ad, pet: petSnap.exists() ? petSnap.data() : null };
    }));
    setAdoptions(enriched);
  }

  async function saveProfile(e) {
    e.preventDefault();
    await updateDoc(doc(db, "adopters", currentUser.uid), profile);
    await updateDoc(doc(db, "users", currentUser.uid), { name: profile.name });
    setEditingProfile(false);
  }

  return (
    <div className="dashboard">
      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">My Dashboard</h1>
            <p className="dashboard-subtitle">Welcome back, {profile.name || "Adopter"}</p>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="number">{adoptions.length}</div>
            <div className="label">Adoption Requests</div>
          </div>
          <div className="stat-card">
            <div className="number">{adoptions.filter(a => a.status === "Approved").length}</div>
            <div className="label">Approved</div>
          </div>
          <div className="stat-card">
            <div className="number">{adoptions.filter(a => !a.status || a.status === "Pending").length}</div>
            <div className="label">Pending</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
          {["adoptions","profile"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 20px", borderRadius: "var(--radius-sm)",
                background: activeTab === tab ? "var(--clr-accent)" : "var(--clr-card)",
                border: "1px solid var(--clr-border)",
                color: activeTab === tab ? "#fff" : "var(--clr-muted)",
                textTransform: "capitalize", fontSize: "0.9rem",
              }}>
              {tab === "adoptions" ? "📋 My Adoptions" : "⚙️ My Profile"}
            </button>
          ))}
        </div>

        {activeTab === "adoptions" && (
          <div className="table-wrap">
            <table className="pets-table">
              <thead><tr><th>Pet</th><th>Species</th><th>Breed</th><th>Date Applied</th><th>Status</th></tr></thead>
              <tbody>
                {adoptions.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--clr-muted)", padding: "40px" }}>
                    No adoption requests yet. <a href="/" style={{ color: "var(--clr-accent)" }}>Browse pets →</a>
                  </td></tr>
                )}
                {adoptions.map(ad => (
                  <tr key={ad.id}>
                    <td>
                      <Link to={`/pet/${ad.petID}`} style={{ color: "var(--clr-accent)", textDecoration: "none", fontWeight: "bold" }}>
                        {ad.pet?.name || ad.petID}
                      </Link>
                    </td>
                    <td>{ad.pet?.species || "—"}</td>
                    <td>{ad.pet?.breed || "—"}</td>
                    <td>{ad.date?.toDate?.()?.toLocaleDateString() || ad.date}</td>
                    <td>
                      <span className={`badge ${ad.status === "Approved" ? "badge-success" : ad.status === "Rejected" ? "" : "badge-warning"}`}
                        style={ad.status === "Rejected" ? { background: "rgba(248,113,113,0.12)", color: "var(--clr-danger)" } : {}}>
                        {ad.status || "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="profile-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 className="section-title" style={{ margin: 0 }}>My Profile</h2>
              <button className="btn-outline" onClick={() => setEditingProfile(!editingProfile)}>
                {editingProfile ? "Cancel" : "Edit Profile"}
              </button>
            </div>
            {editingProfile ? (
              <form onSubmit={saveProfile}>
                <div className="profile-grid">
                  {[["name","Full Name"],["phone","Phone"],["address","Address"],["city","City"],["state","State"],["cityPIN","PIN Code"]].map(([field, label]) => (
                    <div className="form-group" key={field}>
                      <label>{label}</label>
                      <input value={profile[field] || ""} onChange={e => setProfile({ ...profile, [field]: e.target.value })} />
                    </div>
                  ))}
                </div>
                <button className="btn-primary" type="submit" style={{ marginTop: "16px" }}>Save Changes</button>
              </form>
            ) : (
              <div className="profile-grid">
                {[["name","Full Name"],["phone","Phone"],["email","Email"],["address","Address"],["city","City"],["state","State"],["cityPIN","PIN Code"]].map(([field, label]) => (
                  <div key={field}>
                    <div style={{ fontSize: "0.82rem", color: "var(--clr-muted)", marginBottom: "4px" }}>{label}</div>
                    <div>{profile[field] || "—"}</div>
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
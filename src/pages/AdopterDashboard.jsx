import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import {
  collection, getDocs, query, where,
  doc, updateDoc, getDoc, deleteDoc, onSnapshot, addDoc
} from "firebase/firestore";
import "../styles/dashboard.css";

function AnimatedNumber({ value }) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current, end = parseInt(value, 10) || 0;
    if (start === end) { setCount(end); return; }
    let ts = null;
    const step = (t) => {
      if (!ts) ts = t;
      const p = Math.min((t - ts) / 1200, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 4)) * (end - start) + start));
      if (p < 1) requestAnimationFrame(step);
      else { setCount(end); prev.current = end; }
    };
    requestAnimationFrame(step);
  }, [value]);
  return <>{count}</>;
}

export default function AdopterDashboard() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({});
  const [adoptions, setAdoptions] = useState([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState("adoptions");
  const [refreshing, setRefreshing] = useState(false);
  const [adoptionFilter, setAdoptionFilter] = useState("All");

  useEffect(() => {
    loadData();
    if (!currentUser) return;
    const q = query(collection(db, "adoptions"), where("adopterID", "==", currentUser.uid));
    const unsub = onSnapshot(q, () => loadData());
    return () => unsub();
  }, [currentUser]);

  async function loadData() {
    if (!currentUser) return;
    setRefreshing(true);
    const snap = await getDoc(doc(db, "adopters", currentUser.uid));
    if (snap.exists()) setProfile(snap.data());
    const adSnap = await getDocs(query(collection(db, "adoptions"), where("adopterID", "==", currentUser.uid)));
    const adData = adSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    let enriched = await Promise.all(adData.map(async ad => {
      const ps = await getDoc(doc(db, "pets", ad.petID));
      return { ...ad, pet: ps.exists() ? ps.data() : null };
    }));
    enriched = enriched.filter(ad => ad.pet);
    enriched.sort((a, b) => {
      const d1 = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
      const d2 = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
      return d2 - d1;
    });
    setAdoptions(enriched);
    setLoading(false); setRefreshing(false);
  }

  async function cancelAdoption(id) {
    if (!window.confirm("Withdraw this adoption request?")) return;
    setAdoptions(prev => prev.filter(a => a.id !== id));
    try { await deleteDoc(doc(db, "adoptions", id)); } catch (err) { console.error(err); await loadData(); }
  }

  async function resubmitAdoption(ad) {
    if (!window.confirm("Are you sure you want to resend your adoption request?")) return;
    try {
      await deleteDoc(doc(db, "adoptions", ad.id));
      const newAdoption = {
        petID: ad.petID,
        adopterID: currentUser.uid,
        adopterName: profile.name || currentUser.email,
        shelterID: ad.shelterID || ad.pet?.shelterID || "",
        date: new Date(),
        status: "Pending",
      };
      await addDoc(collection(db, "adoptions"), newAdoption);
    } catch (err) {
      console.error(err);
      alert("Error resubmitting application: " + err.message);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    await updateDoc(doc(db, "adopters", currentUser.uid), profile);
    await updateDoc(doc(db, "users", currentUser.uid), { name: profile.name });
    setEditingProfile(false);
  }

  const pendingCount = adoptions.filter(a => !a.status || a.status === "Pending").length;
  const TABS = [
    { key:"adoptions", label:"My Adoptions", icon:"📋", badge: pendingCount > 0 ? pendingCount : null },
    { key:"profile",   label:"My Profile",   icon:"👤" },
  ];

  const Mute3 = { color: "var(--text-3)", fontSize: "0.85rem" };
  const Mute2 = { color: "var(--text-2)" };
  const filteredAdoptions = adoptions.filter(ad => adoptionFilter === "All" ? true : (ad.status || "Pending") === adoptionFilter);

  return (
    <div className="dashboard">
      <div className="container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="dashboard-header-left">
            <div className="dashboard-eyebrow">Adopter Portal</div>
            <h1 className="dashboard-title">My Dashboard</h1>
            <p className="dashboard-subtitle">Welcome back, {profile.name || "Adopter"} 🐾</p>
          </div>
          <div className="dashboard-actions">
            <button className={`btn-refresh${refreshing?" loading":""}`} onClick={() => window.location.reload()}>
              <span className="refresh-icon">↻</span> Refresh
            </button>
            <Link to="/"><button className="btn-primary">Browse Pets</button></Link>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card"><span className="stat-icon">📋</span>
            <div className="number">{loading?<div className="skeleton skeleton-number"/>:<AnimatedNumber value={adoptions.length}/>}</div>
            <div className="label">Applications</div>
          </div>
          <div className="stat-card"><span className="stat-icon">🎉</span>
            <div className="number">{loading?<div className="skeleton skeleton-number"/>:<AnimatedNumber value={adoptions.filter(a=>a.status==="Approved").length}/>}</div>
            <div className="label">Approved</div>
          </div>
          <div className="stat-card"><span className="stat-icon">⏱️</span>
            <div className="number" style={{color:"var(--warning)",WebkitTextFillColor:"var(--warning)",filter:"none"}}>
              {loading?<div className="skeleton skeleton-number"/>:<AnimatedNumber value={pendingCount}/>}
            </div>
            <div className="label">Pending</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-row">
          {TABS.map(tab => (
            <button key={tab.key} className={`tab-btn${activeTab===tab.key?" active":""}`} onClick={() => setActiveTab(tab.key)}>
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
              {tab.badge != null && <span className="tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </div>

        {/* Adoptions */}
        {activeTab === "adoptions" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
              <select value={adoptionFilter} onChange={e => setAdoptionFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", outline: "none", cursor: "pointer" }}>
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className="table-wrap">
              <table className="pets-table">
                <thead><tr><th>#</th><th>Pet</th><th>Species</th><th>Shelter</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {filteredAdoptions.length === 0 && <tr><td colSpan={7}><div className="table-empty"><span className="empty-icon">📭</span>No adoptions found. <Link to="/" style={{color:"var(--accent)"}}>Browse pets →</Link></div></td></tr>}
                  {filteredAdoptions.map((ad, i) => (
                    <tr key={ad.id}>
                      <td style={Mute3}>{i+1}</td>
                      <td><Link to={`/pet/${ad.petID}`} style={{color:"var(--accent)",fontWeight:500}}>{ad.pet?.name||ad.petID}</Link></td>
                    <td style={Mute2}>{ad.pet?.species||"—"}</td>
                    <td style={Mute2}>
                      <div style={{fontWeight:500,color:"var(--text)"}}>{ad.pet?.shelterName||"—"}</div>
                    </td>
                    <td style={Mute3}>{ad.date ? (ad.date?.toDate ? ad.date.toDate().toLocaleDateString() : new Date(ad.date).toLocaleDateString()) : "—"}</td>
                    <td>
                      <span className={`badge ${ad.status==="Approved"?"badge-success":ad.status==="Rejected"?"":""}`}
                        style={ad.status==="Rejected"?{background:"rgba(240,112,112,0.1)",color:"var(--danger)",border:"1px solid rgba(240,112,112,0.2)"}:
                               !ad.status||ad.status==="Pending"?{background:"rgba(245,200,66,0.12)",color:"var(--warning)",border:"1px solid rgba(245,200,66,0.22)"}:{}}>
                        {ad.status||"Pending"}
                      </span>
                    </td>
                    <td>
                      {(!ad.status||ad.status==="Pending")
                        ? <button className="btn-danger has-tooltip" data-tooltip="Withdraw request"
                            style={{padding:"5px 12px",fontSize:"0.79rem",background:"transparent",color:"var(--danger)",border:"1px solid var(--danger)"}}
                            onClick={() => cancelAdoption(ad.id)}>Cancel</button>
                        : ad.status === "Rejected"
                        ? <button className="btn-primary has-tooltip" data-tooltip="Resend request"
                            style={{padding:"5px 12px",fontSize:"0.79rem",background:"transparent",color:"var(--accent)",border:"1px solid var(--accent)"}}
                            onClick={() => resubmitAdoption(ad)}>Resend</button>
                        : <span style={{fontSize:"0.82rem",color:"var(--text-3)"}}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Profile */}
        {activeTab === "profile" && (
          <div className="profile-section">
            <div className="profile-header">
              <h2 className="profile-title">My Profile</h2>
              <button className="btn-outline" onClick={() => setEditingProfile(!editingProfile)}>{editingProfile?"Cancel":"Edit Profile"}</button>
            </div>
            {editingProfile ? (
              <form onSubmit={saveProfile}>
                <div className="profile-grid">
                  {[["name","Full Name"],["phone","Phone"],["address","Address"],["city","City"],["state","State"],["cityPIN","PIN Code"]].map(([f,l]) => (
                    <div className="form-group" key={f}><label>{l}</label><input value={profile[f]||""} onChange={e=>setProfile({...profile,[f]:e.target.value})}/></div>
                  ))}
                </div>
                <button className="btn-primary" type="submit" style={{marginTop:"20px"}}>Save Changes</button>
              </form>
            ) : (
              <div className="profile-grid">
                {[["name","Full Name"],["phone","Phone"],["email","Email"],["address","Address"],["city","City"],["state","State"],["cityPIN","PIN Code"]].map(([f,l]) => (
                  <div className="profile-field" key={f}><div className="field-label">{l}</div><div className="field-value">{profile[f]||"—"}</div></div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
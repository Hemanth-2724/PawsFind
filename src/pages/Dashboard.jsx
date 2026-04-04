import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db, storage } from "../firebase/config";
import {
  collection, addDoc, getDocs, query, where,
  doc, updateDoc, deleteDoc, getDoc, onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [loading,     setLoading]     = useState(true);
  const [pets,      setPets]      = useState([]);
  const [adoptions, setAdoptions] = useState([]);
  const [profile,   setProfile]   = useState({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [showAddPet,     setShowAddPet]     = useState(false);
  const [isSpeciesDropdownOpen, setIsSpeciesDropdownOpen] = useState(false);
  const speciesDropdownRef = useRef(null);
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
  const genderDropdownRef = useRef(null);
  const [isCustomSpecies, setIsCustomSpecies] = useState(false);
  const [petForm, setPetForm] = useState({
    name: "", species: "Dog", breed: "", age: "", gender: "Male",
    weight: "", description: "",
  });
  const [petPhoto,    setPetPhoto]    = useState(null);
  const [photoName,   setPhotoName]   = useState("");
  const [saving,      setSaving]      = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeTab,   setActiveTab]   = useState("pets");

  useEffect(() => { 
    loadData(); 
    
    if (!currentUser) return;
    // Listen for new adoption requests in real-time!
    const q = query(collection(db, "adoptions"), where("shelterID", "==", currentUser.uid));
    const unsubscribe = onSnapshot(q, () => {
      loadData();
    });
    
    return () => unsubscribe();
  }, [currentUser, activeTab]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (speciesDropdownRef.current && !speciesDropdownRef.current.contains(event.target)) {
        setIsSpeciesDropdownOpen(false);
      }
      if (genderDropdownRef.current && !genderDropdownRef.current.contains(event.target)) {
        setIsGenderDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadData() {
    if (!currentUser) return;
    setRefreshing(true);
    try {
      const snap = await getDoc(doc(db, "shelters", currentUser.uid));
      if (snap.exists()) setProfile(snap.data());

      const petsSnap = await getDocs(
        query(collection(db, "pets"), where("shelterID", "==", currentUser.uid))
      );
      const petsData = petsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPets(petsData);

      const adSnap = await getDocs(
        query(collection(db, "adoptions"), where("shelterID", "==", currentUser.uid))
      );
      let adData = adSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const petIDs = petsData.map(p => p.id);
      if (petIDs.length > 0) {
        try {
          for (let i = 0; i < petIDs.length; i += 10) {
            const chunk = petIDs.slice(i, i + 10);
            const chunkSnap = await getDocs(query(collection(db, "adoptions"), where("petID", "in", chunk)));
            chunkSnap.docs.forEach(d => {
              if (!adData.find(e => e.id === d.id)) adData.push({ id: d.id, ...d.data() });
            });
          }
        } catch (fallbackErr) {
          console.warn("Fallback query failed, but skipping to prevent dashboard crash.", fallbackErr);
        }
      }

      const adopterIds = [...new Set(adData.map(a => a.adopterID).filter(Boolean))];
      const adoptersMap = {};
      await Promise.all(adopterIds.map(async uid => {
        try {
          const s = await getDoc(doc(db, "adopters", uid));
          if (s.exists()) adoptersMap[uid] = s.data();
        } catch {}
      }));

      const enriched = adData.map(ad => ({
        ...ad,
        pet: petsData.find(p => p.id === ad.petID),
        adopterEmail: adoptersMap[ad.adopterID]?.email || "",
      }));
      setAdoptions(enriched);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
    setRefreshing(false);
  }

  async function saveProfile(e) {
    e.preventDefault();
    await updateDoc(doc(db, "shelters", currentUser.uid), profile);
    await updateDoc(doc(db, "users",    currentUser.uid), { name: profile.name });
    setEditingProfile(false);
  }

  async function handleAddPet(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let photoURL = "";
      if (petPhoto) {
        const storageRef = ref(storage, `pets/${Date.now()}_${petPhoto.name}`);
        await uploadBytes(storageRef, petPhoto);
        photoURL = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, "pets"), {
        ...petForm,
        age: Number(petForm.age),
        weight: Number(petForm.weight),
        shelterID:   currentUser.uid,
        shelterCity: profile.city  || "",
        shelterName: profile.name  || "",
        shelterOwnerName: profile.ownerName || "",
        photoURL,
        createdAt: new Date(),
        status: "Available",
      });
      setPetForm({ name: "", species: "Dog", breed: "", age: "", gender: "Male", weight: "", description: "" });
    setIsCustomSpecies(false);
      setPetPhoto(null);
      setPhotoName("");
      setShowAddPet(false);
      await loadData();
    } catch (err) {
      alert("Error: " + err.message);
    }
    setSaving(false);
  }

  async function deletePet(id) {
    if (!window.confirm("Delete this pet listing?")) return;
    await deleteDoc(doc(db, "pets", id));
    await loadData();
  }

  async function updateAdoptionStatus(ad, status) {
    await updateDoc(doc(db, "adoptions", ad.id), { status });
    if (status === "Approved") {
      await updateDoc(doc(db, "pets", ad.petID), { status: "Adopted" });
      for (const other of adoptions.filter(a => a.petID === ad.petID && a.id !== ad.id && a.status !== "Rejected")) {
        await updateDoc(doc(db, "adoptions", other.id), { status: "Rejected" });
      }
    }
    await loadData();
  }

  const pendingCount = adoptions.filter(a => !a.status || a.status === "Pending").length;

  const TABS = [
    { key: "pets",      label: "Pets",       icon: "🐶", badge: pets.length },
    { key: "adoptions", label: "Adoptions",  icon: "📥", badge: pendingCount > 0 ? pendingCount : null },
    { key: "profile",   label: "Profile",    icon: "🏢" },
  ];

  return (
    <div className="dashboard">
      <div className="container">

        {/* ── Header ── */}
        <div className="dashboard-header">
          <div className="dashboard-header-left">
            <div className="dashboard-eyebrow">Shelter Admin</div>
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">{profile.name || "Your shelter"}</p>
          </div>
          <div className="dashboard-actions">
            <button
              className={`btn-refresh${refreshing ? " loading" : ""}`}
              onClick={() => window.location.reload()}
            >
              <span className="refresh-icon">↻</span> Refresh
            </button>
            <button className="btn-primary" onClick={() => setShowAddPet(!showAddPet)}>
              {showAddPet ? "✕ Cancel" : "+ Add Pet"}
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-icon">🐶</span>
            <div className="number">{loading ? <div className="skeleton skeleton-number" /> : <AnimatedNumber value={pets.length} />}</div>
            <div className="label">Pets Listed</div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">📥</span>
            <div className="number">{loading ? <div className="skeleton skeleton-number" /> : <AnimatedNumber value={adoptions.length} />}</div>
            <div className="label">Total Requests</div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎉</span>
            <div className="number">{loading ? <div className="skeleton skeleton-number" /> : <AnimatedNumber value={adoptions.filter(a => a.status === "Approved").length} />}</div>
            <div className="label">Approved</div>
          </div>
          {(loading || pendingCount > 0) && (
            <div className="stat-card">
              <span className="stat-icon">⏱️</span>
              <div className="number" style={{ color: "var(--clr-warning)" }}>{loading ? <div className="skeleton skeleton-number" /> : <AnimatedNumber value={pendingCount} />}</div>
              <div className="label">Pending Review</div>
            </div>
          )}
        </div>

        {/* ── Add Pet Form ── */}
        {showAddPet && (
          <div className="add-pet-form">
            <style>{`
              .custom-number-input input[type="number"]::-webkit-inner-spin-button,
              .custom-number-input input[type="number"]::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
              }
              .custom-number-input input[type="number"] {
                -moz-appearance: textfield;
              }
              .stepper-btn:hover { background: var(--clr-border) !important; }
              .stepper-btn:active { transform: scale(0.95); }
            `}</style>
            <div className="form-section-title">Add a New Pet</div>
            <form onSubmit={handleAddPet}>
              <div className="add-pet-grid">
                {[
                  { label: "Pet Name", name: "name", placeholder: "e.g. Max", type: "text" },
                  { label: "Breed",    name: "breed", placeholder: "e.g. Labrador", type: "text" },
                  { label: "Age (years)", name: "age",    placeholder: "0", type: "number" },
                  { label: "Weight (kg)", name: "weight", placeholder: "0", type: "number" },
                ].map(f => (
                  <div className="form-group" key={f.name}>
                    <label>{f.label}</label>
                    {f.type === "number" ? (
                      <div className="custom-number-input" style={{ display: "flex", gap: "8px" }}>
                        <button 
                          type="button" 
                          className="stepper-btn"
                          onClick={() => setPetForm({ ...petForm, [f.name]: Math.max(0, (Number(petForm[f.name]) || 0) - 1) })}
                          style={{ width: "42px", flexShrink: 0, borderRadius: "8px", border: "1px solid var(--clr-border)", background: "var(--clr-surface)", cursor: "pointer", fontSize: "1.4rem", color: "var(--clr-text)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                        >−</button>
                        <input
                          type="number" min="0"
                          placeholder={f.placeholder}
                          value={petForm[f.name]}
                          onChange={e => setPetForm({ ...petForm, [f.name]: e.target.value })}
                          required
                          style={{ textAlign: "center" }}
                        />
                        <button 
                          type="button" 
                          className="stepper-btn"
                          onClick={() => setPetForm({ ...petForm, [f.name]: (Number(petForm[f.name]) || 0) + 1 })}
                          style={{ width: "42px", flexShrink: 0, borderRadius: "8px", border: "1px solid var(--clr-border)", background: "var(--clr-surface)", cursor: "pointer", fontSize: "1.4rem", color: "var(--clr-text)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                        >+</button>
                      </div>
                    ) : (
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={petForm[f.name]}
                        onChange={e => setPetForm({ ...petForm, [f.name]: e.target.value })}
                        required
                      />
                    )}
                  </div>
                ))}
                <div className="form-group" ref={speciesDropdownRef}>
                  <label>Species</label>
                  <div className={`custom-form-dropdown ${isSpeciesDropdownOpen ? "open" : ""}`}>
                    <button type="button" className="form-dropdown-trigger" onClick={() => setIsSpeciesDropdownOpen(!isSpeciesDropdownOpen)}>
                    {isCustomSpecies ? "Other" : petForm.species}
                      <svg className="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <div className="form-dropdown-menu">
                    {["Dog","Cat","Rabbit","Guinea Pig","Hamster","Bird","Fish","Turtle","Other"].map(s => (
                        <div 
                          key={s} 
                        className={`form-dropdown-item ${(!isCustomSpecies && petForm.species === s) || (isCustomSpecies && s === "Other") ? "selected" : ""}`}
                        onClick={() => { 
                          if (s === "Other") {
                            setIsCustomSpecies(true);
                            setPetForm({ ...petForm, species: "" });
                          } else {
                            setIsCustomSpecies(false);
                            setPetForm({ ...petForm, species: s });
                          }
                          setIsSpeciesDropdownOpen(false); 
                        }}
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                {isCustomSpecies && (
                  <input 
                    type="text" 
                    placeholder="Please specify species..." 
                    value={petForm.species} 
                    onChange={e => setPetForm({ ...petForm, species: e.target.value })} 
                    style={{ marginTop: "8px" }}
                    required 
                  />
                )}
                </div>
                <div className="form-group" ref={genderDropdownRef}>
                  <label>Gender</label>
                  <div className={`custom-form-dropdown ${isGenderDropdownOpen ? "open" : ""}`}>
                    <button type="button" className="form-dropdown-trigger" onClick={() => setIsGenderDropdownOpen(!isGenderDropdownOpen)}>
                      {petForm.gender}
                      <svg className="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <div className="form-dropdown-menu">
                      {["Male", "Female"].map(g => (
                        <div 
                          key={g} 
                          className={`form-dropdown-item ${petForm.gender === g ? "selected" : ""}`}
                          onClick={() => { setPetForm({ ...petForm, gender: g }); setIsGenderDropdownOpen(false); }}
                        >
                          {g}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Description</label>
                <textarea rows={3} placeholder="Describe the pet's personality..."
                  value={petForm.description}
                  onChange={e => setPetForm({ ...petForm, description: e.target.value })}
                  required />
              </div>
              <div className="form-group" style={{ marginBottom: "24px" }}>
                <label>Photo</label>
                <div className="file-upload-wrapper">
                  <input type="file" accept="image/*" onChange={e => {
                    setPetPhoto(e.target.files[0]);
                    setPhotoName(e.target.files[0]?.name || "");
                  }} />
                  <div className="file-upload-display">
                  <span>📸</span>
                    {photoName ? photoName : "Click to upload a photo (optional)"}
                  </div>
                </div>
              </div>
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Add Pet Listing"}
              </button>
            </form>
          </div>
        )}

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
              {tab.badge != null && (
                <span className="tab-badge">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Pets Tab ── */}
        {activeTab === "pets" && (
          <div className="table-wrap">
            <table className="pets-table">
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Species</th><th>Breed</th>
                  <th>Age</th><th>Gender</th><th>Weight</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pets.length === 0 && (
                  <tr><td colSpan={9}>
                    <div className="table-empty">
                      <span className="empty-icon">🦴</span>
                      No pets listed yet. Add your first pet above!
                    </div>
                  </td></tr>
                )}
                {pets.map((pet, index) => (
                  <tr key={pet.id}>
                    <td style={{ color: "var(--clr-muted)" }}>{index + 1}</td>
                    <td>
                      <Link to={`/pet/${pet.id}`} 
                        style={{ color: "var(--clr-accent)", fontWeight: 500 }}>
                        {pet.name}
                      </Link>
                    </td>
                    <td><span className="badge badge-accent">{pet.species}</span></td>
                    <td style={{ color: "var(--clr-muted2)" }}>{pet.breed}</td>
                    <td style={{ color: "var(--clr-muted2)" }}>{pet.age} yr{pet.age !== 1 ? "s" : ""}</td>
                    <td style={{ color: "var(--clr-muted2)" }}>{pet.gender}</td>
                    <td style={{ color: "var(--clr-muted2)" }}>{pet.weight} kg</td>
                    <td>
                      <span className={`badge ${pet.status === "Adopted" ? "badge-success" : "badge-info"}`}>
                        {pet.status || "Available"}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn-danger has-tooltip" data-tooltip="Delete pet listing" onClick={() => deletePet(pet.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Adoptions Tab ── */}
        {activeTab === "adoptions" && (
          <div className="table-wrap">
            <table className="pets-table">
              <thead>
                <tr><th>#</th><th>Pet</th><th>Adopter</th><th>Date</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {adoptions.length === 0 && (
                  <tr><td colSpan={6}>
                    <div className="table-empty">
                      <span className="empty-icon">📭</span>
                      No adoption requests yet.
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
                    <td>
                      <div style={{ fontWeight: 500 }}>{ad.adopterName || ad.adopterID}</div>
                      {ad.adopterEmail && (
                        <a href={`mailto:${ad.adopterEmail}`}
                          style={{ fontSize: "0.78rem", color: "var(--clr-info)", opacity: 0.85 }}
                          onClick={e => e.stopPropagation()}>
                          {ad.adopterEmail}
                        </a>
                      )}
                    </td>
                    <td style={{ color: "var(--clr-muted2)", fontSize: "0.85rem" }}>
                      {ad.date?.toDate ? ad.date.toDate().toLocaleDateString() : new Date(ad.date).toLocaleDateString()}
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
                      {ad.status === "Approved" || ad.status === "Rejected" ? (
                        <span style={{ fontSize: "0.82rem", color: "var(--clr-muted)", fontStyle: "italic" }}>Resolved</span>
                      ) : (
                        <div className="table-actions">
                          <button className="btn-success has-tooltip"
                            data-tooltip="Approve adoption request"
                            style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                            onClick={() => updateAdoptionStatus(ad, "Approved")}>
                            Approve
                          </button>
                          <button className="btn-danger has-tooltip"
                            data-tooltip="Reject adoption request"
                            style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                            onClick={() => updateAdoptionStatus(ad, "Rejected")}>
                            Reject
                          </button>
                        </div>
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
              <h2 className="profile-title">Shelter Profile</h2>
              <button className="btn-outline" onClick={() => setEditingProfile(!editingProfile)}>
                {editingProfile ? "Cancel" : "Edit Profile"}
              </button>
            </div>
            {editingProfile ? (
              <form onSubmit={saveProfile}>
                <div className="profile-grid">
                  {[
                    ["name",      "Shelter Name"],
                    ["ownerName", "Shelter Owner Name"],
                    ["phone",     "Phone"],
                    ["address",   "Address"],
                    ["city",      "City"],
                    ["state",     "State"],
                    ["cityPIN",   "PIN Code"],
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
                  ["name",      "Shelter Name"],
                  ["ownerName", "Shelter Owner Name"],
                  ["phone",     "Phone"],
                  ["email",     "Email"],
                  ["address",   "Address"],
                  ["city",      "City"],
                  ["state",     "State"],
                  ["cityPIN",   "PIN Code"],
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
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

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState([]);
  const [adoptions, setAdoptions] = useState([]);
  const [profile, setProfile] = useState({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [showAddPet, setShowAddPet] = useState(false);
  const [editingPetId, setEditingPetId] = useState(null);
  const [isSpeciesOpen, setIsSpeciesOpen] = useState(false);
  const [isGenderOpen, setIsGenderOpen] = useState(false);
  const [isCustomSpecies, setIsCustomSpecies] = useState(false);
  const speciesRef = useRef(null);
  const genderRef = useRef(null);
  const [petForm, setPetForm] = useState({ name:"", species:"Dog", breed:"", age:"", gender:"Male", weight:"", description:"" });
  const [petPhoto, setPetPhoto] = useState(null);
  const [photoName, setPhotoName] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("pets");
  const [adoptionFilter, setAdoptionFilter] = useState("All");

  useEffect(() => {
    loadData();
    if (!currentUser) return;
    const q = query(collection(db, "adoptions"), where("shelterID", "==", currentUser.uid));
    const unsub = onSnapshot(q, () => loadData());
    return () => unsub();
  }, [currentUser, activeTab]);

  useEffect(() => {
    function handle(e) {
      if (speciesRef.current && !speciesRef.current.contains(e.target)) setIsSpeciesOpen(false);
      if (genderRef.current && !genderRef.current.contains(e.target)) setIsGenderOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function loadData() {
    if (!currentUser) return;
    setRefreshing(true);
    try {
      const snap = await getDoc(doc(db, "shelters", currentUser.uid));
      if (snap.exists()) setProfile(snap.data());
      const petsSnap = await getDocs(query(collection(db, "pets"), where("shelterID", "==", currentUser.uid)));
      const petsData = petsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      petsData.sort((a, b) => {
        const d1 = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const d2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return d2 - d1;
      });
      setPets(petsData);
      const adSnap = await getDocs(query(collection(db, "adoptions"), where("shelterID", "==", currentUser.uid)));
      let adData = adSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const petIDs = petsData.map(p => p.id);
      if (petIDs.length > 0) {
        for (let i = 0; i < petIDs.length; i += 10) {
          const chunk = petIDs.slice(i, i + 10);
          try {
            const cs = await getDocs(query(collection(db, "adoptions"), where("petID", "in", chunk)));
            cs.docs.forEach(d => { if (!adData.find(e => e.id === d.id)) adData.push({ id: d.id, ...d.data() }); });
          } catch {}
        }
      }
      const adopterIds = [...new Set(adData.map(a => a.adopterID).filter(Boolean))];
      const adoptersMap = {};
      await Promise.all(adopterIds.map(async uid => {
        try { const s = await getDoc(doc(db, "adopters", uid)); if (s.exists()) adoptersMap[uid] = s.data(); } catch {}
      }));
      const enrichedAdoptions = adData.map(ad => ({ ...ad, pet: petsData.find(p => p.id === ad.petID), adopterEmail: adoptersMap[ad.adopterID]?.email || "" })).filter(ad => ad.pet);
      enrichedAdoptions.sort((a, b) => {
        const d1 = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const d2 = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return d2 - d1;
      });
      setAdoptions(enrichedAdoptions);
    } catch (err) { console.error(err); }
    setLoading(false); setRefreshing(false);
  }

  async function saveProfile(e) {
    e.preventDefault();
    await updateDoc(doc(db, "shelters", currentUser.uid), profile);
    await updateDoc(doc(db, "users", currentUser.uid), { name: profile.name });
    setEditingProfile(false);
  }

  async function handleSavePet(e) {
    e.preventDefault(); setSaving(true);
    try {
      let photoURL = "";
      if (editingPetId) {
        const existingPet = pets.find(p => p.id === editingPetId);
        if (existingPet) photoURL = existingPet.photoURL || "";
      }
      if (removePhoto) photoURL = "";

      if (petPhoto) {
        const r = ref(storage, `pets/${Date.now()}_${petPhoto.name}`);
        await uploadBytes(r, petPhoto); photoURL = await getDownloadURL(r);
      }
      if (editingPetId) {
        const updateData = { ...petForm, age: Number(petForm.age), weight: Number(petForm.weight), photoURL };
        await updateDoc(doc(db, "pets", editingPetId), updateData);
      } else {
        await addDoc(collection(db, "pets"), {
          ...petForm, age: Number(petForm.age), weight: Number(petForm.weight),
          shelterID: currentUser.uid, shelterCity: profile.city || "",
          shelterName: profile.name || "", shelterOwnerName: profile.ownerName || "",
          photoURL, createdAt: new Date(), status: "Available",
        });
      }
      setPetForm({ name:"", species:"Dog", breed:"", age:"", gender:"Male", weight:"", description:"" });
      setIsCustomSpecies(false); setPetPhoto(null); setPhotoName(""); setRemovePhoto(false); setShowAddPet(false); setEditingPetId(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Error saving pet: " + err.message);
    }
    setSaving(false);
  }

  async function deletePet(id) {
    if (!window.confirm("Delete this pet listing?")) return;
    try {
      const adq = query(collection(db, "adoptions"), where("petID", "==", id));
      const adSnap = await getDocs(adq);
      await Promise.all(adSnap.docs.map(d => deleteDoc(doc(db, "adoptions", d.id))));
      await deleteDoc(doc(db, "pets", id));
      await loadData();
    } catch (err) { console.error("Error deleting pet:", err); }
  }

  function editPet(pet) {
    setPetForm({
      name: pet.name || "",
      species: pet.species || "Dog",
      breed: pet.breed || "",
      age: pet.age ?? "",
      gender: pet.gender || "Male",
      weight: pet.weight ?? "",
      description: pet.description || ""
    });
    setEditingPetId(pet.id);
    setIsCustomSpecies(!["Dog","Cat","Rabbit","Guinea Pig","Hamster","Bird","Fish","Turtle","Other"].includes(pet.species));
    setPetPhoto(null); setPhotoName(""); setRemovePhoto(false); setShowAddPet(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function updateAdoptionStatus(ad, status) {
    await updateDoc(doc(db, "adoptions", ad.id), { status });
    if (status === "Approved") {
      await updateDoc(doc(db, "pets", ad.petID), { status: "Adopted" });
      for (const o of adoptions.filter(a => a.petID === ad.petID && a.id !== ad.id && a.status !== "Rejected"))
        await updateDoc(doc(db, "adoptions", o.id), { status: "Rejected" });
    }
    await loadData();
  }

  const pendingCount = adoptions.filter(a => !a.status || a.status === "Pending").length;
  const TABS = [
    { key:"pets",      label:"Pets",      icon:"🐶", badge: pets.length },
    { key:"adoptions", label:"Adoptions", icon:"📥", badge: pendingCount > 0 ? pendingCount : null },
    { key:"profile",   label:"Profile",   icon:"🏢" },
  ];

  const MuteStyle  = { color: "var(--text-2)" };
  const Mute3Style = { color: "var(--text-3)", fontSize: "0.85rem" };
  const filteredAdoptions = adoptions.filter(ad => adoptionFilter === "All" ? true : (ad.status || "Pending") === adoptionFilter);

  return (
    <div className="dashboard">
      <div className="container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="dashboard-header-left">
            <div className="dashboard-eyebrow">Shelter Admin</div>
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">{profile.name || "Your shelter"}</p>
          </div>
          <div className="dashboard-actions">
            <button className={`btn-refresh${refreshing ? " loading" : ""}`} onClick={() => window.location.reload()}>
              <span className="refresh-icon">↻</span> Refresh
            </button>
            <button className="btn-primary" onClick={() => {
              if (showAddPet) {
                setShowAddPet(false); setEditingPetId(null);
                setPetForm({ name:"", species:"Dog", breed:"", age:"", gender:"Male", weight:"", description:"" });
              } else setShowAddPet(true);
            }}>
              {showAddPet ? "✕ Cancel" : "+ Add Pet"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          {[
            { icon:"🐶", val:pets.length, label:"Pets Listed" },
            { icon:"📥", val:adoptions.length, label:"Total Requests" },
            { icon:"🎉", val:adoptions.filter(a=>a.status==="Approved").length, label:"Approved" },
          ].map((s, i) => (
            <div className="stat-card" key={i}>
              <span className="stat-icon">{s.icon}</span>
              <div className="number">{loading ? <div className="skeleton skeleton-number"/> : <AnimatedNumber value={s.val}/>}</div>
              <div className="label">{s.label}</div>
            </div>
          ))}
          {(loading || pendingCount > 0) && (
            <div className="stat-card">
              <span className="stat-icon">⏱️</span>
              <div className="number" style={{ color:"var(--warning)", WebkitTextFillColor:"var(--warning)", filter:"none" }}>
                {loading ? <div className="skeleton skeleton-number"/> : <AnimatedNumber value={pendingCount}/>}
              </div>
              <div className="label">Pending</div>
            </div>
          )}
        </div>

        {/* Add Pet Form */}
        {showAddPet && (
          <div className="add-pet-form">
            <style>{`
              .custom-number-input input[type="number"]::-webkit-inner-spin-button,
              .custom-number-input input[type="number"]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
              .custom-number-input input[type="number"] { -moz-appearance:textfield; }
            `}</style>
            <div className="form-section-title">{editingPetId ? "Edit Pet Details" : "Add a New Pet"}</div>
            <form onSubmit={handleSavePet}>
              <div className="add-pet-grid">
                {[
                  { label:"Pet Name", name:"name", placeholder:"e.g. Max", type:"text" },
                  { label:"Breed",    name:"breed", placeholder:"e.g. Labrador", type:"text" },
                  { label:"Age (years)", name:"age",    placeholder:"0", type:"number" },
                  { label:"Weight (kg)", name:"weight", placeholder:"0", type:"number" },
                ].map(f => (
                  <div className="form-group" key={f.name}>
                    <label>{f.label}</label>
                    {f.type === "number" ? (
                      <div className="custom-number-input" style={{ display:"flex", gap:"8px" }}>
                        <button type="button" className="stepper-btn"
                          onClick={() => setPetForm({ ...petForm, [f.name]: Math.max(0, (Number(petForm[f.name])||0) - 1) })}
                          style={{ width:"42px", flexShrink:0, borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.4rem", transition:"all 0.2s" }}>−</button>
                        <input type="number" min="0" placeholder={f.placeholder} value={petForm[f.name]}
                          onChange={e => setPetForm({ ...petForm, [f.name]: e.target.value })} required style={{ textAlign:"center" }}/>
                        <button type="button" className="stepper-btn"
                          onClick={() => setPetForm({ ...petForm, [f.name]: (Number(petForm[f.name])||0) + 1 })}
                          style={{ width:"42px", flexShrink:0, borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.4rem", transition:"all 0.2s" }}>+</button>
                      </div>
                    ) : (
                      <input type={f.type} placeholder={f.placeholder} value={petForm[f.name]}
                        onChange={e => setPetForm({ ...petForm, [f.name]: e.target.value })} required/>
                    )}
                  </div>
                ))}
                {/* Species dropdown */}
                <div className="form-group" ref={speciesRef}>
                  <label>Species</label>
                  <div className={`custom-form-dropdown ${isSpeciesOpen ? "open" : ""}`}>
                    <button type="button" className="form-dropdown-trigger" onClick={() => setIsSpeciesOpen(!isSpeciesOpen)}>
                      {isCustomSpecies ? "Other" : petForm.species}
                      <svg className="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div className="form-dropdown-menu">
                      {["Dog","Cat","Rabbit","Guinea Pig","Hamster","Bird","Fish","Turtle","Other"].map(s => (
                        <div key={s} className={`form-dropdown-item ${(!isCustomSpecies && petForm.species===s)||(isCustomSpecies&&s==="Other")?"selected":""}`}
                          onClick={() => { if(s==="Other"){setIsCustomSpecies(true);setPetForm({...petForm,species:""});}else{setIsCustomSpecies(false);setPetForm({...petForm,species:s});} setIsSpeciesOpen(false); }}>
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                  {isCustomSpecies && (
                    <input type="text" placeholder="Specify species..." value={petForm.species}
                      onChange={e => setPetForm({...petForm,species:e.target.value})} style={{marginTop:"8px"}} required/>
                  )}
                </div>
                {/* Gender dropdown */}
                <div className="form-group" ref={genderRef}>
                  <label>Gender</label>
                  <div className={`custom-form-dropdown ${isGenderOpen ? "open" : ""}`}>
                    <button type="button" className="form-dropdown-trigger" onClick={() => setIsGenderOpen(!isGenderOpen)}>
                      {petForm.gender}
                      <svg className="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div className="form-dropdown-menu">
                      {["Male","Female"].map(g => (
                        <div key={g} className={`form-dropdown-item ${petForm.gender===g?"selected":""}`}
                          onClick={() => { setPetForm({...petForm,gender:g}); setIsGenderOpen(false); }}>{g}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="form-group" style={{marginBottom:"14px"}}>
                <label>Description</label>
                <textarea rows={3} placeholder="Describe the pet's personality..." value={petForm.description}
                  onChange={e => setPetForm({...petForm,description:e.target.value})} required/>
              </div>
              <div className="form-group" style={{marginBottom:"22px"}}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                <label style={{ margin: 0 }}>Photo</label>
                {editingPetId && pets.find(p => p.id === editingPetId)?.photoURL && !petPhoto && !removePhoto && (
                  <button type="button" onClick={() => setRemovePhoto(true)} style={{ fontSize: "0.8rem", color: "var(--danger)", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>Remove current photo</button>
                )}
                {removePhoto && !petPhoto && (
                  <span style={{ fontSize: "0.8rem", color: "var(--warning)" }}>Will be removed <button type="button" onClick={() => setRemovePhoto(false)} style={{ fontSize: "0.8rem", color: "var(--accent)", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>(Undo)</button></span>
                )}
              </div>
                {petPhoto && (
                <div style={{ marginBottom: "10px", textAlign: "center" }}>
                    <img src={URL.createObjectURL(petPhoto)} alt="Preview" style={{ maxHeight: "100px", borderRadius: "6px", border: "1px solid var(--border)", objectFit: "cover" }} />
                  </div>
                )}
              {!petPhoto && !removePhoto && editingPetId && pets.find(p => p.id === editingPetId)?.photoURL && (
                <div style={{ marginBottom: "10px", textAlign: "center" }}>
                  <img src={pets.find(p => p.id === editingPetId)?.photoURL} alt="Current" style={{ maxHeight: "100px", borderRadius: "6px", border: "1px solid var(--border)", objectFit: "cover" }} />
                </div>
              )}
                <div className="file-upload-wrapper">
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; setPetPhoto(f || null); setPhotoName(f?.name || ""); setRemovePhoto(false); }}/>
                  <div className="file-upload-display"><span>📸</span>{photoName || "Click to upload a photo (optional)"}</div>
                </div>
              </div>
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? (petPhoto ? "Uploading Photo..." : "Saving...") : (editingPetId ? "Save Changes" : "Add Pet Listing")}
              </button>
            </form>
          </div>
        )}

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

        {/* Pets Tab */}
        {activeTab === "pets" && (
          <div className="table-wrap">
            <table className="pets-table">
              <thead><tr>
                <th>#</th><th>Name</th><th>Species</th><th>Breed</th>
                <th>Age</th><th>Gender</th><th>Weight</th><th>Status</th><th>Action</th>
              </tr></thead>
              <tbody>
                {pets.length === 0 && <tr><td colSpan={9}><div className="table-empty"><span className="empty-icon">🦴</span>No pets listed yet. Add your first pet above!</div></td></tr>}
                {pets.map((pet, i) => (
                  <tr key={pet.id}>
                    <td style={Mute3Style}>{i+1}</td>
                    <td><Link to={`/pet/${pet.id}`} style={{color:"var(--accent)",fontWeight:500}}>{pet.name}</Link></td>
                    <td><span className="badge badge-accent">{pet.species}</span></td>
                    <td style={MuteStyle}>{pet.breed}</td>
                    <td style={MuteStyle}>{pet.age} yr{pet.age!==1?"s":""}</td>
                    <td style={MuteStyle}>{pet.gender}</td>
                    <td style={MuteStyle}>{pet.weight} kg</td>
                    <td><span className={`badge ${pet.status==="Adopted"?"badge-teal":"badge-info"}`}>{pet.status||"Available"}</span></td>
                    <td>
                      {pet.status === "Adopted" ? (
                        <span style={{fontSize:"0.82rem",color:"var(--text-3)",fontStyle:"italic"}}>Adopted</span>
                      ) : (
                        <div className="table-actions">
                          <button className="btn-primary has-tooltip" data-tooltip="Edit listing" onClick={() => editPet(pet)} style={{padding:"6px 12px",fontSize:"0.8rem",marginRight:"6px"}}>Edit</button>
                          <button className="btn-danger has-tooltip" data-tooltip="Delete listing" onClick={() => deletePet(pet.id)} style={{padding:"6px 12px",fontSize:"0.8rem"}}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Adoptions Tab */}
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
                <thead><tr><th>#</th><th>Pet</th><th>Adopter</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {filteredAdoptions.length === 0 && <tr><td colSpan={6}><div className="table-empty"><span className="empty-icon">📭</span>No adoption requests found.</div></td></tr>}
                  {filteredAdoptions.map((ad, i) => (
                    <tr key={ad.id}>
                      <td style={Mute3Style}>{i+1}</td>
                      <td><Link to={`/pet/${ad.petID}`} style={{color:"var(--accent)",fontWeight:500}}>{ad.pet?.name||ad.petID}</Link></td>
                    <td>
                      <div style={{fontWeight:500}}>{ad.adopterName||ad.adopterID}</div>
                      {ad.adopterEmail && <a href={`mailto:${ad.adopterEmail}`} style={{fontSize:"0.76rem",color:"var(--info)",opacity:0.85}} onClick={e=>e.stopPropagation()}>{ad.adopterEmail}</a>}
                    </td>
                  <td style={Mute3Style}>{ad.date ? (ad.date?.toDate ? ad.date.toDate().toLocaleDateString() : new Date(ad.date).toLocaleDateString()) : "—"}</td>
                    <td>
                      <span className={`badge ${ad.status==="Approved"?"badge-success":ad.status==="Rejected"?"":""}`}
                        style={ad.status==="Rejected"?{background:"rgba(240,112,112,0.1)",color:"var(--danger)",border:"1px solid rgba(240,112,112,0.2)"}:
                               ad.status==="Approved"?{}:{background:"rgba(245,200,66,0.12)",color:"var(--warning)",border:"1px solid rgba(245,200,66,0.22)"}}>
                        {ad.status||"Pending"}
                      </span>
                    </td>
                    <td>
                      {ad.status==="Approved"||ad.status==="Rejected"
                        ? <span style={{fontSize:"0.82rem",color:"var(--text-3)",fontStyle:"italic"}}>Resolved</span>
                        : <div className="table-actions">
                            <button className="btn-success has-tooltip" data-tooltip="Approve" style={{padding:"6px 12px",fontSize:"0.8rem"}} onClick={() => updateAdoptionStatus(ad,"Approved")}>Approve</button>
                            <button className="btn-danger has-tooltip" data-tooltip="Reject" style={{padding:"6px 12px",fontSize:"0.8rem"}} onClick={() => updateAdoptionStatus(ad,"Rejected")}>Reject</button>
                          </div>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="profile-section">
            <div className="profile-header">
              <h2 className="profile-title">Shelter Profile</h2>
              <button className="btn-outline" onClick={() => setEditingProfile(!editingProfile)}>{editingProfile?"Cancel":"Edit Profile"}</button>
            </div>
            {editingProfile ? (
              <form onSubmit={saveProfile}>
                <div className="profile-grid">
                  {[["name","Shelter Name"],["ownerName","Owner Name"],["phone","Phone"],["address","Address"],["city","City"],["state","State"],["cityPIN","PIN Code"]].map(([f,l]) => (
                    <div className="form-group" key={f}><label>{l}</label><input value={profile[f]||""} onChange={e=>setProfile({...profile,[f]:e.target.value})}/></div>
                  ))}
                </div>
                <button className="btn-primary" type="submit" style={{marginTop:"20px"}}>Save Changes</button>
              </form>
            ) : (
              <div className="profile-grid">
                {[["name","Shelter Name"],["ownerName","Owner Name"],["phone","Phone"],["email","Email"],["address","Address"],["city","City"],["state","State"],["cityPIN","PIN Code"]].map(([f,l]) => (
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
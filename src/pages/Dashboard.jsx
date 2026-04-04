import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db, storage } from "../firebase/config";
import {
  collection, addDoc, getDocs, query, where,
  doc, updateDoc, deleteDoc, getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "../styles/dashboard.css";

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [pets, setPets] = useState([]);
  const [adoptions, setAdoptions] = useState([]);
  const [profile, setProfile] = useState({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [showAddPet, setShowAddPet] = useState(false);
  const [petForm, setPetForm] = useState({
    name: "", species: "Dog", breed: "", age: "", gender: "Male",
    weight: "", description: "",
  });
  const [petPhoto, setPetPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("pets");

  useEffect(() => {
    loadData();
  }, [currentUser, activeTab]);

  async function loadData() {
    if (!currentUser) return;
    try {
    // Load shelter profile
    const snap = await getDoc(doc(db, "shelters", currentUser.uid));
    if (snap.exists()) setProfile(snap.data());
    // Load pets
    const petsSnap = await getDocs(query(collection(db, "pets"), where("shelterID", "==", currentUser.uid)));
    const petsData = petsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setPets(petsData);
    
    // Load adoptions specifically for this shelter
    const adSnap = await getDocs(query(collection(db, "adoptions"), where("shelterID", "==", currentUser.uid)));
    let adData = adSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fallback for older adoptions that might be missing the shelterID
    const petIDs = petsData.map(p => p.id);
    if (petIDs.length > 0) {
      try {
        // Split petIDs into chunks of 10 to comply with Firestore's 'in' query limit
        for (let i = 0; i < petIDs.length; i += 10) {
          const chunk = petIDs.slice(i, i + 10);
          const chunkSnap = await getDocs(query(collection(db, "adoptions"), where("petID", "in", chunk)));
          chunkSnap.docs.forEach(d => {
            if (!adData.find(existing => existing.id === d.id)) {
              adData.push({ id: d.id, ...d.data() });
            }
          });
        }
      } catch (err) {
        console.warn("Fallback query failed. Older adoptions might not be shown.", err);
      }
    }
    
    // Fetch adopter emails
    const adopterIds = [...new Set(adData.map(a => a.adopterID).filter(Boolean))];
    const adoptersMap = {};
    await Promise.all(adopterIds.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "adopters", uid));
        if (snap.exists()) adoptersMap[uid] = snap.data();
      } catch (err) {
        console.error("Failed to fetch adopter details", err);
      }
    }));

    // Enrich with pet details and adopter details
    const enrichedAdoptions = adData.map(ad => {
      const pet = petsData.find(p => p.id === ad.petID);
      return { ...ad, pet, adopterEmail: adoptersMap[ad.adopterID]?.email || "" };
    });
    setAdoptions(enrichedAdoptions);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    await updateDoc(doc(db, "shelters", currentUser.uid), profile);
    await updateDoc(doc(db, "users", currentUser.uid), { name: profile.name });
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
        shelterID: currentUser.uid,
        shelterCity: profile.city || "",
        shelterName: profile.name || "",
        photoURL,
        createdAt: new Date(),
        status: "Available",
      });
      setPetForm({ name: "", species: "Dog", breed: "", age: "", gender: "Male", weight: "", description: "" });
      setPetPhoto(null);
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
      // Automatically update the pet's status to Adopted
      await updateDoc(doc(db, "pets", ad.petID), { status: "Adopted" });
      
      // Auto-reject any other pending applications for this same pet
      const otherAdoptions = adoptions.filter(a => a.petID === ad.petID && a.id !== ad.id && a.status !== "Rejected");
      for (const other of otherAdoptions) {
        await updateDoc(doc(db, "adoptions", other.id), { status: "Rejected" });
      }
      alert("Application successfully approved!");
    }
    await loadData();
  }

  return (
    <div className="dashboard">
      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Shelter Dashboard</h1>
            <p className="dashboard-subtitle">{profile.name || "Your shelter"}</p>
          </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn-outline" onClick={loadData}>↻ Refresh</button>
          <button className="btn-primary" onClick={() => setShowAddPet(!showAddPet)}>
            {showAddPet ? "✕ Cancel" : "+ Add Pet"}
          </button>
        </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="number">{pets.length}</div>
            <div className="label">Total Pets Listed</div>
          </div>
          <div className="stat-card">
            <div className="number">{adoptions.length}</div>
            <div className="label">Adoption Requests</div>
          </div>
          <div className="stat-card">
            <div className="number">{adoptions.filter(a => a.status === "Approved").length}</div>
            <div className="label">Approved Adoptions</div>
          </div>
        </div>

        {/* Add Pet Form */}
        {showAddPet && (
          <div className="add-pet-form" style={{ marginBottom: "32px" }}>
            <h2 className="section-title">Add a New Pet</h2>
            <form onSubmit={handleAddPet}>
              <div className="add-pet-grid">
                <div className="form-group"><label>Pet Name</label>
                  <input placeholder="e.g. Max" value={petForm.name} onChange={e => setPetForm({ ...petForm, name: e.target.value })} required /></div>
                <div className="form-group"><label>Species</label>
                  <select value={petForm.species} onChange={e => setPetForm({ ...petForm, species: e.target.value })}>
                    {["Dog","Cat","Rabbit","Guinea Pig","Hamster","Bird","Fish","Turtle"].map(s => <option key={s}>{s}</option>)}
                  </select></div>
                <div className="form-group"><label>Breed</label>
                  <input placeholder="e.g. Labrador" value={petForm.breed} onChange={e => setPetForm({ ...petForm, breed: e.target.value })} required /></div>
                <div className="form-group"><label>Age (years)</label>
                  <input type="number" min="0" value={petForm.age} onChange={e => setPetForm({ ...petForm, age: e.target.value })} required /></div>
                <div className="form-group"><label>Gender</label>
                  <select value={petForm.gender} onChange={e => setPetForm({ ...petForm, gender: e.target.value })}>
                    <option>Male</option><option>Female</option>
                  </select></div>
                <div className="form-group"><label>Weight (kg)</label>
                  <input type="number" min="0" value={petForm.weight} onChange={e => setPetForm({ ...petForm, weight: e.target.value })} required /></div>
              </div>
              <div className="form-group" style={{ marginBottom: "16px" }}><label>Description</label>
                <textarea rows={3} placeholder="Describe the pet's personality..." value={petForm.description} onChange={e => setPetForm({ ...petForm, description: e.target.value })} required /></div>
              <div className="form-group" style={{ marginBottom: "20px" }}><label>Photo (optional)</label>
                <input type="file" accept="image/*" onChange={e => setPetPhoto(e.target.files[0])} /></div>
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Add Pet Listing"}
              </button>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
          {["pets","adoptions","profile"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 20px", borderRadius: "var(--radius-sm)",
                background: activeTab === tab ? "var(--clr-accent)" : "var(--clr-card)",
                border: "1px solid var(--clr-border)",
                color: activeTab === tab ? "#fff" : "var(--clr-muted)",
                textTransform: "capitalize", fontSize: "0.9rem",
              }}>
              {tab === "pets" ? "🐾 Pets" : tab === "adoptions" ? "📋 Adoptions" : "⚙️ Profile"}
            </button>
          ))}
        </div>

        {/* Pets Tab */}
        {activeTab === "pets" && (
          <div className="table-wrap">
            <table className="pets-table">
              <thead><tr>
                <th>Name</th><th>Species</th><th>Breed</th>
                <th>Age</th><th>Gender</th><th>Weight</th><th>Status / Actions</th>
              </tr></thead>
              <tbody>
                {pets.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--clr-muted)", padding: "40px" }}>No pets listed yet. Add your first pet!</td></tr>}
                {pets.map(pet => (
                  <tr key={pet.id}>
                    <td><strong>{pet.name}</strong></td>
                    <td><span className="badge badge-accent">{pet.species}</span></td>
                    <td>{pet.breed}</td>
                    <td>{pet.age} yr{pet.age !== 1 ? "s" : ""}</td>
                    <td>{pet.gender}</td>
                    <td>{pet.weight} kg</td>
                    <td style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span className={`badge ${pet.status === 'Adopted' ? 'badge-success' : 'badge-accent'}`}>{pet.status || 'Available'}</span>
                      <button className="btn-danger" onClick={() => deletePet(pet.id)} style={{ fontSize: "0.82rem", padding: "6px 14px" }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Adoptions Tab */}
        {activeTab === "adoptions" && (
          <div className="table-wrap">
            <table className="pets-table">
              <thead><tr><th>Pet Name</th><th>Adopter</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {adoptions.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--clr-muted)", padding: "40px" }}>No adoption requests yet.</td></tr>}
                {adoptions.map(ad => (
                  <tr key={ad.id}>
                    <td><strong>{ad.pet?.name || ad.petID}</strong></td>
                    <td>
                      <div>{ad.adopterName || ad.adopterID}</div>
                      {ad.adopterEmail && (
                        <a href={`mailto:${ad.adopterEmail}`} style={{ fontSize: "0.82rem", color: "var(--clr-primary)", textDecoration: "underline" }}>{ad.adopterEmail}</a>
                      )}
                    </td>
                    <td>{ad.date?.toDate ? ad.date.toDate().toLocaleDateString() : new Date(ad.date).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${ad.status === "Approved" ? "badge-success" : ad.status === "Rejected" ? "" : "badge-warning"}`}
                        style={ad.status === "Rejected" ? { background: "rgba(248,113,113,0.12)", color: "var(--clr-danger)" } : {}}>
                        {ad.status || "Pending"}
                      </span>
                    </td>
                    <td>
                      {ad.status === "Approved" || ad.status === "Rejected" ? (
                        <span style={{ fontSize: "0.85rem", color: "var(--clr-muted)", fontWeight: "500" }}>Resolved</span>
                      ) : (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button className="btn-primary" onClick={() => updateAdoptionStatus(ad, "Approved")}
                            style={{ padding: "6px 12px", fontSize: "0.82rem", background: "var(--clr-success)", borderColor: "var(--clr-success)" }}>Approve</button>
                          <button className="btn-danger" onClick={() => updateAdoptionStatus(ad, "Rejected")}
                            style={{ padding: "6px 12px", fontSize: "0.82rem" }}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="profile-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 className="section-title" style={{ margin: 0 }}>Shelter Profile</h2>
              <button className="btn-outline" onClick={() => setEditingProfile(!editingProfile)}>
                {editingProfile ? "Cancel" : "Edit Profile"}
              </button>
            </div>
            {editingProfile ? (
              <form onSubmit={saveProfile}>
                <div className="profile-grid">
                  {[["name","Shelter Name"],["phone","Phone"],["address","Address"],["city","City"],["state","State"],["cityPIN","PIN Code"]].map(([field, label]) => (
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
                {[["name","Shelter Name"],["phone","Phone"],["email","Email"],["address","Address"],["city","City"],["state","State"],["cityPIN","PIN Code"]].map(([field, label]) => (
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
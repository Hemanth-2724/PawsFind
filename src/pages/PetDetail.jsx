import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, storage } from "../firebase/config";
import { doc, getDoc, addDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../context/AuthContext";
import "../styles/petdetail.css";

const SPECIES_EMOJI = {
  Dog:"🐶", Cat:"🐱", Rabbit:"🐰", "Guinea Pig":"🐹",
  Hamster:"🐹", Bird:"🦜", Fish:"🐟", Turtle:"🐢",
};

export default function PetDetail() {
  const { id } = useParams();
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const [pet,         setPet]         = useState(null);
  const [shelter,     setShelter]     = useState(null);
  const [medical,     setMedical]     = useState([]);
  const [vaccination, setVaccination] = useState([]);
  const [application, setApplication] = useState(null);
  const [applying,    setApplying]    = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [isEditing,   setIsEditing]   = useState(false);
  const [editForm,    setEditForm]    = useState({});
  const [saving,      setSaving]      = useState(false);
  const [petPhoto,    setPetPhoto]    = useState(null);
  const [photoName,   setPhotoName]   = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);

  useEffect(() => { loadPet(); }, [id]);

  async function loadPet() {
    const snap = await getDoc(doc(db, "pets", id));
    if (!snap.exists()) { navigate("/"); return; }
    const petData = { id: snap.id, ...snap.data() };
    setPet(petData);

    if (petData.shelterID) {
      const shSnap = await getDoc(doc(db, "shelters", petData.shelterID));
      if (shSnap.exists()) setShelter(shSnap.data());
    }

    const medSnap = await getDocs(query(collection(db, "medicalhistory"), where("petID", "==", id)));
    setMedical(medSnap.docs.map(d => d.data()));

    const vacSnap = await getDocs(query(collection(db, "vaccination"), where("petID", "==", id)));
    setVaccination(vacSnap.docs.map(d => d.data()));

    if (currentUser) {
      const adSnap = await getDocs(
        query(collection(db, "adoptions"), where("petID", "==", id), where("adopterID", "==", currentUser.uid))
      );
      if (!adSnap.empty) setApplication({ id: adSnap.docs[0].id, ...adSnap.docs[0].data() });
    }
    setLoading(false);
  }

  async function applyForAdoption() {
    if (!currentUser) { navigate("/login"); return; }
    setApplying(true);
    try {
      const adopterSnap = await getDoc(doc(db, "adopters", currentUser.uid));
      const newAdoption = {
        petID: id,
        adopterID:   currentUser.uid,
        adopterName: adopterSnap.exists() ? adopterSnap.data().name : currentUser.email,
        shelterID:   pet.shelterID || "",
        date:   new Date(),
        status: "Pending",
      };
      const docRef = await addDoc(collection(db, "adoptions"), newAdoption);
      setApplication({ id: docRef.id, ...newAdoption });
    } catch (err) {
      alert("Failed to submit application: " + err.message);
    }
    setApplying(false);
  }

  async function cancelApplication() {
    if (!application || !application.id) return;
    if (!window.confirm("Are you sure you want to cancel your adoption application?")) return;
    setApplying(true);
    try {
      await deleteDoc(doc(db, "adoptions", application.id));
      setApplication(null);
    } catch (err) {
      alert("Error cancelling application: " + err.message);
    }
    setApplying(false);
  }

  async function resubmitApplication() {
    if (!application || !application.id) return;
    if (!window.confirm("Are you sure you want to resend your adoption request?")) return;
    setApplying(true);
    try {
      await deleteDoc(doc(db, "adoptions", application.id));
      const adopterSnap = await getDoc(doc(db, "adopters", currentUser.uid));
      const newAdoption = {
        petID: id,
        adopterID:   currentUser.uid,
        adopterName: adopterSnap.exists() ? adopterSnap.data().name : currentUser.email,
        shelterID:   pet.shelterID || "",
        date:   new Date(),
        status: "Pending",
      };
      const docRef = await addDoc(collection(db, "adoptions"), newAdoption);
      setApplication({ id: docRef.id, ...newAdoption });
    } catch (err) {
      alert("Error resubmitting application: " + err.message);
    }
    setApplying(false);
  }

  function startEditing() {
    setEditForm({
      name: pet.name || "",
      species: pet.species || "Dog",
      breed: pet.breed || "",
      age: pet.age ?? "",
      gender: pet.gender || "Male",
      weight: pet.weight ?? "",
      description: pet.description || ""
    });
    setPetPhoto(null);
    setPhotoName("");
    setRemovePhoto(false);
    setIsEditing(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let photoURL = pet.photoURL || "";
      if (removePhoto) photoURL = "";
      if (petPhoto) {
        const r = ref(storage, `pets/${Date.now()}_${petPhoto.name}`);
        await uploadBytes(r, petPhoto); photoURL = await getDownloadURL(r);
      }
      await updateDoc(doc(db, "pets", id), {
        ...editForm,
        age: Number(editForm.age),
        weight: Number(editForm.weight),
        photoURL
      });
      setPet({ ...pet, ...editForm, age: Number(editForm.age), weight: Number(editForm.weight), photoURL });
      setIsEditing(false);
    } catch (err) {
      alert("Error updating pet: " + err.message);
    }
    setSaving(false);
  }

  if (loading) return (
    <div style={{ textAlign: "center", padding: "100px", color: "var(--clr-muted)" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🐾</div>
      Loading pet details...
    </div>
  );
  if (!pet) return null;

  const isAdopted = pet.status === "Adopted";

  return (
    <div className="pet-detail">
      <div className="container">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back to listings
        </button>

        <div className="pet-detail-grid">

          {/* ── Left Column ── */}
          <div className="pet-detail-img-wrap">
            <div className="pet-detail-img">
              {pet.photoURL
                ? <img src={pet.photoURL} alt={pet.name} />
                : <span className="emoji-big">{SPECIES_EMOJI[pet.species] || "🐾"}</span>
              }
              <div className={`img-status ${isAdopted ? "adopted" : "available"}`}>
                {isAdopted ? "🏠 Adopted" : "✅ Available"}
              </div>
            </div>

            {shelter && (
              <div className="shelter-card">
                <div className="shelter-card-title">Shelter Information</div>
                <div className="shelter-info-grid">
                  {[
                    ["Shelter Name", shelter.name],
                    ["Owner Name",   shelter.ownerName],
                    ["City",  shelter.city],
                    ["Phone", shelter.phone],
                    ["Email", shelter.email],
                  ].map(([label, value]) => (
                    <div className="shelter-info-item" key={label}>
                      <div className="s-label">{label}</div>
                      <div className="s-value">{value || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column ── */}
          <div>
            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="pet-info-card" style={{ padding: "24px" }}>
                <h2 style={{ marginBottom: "16px", marginTop: 0 }}>Edit Pet Details</h2>
                <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
                  <div><label style={{display:"block",marginBottom:"4px",fontSize:"0.85rem",color:"var(--clr-muted)"}}>Name</label><input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius:"6px", border:"1px solid var(--clr-border)" }} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div><label style={{display:"block",marginBottom:"4px",fontSize:"0.85rem",color:"var(--clr-muted)"}}>Species</label><input value={editForm.species} onChange={e => setEditForm({...editForm, species: e.target.value})} required style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius:"6px", border:"1px solid var(--clr-border)" }} /></div>
                    <div><label style={{display:"block",marginBottom:"4px",fontSize:"0.85rem",color:"var(--clr-muted)"}}>Breed</label><input value={editForm.breed} onChange={e => setEditForm({...editForm, breed: e.target.value})} required style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius:"6px", border:"1px solid var(--clr-border)" }} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                    <div><label style={{display:"block",marginBottom:"4px",fontSize:"0.85rem",color:"var(--clr-muted)"}}>Age (yrs)</label><input type="number" min="0" value={editForm.age} onChange={e => setEditForm({...editForm, age: e.target.value})} required style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius:"6px", border:"1px solid var(--clr-border)" }} /></div>
                    <div><label style={{display:"block",marginBottom:"4px",fontSize:"0.85rem",color:"var(--clr-muted)"}}>Weight (kg)</label><input type="number" min="0" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: e.target.value})} required style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius:"6px", border:"1px solid var(--clr-border)" }} /></div>
                    <div><label style={{display:"block",marginBottom:"4px",fontSize:"0.85rem",color:"var(--clr-muted)"}}>Gender</label><select value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value})} style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius:"6px", border:"1px solid var(--clr-border)" }}><option>Male</option><option>Female</option></select></div>
                  </div>
                  <div><label style={{display:"block",marginBottom:"4px",fontSize:"0.85rem",color:"var(--clr-muted)"}}>Description</label><textarea rows={4} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} required style={{ width: "100%", padding: "8px", boxSizing: "border-box", resize: "vertical", borderRadius:"6px", border:"1px solid var(--clr-border)" }} /></div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                    <label style={{fontSize:"0.85rem",color:"var(--clr-muted)"}}>Update Photo (optional)</label>
                    {pet.photoURL && !petPhoto && !removePhoto && (
                      <button type="button" onClick={() => setRemovePhoto(true)} style={{ fontSize: "0.8rem", color: "var(--clr-danger, #e74c3c)", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>Remove current photo</button>
                    )}
                    {removePhoto && !petPhoto && (
                      <span style={{ fontSize: "0.8rem", color: "var(--clr-warning, #f39c12)" }}>Will be removed <button type="button" onClick={() => setRemovePhoto(false)} style={{ fontSize: "0.8rem", color: "var(--clr-primary)", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>(Undo)</button></span>
                    )}
                  </div>
                {petPhoto && (
                  <div style={{ marginBottom: "8px", textAlign: "center" }}>
                    <img src={URL.createObjectURL(petPhoto)} alt="Preview" style={{ maxHeight: "120px", borderRadius: "6px", border: "1px solid var(--clr-border)", objectFit: "cover" }} />
                  </div>
                )}
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; setPetPhoto(f || null); setPhotoName(f?.name || ""); setRemovePhoto(false); }} style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius:"6px", border:"1px solid var(--clr-border)" }} />
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? (petPhoto ? "Uploading photo..." : "Saving...") : "Save Changes"}</button>
                  <button type="button" className="btn-outline" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h1 className="pet-detail-name">{pet.name}</h1>
                  {currentUser?.uid === pet.shelterID && (
                    <button className="btn-outline" onClick={startEditing} style={{ padding: "6px 14px", fontSize: "0.85rem" }}>✏️ Edit Details</button>
                  )}
                </div>
                <div className="pet-detail-tags">
                  <span className="badge badge-accent">{pet.species}</span>
                  <span className="badge badge-purple">{pet.breed}</span>
                  <span className="badge badge-success">{pet.age} yr{pet.age !== 1 ? "s" : ""}</span>
                  <span className="badge badge-info">{pet.gender}</span>
                </div>

                {/* Details card */}
                <div className="pet-info-card">
              <div className="pet-info-card-title">📋 Pet Details</div>
              <div className="info-grid">
                {[
                  ["Weight",   `${pet.weight} kg`],
                  ["Gender",   pet.gender],
                  ["Age",      `${pet.age} years`],
                  ["Location", pet.shelterCity || "—"],
                ].map(([label, value]) => (
                  <div className="info-item" key={label}>
                    <div className="label">{label}</div>
                    <div className="value">{value}</div>
                  </div>
                ))}
              </div>
              {pet.description && (
                <p className="pet-description">{pet.description}</p>
              )}
            </div>

            {/* Vaccinations */}
            {vaccination.length > 0 && (
              <div className="pet-info-card">
                <div className="pet-info-card-title">💉 Vaccinations</div>
                <div className="vaccine-list">
                  {vaccination.map((v, i) => (
                    <span key={i} className="badge badge-success">
                      {v.vaccinType}
                      {v.date && ` (${new Date(v.date?.toDate?.() || v.date).getFullYear()})`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Medical History */}
            {medical.length > 0 && (
              <div className="pet-info-card">
                <div className="pet-info-card-title">🏥 Medical History</div>
                {medical.map((m, i) => (
                  <div className="medical-item" key={i}>
                    <div className="medical-condition">{m.medicalCondition || m.MedicalCondation}</div>
                    <div className="medical-treatment">{m.treatment || m.Treatment}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Adopt CTA ── */}
            {userRole !== "shelter" && (
              <div className="adopt-cta">
                {application?.status === "Approved" ? (
                  <div className="adopt-approved">
                    <div className="congrats-emoji">🎉</div>
                    <h2>Application Approved!</h2>
                    <p>Congratulations! Your new best friend is waiting.</p>
                    <div className="pickup-note">
                      🐾 Please collect your pet at the shelter after 2 days.
                    </div>
                  </div>

                ) : application ? (
                  <>
                    <h3>{application.status === "Rejected" ? "Application Rejected" : "Your application is in!"}</h3>
                    <p>{application.status === "Rejected" ? "Unfortunately, your previous application was not approved. You can try submitting a new request." : "The shelter will review your request within 2–3 business days."}</p>
                    <div className="adopt-applied">
                      <span className={`badge ${application.status === "Rejected" ? "" : "badge-success"}`} style={application.status === "Rejected" ? { background: "rgba(240,112,112,0.1)", color: "var(--clr-danger, #e74c3c)", border: "1px solid rgba(240,112,112,0.2)", padding: "7px 18px", fontSize: "0.88rem" } : { padding: "7px 18px", fontSize: "0.88rem" }}>
                        {application.status === "Rejected" ? "✕" : "✓"} Status: {application.status || "Pending"}
                      </span>
                      <span className="status-text">Check your dashboard for updates</span>
                      {(!application.status || application.status === "Pending") && (
                        <button type="button" onClick={cancelApplication} disabled={applying} style={{ marginLeft: "auto", padding: "5px 12px", fontSize: "0.8rem", background: "transparent", color: "var(--clr-danger, #e74c3c)", border: "1px solid var(--clr-danger, #e74c3c)", borderRadius: "6px", cursor: "pointer" }}>
                          Cancel Request
                        </button>
                      )}
                      {application.status === "Rejected" && (
                        <button type="button" onClick={resubmitApplication} disabled={applying} style={{ marginLeft: "auto", padding: "5px 12px", fontSize: "0.8rem", background: "transparent", color: "var(--accent, #4f8ef7)", border: "1px solid var(--accent, #4f8ef7)", borderRadius: "6px", cursor: "pointer" }}>
                          {applying ? "Sending..." : "Resend Request"}
                        </button>
                      )}
                    </div>
                  </>

                ) : isAdopted ? (
                  <div className="adopt-taken">
                    <div style={{ fontSize: "2.2rem" }}>🏠</div>
                    <h2>Found a forever home!</h2>
                    <p>{pet.name} has already been adopted. Check out other available pets!</p>
                  </div>

                ) : (
                  <>
                    <h3>Ready to adopt {pet.name}?</h3>
                    <p>
                      Submit your adoption request and the shelter will review your
                      application within 2–3 business days. No fees, just love.
                    </p>
                    <button className="btn-adopt" onClick={applyForAdoption} disabled={applying}>
                      {applying ? "Submitting..." : `Adopt ${pet.name} 🐾`}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
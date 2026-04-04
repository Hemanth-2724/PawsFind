import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/config";
import { doc, getDoc, addDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import "../styles/petdetail.css";

const SPECIES_EMOJI = {
  Dog:"🐶",Cat:"🐱",Rabbit:"🐰","Guinea Pig":"🐹",
  Hamster:"🐹",Bird:"🦜",Fish:"🐟",Turtle:"🐢",
};

export default function PetDetail() {
  const { id } = useParams();
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const [pet, setPet] = useState(null);
  const [shelter, setShelter] = useState(null);
  const [medical, setMedical] = useState([]);
  const [vaccination, setVaccination] = useState([]);
  const [application, setApplication] = useState(null);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPet();
  }, [id]);

  async function loadPet() {
    const snap = await getDoc(doc(db, "pets", id));
    if (!snap.exists()) { navigate("/"); return; }
    const petData = { id: snap.id, ...snap.data() };
    setPet(petData);
    // Load shelter
    if (petData.shelterID) {
      const shSnap = await getDoc(doc(db, "shelters", petData.shelterID));
      if (shSnap.exists()) setShelter(shSnap.data());
    }
    // Load medical history
    const medSnap = await getDocs(query(collection(db, "medicalhistory"), where("petID", "==", id)));
    setMedical(medSnap.docs.map(d => d.data()));
    // Load vaccinations
    const vacSnap = await getDocs(query(collection(db, "vaccination"), where("petID", "==", id)));
    setVaccination(vacSnap.docs.map(d => d.data()));
    // Check if already applied
    if (currentUser) {
      const adSnap = await getDocs(query(collection(db, "adoptions"), where("petID", "==", id), where("adopterID", "==", currentUser.uid)));
      if (!adSnap.empty) {
        setApplication(adSnap.docs[0].data());
      }
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
        adopterID: currentUser.uid,
        adopterName: adopterSnap.exists() ? adopterSnap.data().name : currentUser.email,
        shelterID: pet.shelterID || "",
        date: new Date(),
        status: "Pending",
      };
      await addDoc(collection(db, "adoptions"), newAdoption);
      setApplication(newAdoption);
    } catch (err) {
      alert("Failed to submit application: " + err.message);
      console.error(err);
    }
    setApplying(false);
  }

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "var(--clr-muted)" }}>Loading...</div>;
  if (!pet) return null;

  return (
    <div className="pet-detail">
      <div className="container">
        <button className="btn-outline" onClick={() => navigate(-1)} style={{ marginBottom: "32px" }}>
          ← Back
        </button>
        <div className="pet-detail-grid">
          {/* Left */}
          <div>
            <div className="pet-detail-img">
              {pet.photoURL ? <img src={pet.photoURL} alt={pet.name} /> : <span>{SPECIES_EMOJI[pet.species] || "🐾"}</span>}
            </div>
            {shelter && (
              <div className="pet-detail-info" style={{ marginTop: "20px" }}>
                <h3 style={{ marginBottom: "12px", fontSize: "1rem" }}>🏢 Shelter Information</h3>
                <div className="info-grid">
                  <div className="info-item"><div className="label">Name</div><div className="value">{shelter.name}</div></div>
                  <div className="info-item"><div className="label">City</div><div className="value">{shelter.city}</div></div>
                  <div className="info-item"><div className="label">Phone</div><div className="value">{shelter.phone}</div></div>
                  <div className="info-item"><div className="label">Email</div><div className="value">{shelter.email}</div></div>
                </div>
              </div>
            )}
          </div>

          {/* Right */}
          <div>
            <h1 className="pet-detail-name">{pet.name}</h1>
            <div className="pet-detail-tags">
              <span className="badge badge-accent">{pet.species}</span>
              <span className="badge badge-purple">{pet.breed}</span>
              <span className="badge badge-success">{pet.age} yr{pet.age !== 1 ? "s" : ""}</span>
              <span className="badge">{pet.gender}</span>
            </div>

            <div className="pet-detail-info">
              <h3 style={{ marginBottom: "14px", fontSize: "1rem" }}>Pet Details</h3>
              <div className="info-grid">
                <div className="info-item"><div className="label">Weight</div><div className="value">{pet.weight} kg</div></div>
                <div className="info-item"><div className="label">Gender</div><div className="value">{pet.gender}</div></div>
                <div className="info-item"><div className="label">Age</div><div className="value">{pet.age} years</div></div>
                <div className="info-item"><div className="label">Location</div><div className="value">{pet.shelterCity || "—"}</div></div>
              </div>
              {pet.description && <p style={{ marginTop: "16px", color: "var(--clr-muted)", lineHeight: 1.6 }}>{pet.description}</p>}
            </div>

            {/* Vaccinations */}
            {vaccination.length > 0 && (
              <div className="pet-detail-info">
                <h3 style={{ marginBottom: "12px", fontSize: "1rem" }}>💉 Vaccinations</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {vaccination.map((v, i) => (
                    <span key={i} className="badge badge-success">{v.vaccinType} ({new Date(v.date?.toDate?.() || v.date).getFullYear()})</span>
                  ))}
                </div>
              </div>
            )}

            {/* Medical History */}
            {medical.length > 0 && (
              <div className="medical-section">
                <h3 style={{ marginBottom: "14px", fontSize: "1rem" }}>🏥 Medical History</h3>
                {medical.map((m, i) => (
                  <div key={i} style={{ padding: "10px 0", borderBottom: i < medical.length - 1 ? "1px solid var(--clr-border)" : "none" }}>
                    <div style={{ fontWeight: 500, marginBottom: "2px" }}>{m.medicalCondition}</div>
                    <div style={{ color: "var(--clr-muted)", fontSize: "0.88rem" }}>Treatment: {m.treatment}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Adopt CTA */}
            {userRole !== "shelter" && (
              <div className="adopt-cta">
                {application?.status === "Approved" ? (
                  <div style={{ textAlign: "center", padding: "16px 0", background: "rgba(16, 185, 129, 0.1)", borderRadius: "var(--radius-md)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                    <h2 style={{ color: "var(--clr-success)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", margin: 0, fontSize: "1.2rem" }}><span>🎉</span> Application Approved!</h2>
                    <p style={{ color: "var(--clr-muted)", marginTop: "8px", fontSize: "0.95rem" }}>Congratulations! Your new best friend is waiting for you.</p>
                    <p style={{ color: "var(--clr-success)", marginTop: "8px", fontSize: "0.95rem", fontWeight: "600" }}>🐾 Please collect your pet at the shelter after 2 days.</p>
                  </div>
                ) : application ? (
                  <>
                    <h3>Ready to adopt {pet.name}?</h3>
                    <p>Submit your adoption request and the shelter will review your application within 2–3 business days.</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span className="badge badge-success" style={{ padding: "8px 20px", fontSize: "0.95rem" }}>✓ Application {application.status || "Submitted"}</span>
                      <span style={{ color: "var(--clr-muted)", fontSize: "0.88rem" }}>Check status in your dashboard</span>
                    </div>
                  </>
                ) : pet.status === "Adopted" ? (
                  <div style={{ textAlign: "center", padding: "16px 0", background: "rgba(16, 185, 129, 0.1)", borderRadius: "var(--radius-md)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                    <h2 style={{ color: "var(--clr-success)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", margin: 0, fontSize: "1.2rem" }}><span>🎉</span> Found a forever home!</h2>
                    <p style={{ color: "var(--clr-muted)", marginTop: "8px", fontSize: "0.95rem" }}>{pet.name} has already been adopted.</p>
                  </div>
                ) : (
                  <>
                    <h3>Ready to adopt {pet.name}?</h3>
                    <p>Submit your adoption request and the shelter will review your application within 2–3 business days.</p>
                    <button className="btn-primary" onClick={applyForAdoption} disabled={applying}
                      style={{ padding: "14px 32px", fontSize: "1rem" }}>
                      {applying ? "Submitting..." : `Adopt ${pet.name} 🐾`}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
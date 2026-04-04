import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/config";
import { doc, getDoc, addDoc, collection, query, where, getDocs } from "firebase/firestore";
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
      if (!adSnap.empty) setApplication(adSnap.docs[0].data());
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
      await addDoc(collection(db, "adoptions"), newAdoption);
      setApplication(newAdoption);
    } catch (err) {
      alert("Failed to submit application: " + err.message);
    }
    setApplying(false);
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
                    ["Name",  shelter.name],
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
            <h1 className="pet-detail-name">{pet.name}</h1>
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
                    <h3>Your application is in!</h3>
                    <p>The shelter will review your request within 2–3 business days.</p>
                    <div className="adopt-applied">
                      <span className="badge badge-success" style={{ padding: "7px 18px", fontSize: "0.88rem" }}>
                        ✓ Status: {application.status || "Pending"}
                      </span>
                      <span className="status-text">Check your dashboard for updates</span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
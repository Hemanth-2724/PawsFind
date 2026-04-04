import { useNavigate } from "react-router-dom";
import "../styles/petcard.css";

const SPECIES_EMOJI = {
  Dog: "🐶", Cat: "🐱", Rabbit: "🐰",
  "Guinea Pig": "🐹", Hamster: "🐹", Bird: "🦜",
  Fish: "🐟", Turtle: "🐢",
};

export default function PetCard({ pet }) {
  const navigate = useNavigate();

  return (
    <div className="pet-card" onClick={() => navigate(`/pet/${pet.id}`)}>
      <div className="pet-card-img">
        {pet.photoURL
          ? <img src={pet.photoURL} alt={pet.name} />
          : <span>{SPECIES_EMOJI[pet.species] || "🐾"}</span>
        }
      </div>
      <div className="pet-card-body">
        <div className="pet-card-header">
          <h3 className="pet-card-name">{pet.name}</h3>
          <span className="badge badge-accent">{pet.species}</span>
        </div>
        <div className="pet-card-meta">
          <span className="badge badge-purple">{pet.breed}</span>
          <span className="badge badge-success">{pet.age} yr{pet.age !== 1 ? "s" : ""}</span>
          <span className="badge">{pet.gender}</span>
        </div>
        <p className="pet-card-desc">{pet.description}</p>
        <div className="pet-card-footer">
          <span className="pet-card-shelter">📍 {pet.shelterCity || "Shelter"}</span>
          <span style={{ fontSize: "0.85rem", color: "var(--clr-accent)" }}>View Details →</span>
        </div>
      </div>
    </div>
  );
}
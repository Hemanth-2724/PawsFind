import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/petcard.css";

const SPECIES_EMOJI = {
  Dog: "🐶", Cat: "🐱", Rabbit: "🐰",
  "Guinea Pig": "🐹", Hamster: "🐹", Bird: "🦜",
  Fish: "🐟", Turtle: "🐢",
};

// Max age used for the age bar width (visual only)
const MAX_AGE = 15;

export default function PetCard({ pet }) {
  const navigate = useNavigate();
  const isAdopted = pet.status === "Adopted";
  const agePercent = Math.min((pet.age / MAX_AGE) * 100, 100);

  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`pet-card${isAdopted ? " is-adopted" : ""}${isVisible ? " visible" : ""}`}
      onClick={() => navigate(`/pet/${pet.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && navigate(`/pet/${pet.id}`)}
    >
      {/* Image */}
      <div className="pet-card-img">
        <span className="pet-card-species-tag">{pet.species}</span>
        <div className="pet-card-save" title="Save for later" onClick={e => e.stopPropagation()}>
          🤍
        </div>
        {pet.photoURL
          ? <img src={pet.photoURL} alt={pet.name} loading="lazy" />
          : <span className="emoji-placeholder">{SPECIES_EMOJI[pet.species] || "🐾"}</span>
        }
      </div>

      {/* Body */}
      <div className="pet-card-body">
        <div className="pet-card-header">
          <h3 className="pet-card-name">{pet.name}</h3>
          <span className="badge badge-accent">{pet.gender}</span>
        </div>

        <div className="pet-card-meta">
          <span className="badge badge-purple">{pet.breed}</span>
          <span className="badge badge-success">{pet.age} yr{pet.age !== 1 ? "s" : ""}</span>
        </div>

        {/* Age bar */}
        <div className="age-bar">
          <div className="age-bar-fill" style={{ width: `${agePercent}%` }} />
        </div>

        <p className="pet-card-desc">{pet.description}</p>

        <div className="pet-card-footer">
          <span className="pet-card-shelter">
            📍 {pet.shelterCity || "Shelter"}
          </span>
          <span className="pet-card-cta">
            View Details <span>→</span>
          </span>
        </div>
      </div>
    </div>
  );
}
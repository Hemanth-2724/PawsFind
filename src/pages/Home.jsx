import { useEffect, useState, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import PetCard from "../components/PetCard";
import "../styles/home.css";

const SPECIES_LIST = [
  { label: "All", emoji: "🐾" },
  { label: "Dog",        emoji: "🐶" },
  { label: "Cat",        emoji: "🐱" },
  { label: "Rabbit",     emoji: "🐰" },
  { label: "Guinea Pig", emoji: "🐹" },
  { label: "Hamster",    emoji: "🐹" },
  { label: "Bird",       emoji: "🦜" },
  { label: "Fish",       emoji: "🐟" },
  { label: "Turtle",     emoji: "🐢" },
];

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

export default function Home() {
  const [pets, setPets]     = useState([]);
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    async function fetchPets() {
      const snap = await getDocs(collection(db, "pets"));
      setPets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    fetchPets();
  }, []);

  // Close custom dropdown when clicking outside of it
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = pets.filter(p => {
    const matchSearch =
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.breed?.toLowerCase().includes(search.toLowerCase());
    const matchSpecies = species ? p.species === species : true;
    return matchSearch && matchSpecies;
  });

  const available = pets.filter(p => p.status !== "Adopted").length;
  const adopted   = pets.filter(p => p.status === "Adopted").length;

  return (
    <>
      {/* ── Hero ── */}
      <section className="hero">
        <div className="container">
          <div className="hero-label">🐾 Find Your Perfect Companion</div>
          <h1>Give a pet a <span>forever</span> home</h1>
          <p className="hero-sub">
            Browse loving animals waiting for the right family.
            Every adoption changes two lives — forever.
          </p>

          {!loading && (
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="num"><AnimatedNumber value={pets.length} /></span>
                <span className="desc">Pets Listed</span>
              </div>
              <div className="hero-stat">
                <span className="num"><AnimatedNumber value={available} /></span>
                <span className="desc">Available</span>
              </div>
              <div className="hero-stat">
                <span className="num"><AnimatedNumber value={adopted} /></span>
                <span className="desc">Adopted</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="container">
        {/* ── Species chips ── */}
        <div className="species-chips">
          {SPECIES_LIST.map(s => (
            <button
              key={s.label}
              className={`species-chip${species === (s.label === "All" ? "" : s.label) ? " active" : ""}`}
              onClick={() => setSpecies(s.label === "All" ? "" : s.label)}
            >
              <span>{s.emoji}</span> {s.label}
            </button>
          ))}
        </div>

        {/* ── Search filter ── */}
        <div className="filters-section">
          <div className="search-pill">
            {loading ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon spinning">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            )}
            <input
              placeholder="Search by name or breed..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch("")} title="Clear search">
                ✕
              </button>
            )}
            <div className="filter-divider" />
            <div className={`custom-dropdown ${isDropdownOpen ? "open" : ""}`} ref={dropdownRef}>
              <button type="button" className="dropdown-trigger" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                {species ? `${SPECIES_LIST.find(s => s.label === species)?.emoji} ${species}` : "All Species"}
                <svg className="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              
              <div className="dropdown-menu">
                {SPECIES_LIST.map(s => {
                  const val = s.label === "All" ? "" : s.label;
                  return (
                    <div 
                      key={s.label} 
                      className={`dropdown-item ${species === val ? "selected" : ""}`} 
                      onClick={() => { setSpecies(val); setIsDropdownOpen(false); }}>
                      <span className="opt-emoji" style={{ marginRight: "6px" }}>{s.emoji}</span> {s.label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section header ── */}
        {!loading && (
          <div className="section-header">
            <h2>{species || "All Pets"}</h2>
            <span className="count">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        )}

        {/* ── Grid / States ── */}
        {loading ? (
          <div className="empty-state">
            <span className="emoji">⏳</span>
            <p>Finding your perfect companions...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="emoji">🐾</span>
            <p>No pets match your search.<br />Try adjusting the filters above.</p>
          </div>
        ) : (
          <div className="pets-grid">
            {filtered.map(pet => <PetCard key={pet.id} pet={pet} />)}
          </div>
        )}
      </div>
    </>
  );
}
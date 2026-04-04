import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import PetCard from "../components/PetCard";
import "../styles/home.css";

export default function Home() {
  const [pets, setPets] = useState([]);
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPets() {
      const snap = await getDocs(collection(db, "pets"));
      setPets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    fetchPets();
  }, []);

  const filtered = pets.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase())
      || p.breed?.toLowerCase().includes(search.toLowerCase());
    const matchSpecies = species ? p.species === species : true;
    return matchSearch && matchSpecies;
  });

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-label">🐾 Find Your Perfect Companion</div>
          <h1>Give a pet a <span>forever</span> home</h1>
          <p className="hero-sub">
            Browse hundreds of loving animals waiting for the right family. Every adoption changes two lives.
          </p>
        </div>
      </section>

      <div className="container">
        <div className="filters">
          <input
            placeholder="🔍  Search by name or breed..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={species} onChange={e => setSpecies(e.target.value)}>
            <option value="">All Species</option>
            {["Dog","Cat","Rabbit","Guinea Pig","Hamster","Bird","Fish","Turtle"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state"><div className="emoji">⏳</div><p>Loading pets...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">🐾</div>
            <p>No pets match your search. Try a different filter.</p>
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
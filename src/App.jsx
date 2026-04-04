import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AdopterDashboard from "./pages/AdopterDashboard";
import PetDetail from "./pages/PetDetail";
import "./styles/global.css";

export default function App() {
  useEffect(() => {
    document.title = "PawsFind";

    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐾</text></svg>";
  }, []);

  return (
    <AuthProvider>
      <HashRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pet/:id" element={<PetDetail />} />
          <Route path="/shelter-dashboard" element={
            <ProtectedRoute requiredRole="shelter"><Dashboard /></ProtectedRoute>
          } />
          <Route path="/adopter-dashboard" element={
            <ProtectedRoute requiredRole="adopter"><AdopterDashboard /></ProtectedRoute>
          } />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
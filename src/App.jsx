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
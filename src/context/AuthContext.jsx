import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase/config";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function register(email, password, role, extraData) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        role,
        ...extraData,
        createdAt: new Date(),
      });
      if (role === "shelter") {
        await setDoc(doc(db, "shelters", cred.user.uid), {
          ...extraData,
          email,
          createdAt: new Date(),
        });
      } else {
        await setDoc(doc(db, "adopters", cred.user.uid), {
          ...extraData,
          email,
          createdAt: new Date(),
        });
      }
      setUserRole(role);
      return cred;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        throw new Error("This email is already registered. Please log in instead.");
      }
      throw err;
    }
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle(role, extraData = {}) {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const userDoc = await getDoc(doc(db, "users", cred.user.uid));

    if (userDoc.exists() && role && userDoc.data().role !== role) {
      // User tried to register with a different role than what they already have
      await signOut(auth); // Sign them out immediately to prevent bypassing
      const existingRole = userDoc.data().role;
      throw new Error(`This email is already registered as ${existingRole === 'adopter' ? 'an' : 'a'} ${existingRole}. Please log in instead.`);
    }

    const isRegistering = !!role;
    const newRole = role || (userDoc.exists() ? userDoc.data().role : "adopter");
    const name = extraData.name || cred.user.displayName;

    const commonData = {
      ...extraData,
      email: cred.user.email,
      name: name,
    };

    if (!userDoc.exists() || isRegistering) {
      if (!userDoc.exists()) {
        commonData.createdAt = new Date();
      }

      await setDoc(doc(db, "users", cred.user.uid), {
        ...commonData,
        role: newRole,
      }, { merge: true });

      if (newRole === "shelter") {
        await setDoc(doc(db, "shelters", cred.user.uid), commonData, { merge: true });
      } else {
        await setDoc(doc(db, "adopters", cred.user.uid), commonData, { merge: true });
      }
      setUserRole(newRole);
    } else {
      setUserRole(userDoc.data().role);
    }
    return cred;
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) setUserRole(snap.data().role);
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, register, login, loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
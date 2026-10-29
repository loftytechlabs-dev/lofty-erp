import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  db,
  loginWithGoogle,
  logoutUser,
  onAuthStateChanged,
  isDemoMode,
} from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, BusinessRole } from '../types';
import { SAMPLE_MEMBERS } from '../lib/mockData';

const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
const API_BASE = isTestEnv ? 'http://localhost:5001/api' : '/api';

/**
 * Persists authenticated user profile simultaneously into Firebase Firestore and local MySQL
 */
export async function syncUserAcrossFirebaseAndMySQL(fbUser: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  phoneNumber?: string | null;
}) {
  const userData = {
    uid: fbUser.uid,
    email: fbUser.email || '',
    displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    photoURL: fbUser.photoURL || '',
    phoneNumber: fbUser.phoneNumber || '',
    providerId: 'google.com',
  };

  // 1. Sync to Firebase Firestore
  if (db) {
    try {
      const userDocRef = doc(db, 'users', fbUser.uid);
      await setDoc(
        userDocRef,
        {
          ...userData,
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore user sync warning (non-fatal):', err);
    }
  }

  // 2. Sync to MySQL Database via Express API
  try {
    await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
  } catch (err) {
    console.warn('MySQL user sync warning (non-fatal):', err);
  }
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateOnboarding: (intendedRole: string) => Promise<void>;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USERS: Record<BusinessRole, UserProfile> = {
  Owner: {
    uid: 'user_owner',
    email: 'owner@lofty.local',
    displayName: 'Business Owner',
    onboardingCompleted: true,
    intendedRole: 'I own or manage a business',
    businessIds: ['biz_main'],
  },
  Purchasing: {
    uid: 'user_purchasing',
    email: 'purchasing@lofty.local',
    displayName: 'Purchasing Officer',
    onboardingCompleted: true,
    intendedRole: 'I manage purchasing or inventory',
    businessIds: ['biz_main'],
  },
  Warehouse: {
    uid: 'user_warehouse',
    email: 'warehouse@lofty.local',
    displayName: 'Warehouse / Dock Manager',
    onboardingCompleted: true,
    intendedRole: 'I manage purchasing or inventory',
    businessIds: ['biz_main'],
  },
  Accountant: {
    uid: 'user_accountant',
    email: 'finance@lofty.local',
    displayName: 'Finance / Accountant',
    onboardingCompleted: true,
    intendedRole: 'I manage accounts or bills',
    businessIds: ['biz_main'],
  },
  Manager: {
    uid: 'user_manager',
    email: 'manager@lofty.local',
    displayName: 'Operations Manager',
    onboardingCompleted: true,
    intendedRole: 'I work for a business',
    businessIds: ['biz_main'],
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // If real Firebase Auth is available
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          // Check localStorage for onboarding state
          const savedOnboarding = localStorage.getItem(`onboarding_${fbUser.uid}`);
          setUser({
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            photoURL: fbUser.photoURL || undefined,
            onboardingCompleted: savedOnboarding === 'true',
            businessIds: [],
          });

          // Sync user info into both Firebase Firestore and MySQL
          await syncUserAcrossFirebaseAndMySQL(fbUser);
        } else {
          // Check if user was operating in a demo role or local session
          const savedRole = localStorage.getItem('lofty_demo_role');
          if (savedRole && DEMO_USERS[savedRole as BusinessRole]) {
            setUser(DEMO_USERS[savedRole as BusinessRole]);
          } else if (isDemoMode) {
            setUser(DEMO_USERS.Owner);
          } else {
            setUser(null);
          }
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Demo mode default
      const savedRole = localStorage.getItem('lofty_demo_role');
      if (savedRole && DEMO_USERS[savedRole as BusinessRole]) {
        setUser(DEMO_USERS[savedRole as BusinessRole]);
      } else {
        setUser(DEMO_USERS.Owner);
      }
      setLoading(false);
    }
  }, []);

  const handleSignInWithGoogle = async () => {
    setLoading(true);
    try {
      if (auth) {
        const cred = await loginWithGoogle();
        if (cred?.user) {
          await syncUserAcrossFirebaseAndMySQL(cred.user);
        }
      } else {
        // Fallback demo user
        setUser(DEMO_USERS.Owner);
        await syncUserAcrossFirebaseAndMySQL(DEMO_USERS.Owner);
      }
    } catch (err) {
      console.error('Google Sign-In error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('lofty_demo_role');
      await logoutUser();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const updateOnboarding = async (intendedRole: string) => {
    if (!user) return;
    const updated: UserProfile = {
      ...user,
      intendedRole,
      onboardingCompleted: true,
    };
    setUser(updated);
    localStorage.setItem(`onboarding_${user.uid}`, 'true');
    localStorage.setItem(`intended_role_${user.uid}`, intendedRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle: handleSignInWithGoogle,
        signOut: handleSignOut,
        updateOnboarding,
        isDemo: isDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

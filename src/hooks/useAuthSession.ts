import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import {
  completeLoginAndRemoveLegacySecondFactor,
  performCouncilorRegistration,
  performLogin,
  performPasswordReset,
} from '../services/authActions';
import { auth, db, setWorkspaceAccessToken } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/firestoreErrors';
import {
  clearServerSessionCookie,
  createServerSessionCookie,
  fetchServerSession,
  revokeAllSessionsOnServer,
} from '../services/sessionApi';
import { UserProfile } from '../types/models';

const TOTAL_INACTIVITY_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 3 * 60 * 1000;

export function useAuthSession() {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [serverAuthenticated, setServerAuthenticated] = useState(false);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [inactivityWarningSeconds, setInactivityWarningSeconds] = useState<number | null>(null);
  const activityBumpRef = useRef(0);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      setFirebaseUser(fbUser);

      if (!fbUser) {
        setWorkspaceAccessToken(null);
        setProfile(null);
        setServerAuthenticated(false);
        setInactivityWarningSeconds(null);
        setLoading(false);
        return;
      }

      try {
        const sessionRes = await fetchServerSession();
        if (sessionRes.expired) {
          setSessionExpiredNotice(true);
          setWorkspaceAccessToken(null);
          await signOut(auth);
          setLoading(false);
          return;
        }

        if (!sessionRes.authenticated) {
          const idToken = await fbUser.getIdToken();
          const profileSnap = await getDoc(doc(db, 'users', fbUser.uid));
          if (profileSnap.exists()) {
            const prof = profileSnap.data() as UserProfile;
            if (prof.status === 'suspendido') {
              setWorkspaceAccessToken(null);
              await clearServerSessionCookie();
              await signOut(auth);
              setLoading(false);
              return;
            }
            try {
              await createServerSessionCookie(idToken, {
                role: prof.role,
                status: prof.status,
                displayName: prof.displayName,
              });
              setServerAuthenticated(true);
              setAuthError(null);
            } catch (sessionErr) {
              setAuthError(
                sessionErr instanceof Error
                  ? sessionErr.message
                  : 'No fue posible validar la sesión institucional en el servidor.',
              );
              setWorkspaceAccessToken(null);
              await signOut(auth);
              setLoading(false);
              return;
            }
          }
        } else {
          setServerAuthenticated(true);
          setAuthError(null);
        }

        unsubscribeProfile = onSnapshot(
          doc(db, 'users', fbUser.uid),
          (snap) => {
            setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
            setLoading(false);
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
          },
        );
      } catch (err) {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'No fue posible restaurar tu sesión institucional.',
        );
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    let warnTimer: number | undefined;
    let expireTimer: number | undefined;
    let countdownInterval: number | undefined;

    const clearAllTimers = () => {
      if (warnTimer) window.clearTimeout(warnTimer);
      if (expireTimer) window.clearTimeout(expireTimer);
      if (countdownInterval) window.clearInterval(countdownInterval);
    };

    const expireSession = () => {
      clearAllTimers();
      setInactivityWarningSeconds(null);
      setSessionExpiredNotice(true);
      setWorkspaceAccessToken(null);
      void clearServerSessionCookie();
      void signOut(auth);
    };

    const armTimers = () => {
      clearAllTimers();
      setInactivityWarningSeconds(null);

      warnTimer = window.setTimeout(() => {
        let remaining = Math.round(WARNING_BEFORE_MS / 1000);
        setInactivityWarningSeconds(remaining);
        countdownInterval = window.setInterval(() => {
          remaining -= 1;
          setInactivityWarningSeconds(Math.max(0, remaining));
        }, 1000);
      }, TOTAL_INACTIVITY_MS - WARNING_BEFORE_MS);

      expireTimer = window.setTimeout(expireSession, TOTAL_INACTIVITY_MS);
    };

    armTimers();

    const handleActivity = () => {
      const now = Date.now();
      if (now - activityBumpRef.current < 1500) return;
      activityBumpRef.current = now;
      armTimers();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));

    return () => {
      clearAllTimers();
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
    };
  }, [firebaseUser]);

  const extendSession = useCallback(async () => {
    setInactivityWarningSeconds(null);
    activityBumpRef.current = Date.now();
    await fetchServerSession();
  }, []);

  const registerCouncilor = useCallback(
    async (input: {
      displayName: string;
      email: string;
      password: string;
      invitationCode: string;
      sector?: string;
    }) => {
      setAuthError(null);
      await performCouncilorRegistration(input);
      setServerAuthenticated(true);
      setSessionExpiredNotice(false);
    },
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    await performLogin(email, password);
    setServerAuthenticated(true);
    setSessionExpiredNotice(false);
  }, []);

  const resolveAndRemoveLegacyFactor = useCallback(
    async (input: Parameters<typeof completeLoginAndRemoveLegacySecondFactor>[0]) => {
      setAuthError(null);
      const removed = await completeLoginAndRemoveLegacySecondFactor(input);
      setServerAuthenticated(true);
      setSessionExpiredNotice(false);
      return removed;
    },
    [],
  );

  const resetPassword = useCallback(async (email: string) => {
    await performPasswordReset(email);
  }, []);

  const logout = useCallback(async () => {
    setWorkspaceAccessToken(null);
    setInactivityWarningSeconds(null);
    await clearServerSessionCookie();
    await signOut(auth);
    setServerAuthenticated(false);
    setProfile(null);
    setAuthError(null);
  }, []);

  const revokeAllDevices = useCallback(async () => {
    setWorkspaceAccessToken(null);
    setInactivityWarningSeconds(null);
    await revokeAllSessionsOnServer();
    await signOut(auth);
    setServerAuthenticated(false);
    setProfile(null);
    setAuthError(null);
  }, []);

  return {
    loading,
    firebaseUser,
    profile,
    serverAuthenticated,
    sessionExpiredNotice,
    authError,
    inactivityWarningSeconds,
    extendSession,
    registerCouncilor,
    login,
    resolveAndRemoveLegacyFactor,
    resetPassword,
    logout,
    revokeAllDevices,
  };
}

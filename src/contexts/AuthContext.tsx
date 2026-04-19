import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { canAnalyze, getProfile, upsertProfile, FREE_MONTHLY_LIMIT, type Profile } from '../lib/db';

interface UsageInfo {
    count: number;
    remaining: number;
    isPremium: boolean;
    canAnalyze: boolean;
    bonusCredits: number;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    usage: UsageInfo | null;
    profile: Profile | null;
    profileLoading: boolean;
    isProfileComplete: boolean;
    refreshUsage: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string, lastName?: string, firstName?: string) => Promise<{ error: Error | null }>;
    signInWithGoogle: () => Promise<{ error: Error | null }>;
    resetPassword: (email: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [usage, setUsage] = useState<UsageInfo | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [profileLoading, setProfileLoading] = useState(true);

    const isProfileComplete = Boolean(profile?.last_name && profile?.first_name);

    const refreshProfile = async () => {
        if (!user) {
            setProfile(null);
            setProfileLoading(false);
            return;
        }

        setProfileLoading(true);
        try {
            const data = await getProfile(user.uid);
            setProfile(data);
        } catch (err) {
            setProfile(null);
        } finally {
            setProfileLoading(false);
        }
    };

    const refreshUsage = async () => {
        if (!user) {
            setUsage(null);
            return;
        }

        const result = await canAnalyze(user.uid);

        setUsage({
            count: FREE_MONTHLY_LIMIT - Math.max(0, result.remaining - result.bonusCredits),
            remaining: result.remaining,
            isPremium: result.isPremium,
            canAnalyze: result.allowed,
            bonusCredits: result.bonusCredits,
        });
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                setProfileLoading(true);
            }
            setUser(firebaseUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Refresh usage and profile when user changes
    useEffect(() => {
        refreshUsage();
        refreshProfile();
    }, [user]);

    const signIn = async (email: string, password: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            return { error: null };
        } catch (err) {
            return { error: err as Error };
        }
    };

    const signUp = async (email: string, password: string, lastName?: string, firstName?: string) => {
        try {
            const credential = await createUserWithEmailAndPassword(auth, email, password);

            // If signup successful and we have name data, create profile
            if (credential.user && (lastName || firstName)) {
                await upsertProfile(credential.user.uid, {
                    last_name: lastName || '',
                    first_name: firstName || '',
                });
            }

            return { error: null };
        } catch (err) {
            return { error: err as Error };
        }
    };

    const handleSignOut = async () => {
        await firebaseSignOut(auth);
        setUser(null);
        setUsage(null);
        setProfile(null);
    };

    const handleSignInWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            return { error: null };
        } catch (err) {
            return { error: err as Error };
        }
    };

    const resetPassword = async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
            return { error: null };
        } catch (err) {
            return { error: err as Error };
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            usage,
            profile,
            profileLoading,
            isProfileComplete,
            refreshUsage,
            refreshProfile,
            signIn,
            signUp,
            signInWithGoogle: handleSignInWithGoogle,
            resetPassword,
            signOut: handleSignOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export { FREE_MONTHLY_LIMIT };

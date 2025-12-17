import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, canAnalyze, FREE_MONTHLY_LIMIT } from '../lib/supabase';

interface UsageInfo {
    count: number;
    remaining: number;
    isPremium: boolean;
    canAnalyze: boolean;
    bonusCredits: number;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    usage: UsageInfo | null;
    refreshUsage: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [usage, setUsage] = useState<UsageInfo | null>(null);

    const refreshUsage = async () => {
        if (!user) {
            setUsage(null);
            return;
        }

        const result = await canAnalyze(user.id);

        setUsage({
            count: FREE_MONTHLY_LIMIT - Math.max(0, result.remaining - result.bonusCredits),
            remaining: result.remaining,
            isPremium: result.isPremium,
            canAnalyze: result.allowed,
            bonusCredits: result.bonusCredits
        });
    };

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Refresh usage when user changes
    useEffect(() => {
        refreshUsage();
    }, [user]);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error as Error | null };
    };

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error as Error | null };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setUsage(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            loading,
            usage,
            refreshUsage,
            signIn,
            signUp,
            signOut
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

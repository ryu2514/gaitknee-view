import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Constants
export const FREE_MONTHLY_LIMIT = 5;

// Helper functions
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
}

export async function signUpWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });
    return { data, error };
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

// Get current month in YYYY-MM format
function getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Get usage data for current month (including bonus credits)
export async function getMonthlyUsage(userId: string): Promise<{ count: number; bonusCredits: number }> {
    const month = getCurrentMonth();

    const { data, error } = await supabase
        .from('usage')
        .select('count, bonus_credits')
        .eq('user_id', userId)
        .eq('month', month)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching usage:', error);
        return { count: 0, bonusCredits: 0 };
    }

    return {
        count: data?.count || 0,
        bonusCredits: data?.bonus_credits || 0
    };
}

// Increment usage count
export async function incrementUsage(userId: string): Promise<{ success: boolean; count: number }> {
    const month = getCurrentMonth();

    // First, try to get existing record
    const { data: existing } = await supabase
        .from('usage')
        .select('id, count')
        .eq('user_id', userId)
        .eq('month', month)
        .single();

    if (existing) {
        // Update existing record
        const newCount = existing.count + 1;
        const { error } = await supabase
            .from('usage')
            .update({ count: newCount })
            .eq('id', existing.id);

        if (error) {
            console.error('Error updating usage:', error);
            return { success: false, count: existing.count };
        }
        return { success: true, count: newCount };
    } else {
        // Insert new record
        const { error } = await supabase
            .from('usage')
            .insert({ user_id: userId, month, count: 1 });

        if (error) {
            console.error('Error inserting usage:', error);
            return { success: false, count: 0 };
        }
        return { success: true, count: 1 };
    }
}

// Check if user can analyze (has remaining free uses, bonus credits, or is subscribed)
export async function canAnalyze(userId: string): Promise<{ allowed: boolean; remaining: number; isPremium: boolean; bonusCredits: number }> {
    // Check subscription status first
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

    if (subscription) {
        return { allowed: true, remaining: -1, isPremium: true, bonusCredits: 0 }; // -1 means unlimited
    }

    // Check usage (now returns object with count and bonusCredits)
    const usageData = await getMonthlyUsage(userId);
    const freeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - usageData.count);
    const totalRemaining = freeRemaining + usageData.bonusCredits;

    return {
        allowed: totalRemaining > 0,
        remaining: totalRemaining,
        isPremium: false,
        bonusCredits: usageData.bonusCredits
    };
}

import { User, UserRole } from './types';
import { supabase } from './lib/supabase';

const USERS_KEY = 'mrcp_users';
const SESSION_KEY = 'mrcp_auth_session';

// ── Helpers ──────────────────────────────────────────────────
function generateId() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function hashPassword(password: string): string {
  // Simple deterministic hash for localStorage-based auth (not production crypto)
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hashed_${Math.abs(hash).toString(16)}`;
}

interface StoredUser extends User {
  passwordHash: string;
}

// ── Load / Save ───────────────────────────────────────────────
function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ── Seed default admin ────────────────────────────────────────
function seedAdmin() {
  const users = loadUsers();
  const adminExists = users.find((u) => u.email === 'admin@mrcpqbank.com');
  if (!adminExists) {
    const admin: StoredUser = {
      id: 'admin_001',
      name: 'Admin',
      email: 'admin@mrcpqbank.com',
      role: 'admin',
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword('Admin@1234'),
    };
    users.push(admin);
    saveUsers(users);
  }
}

seedAdmin();

// ── Public API ────────────────────────────────────────────────
export interface AuthError {
  field?: string;
  message: string;
}

export function signUp(
  name: string,
  email: string,
  password: string
): { user: User | null; error: AuthError | null } {
  const trimName = name.trim();
  const trimEmail = email.trim().toLowerCase();

  if (!trimName || trimName.length < 2)
    return { user: null, error: { field: 'name', message: 'Name must be at least 2 characters.' } };
  if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail))
    return { user: null, error: { field: 'email', message: 'Please enter a valid email address.' } };
  if (password.length < 6)
    return { user: null, error: { field: 'password', message: 'Password must be at least 6 characters.' } };

  const users = loadUsers();
  if (users.find((u) => u.email === trimEmail))
    return { user: null, error: { field: 'email', message: 'An account with this email already exists.' } };

  const role: UserRole = trimEmail === 'admin@mrcpqbank.com' ? 'admin' : 'student';
  const newUser: StoredUser = {
    id: generateId(),
    name: trimName,
    email: trimEmail,
    role,
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password),
  };

  users.push(newUser);
  saveUsers(users);

  const { passwordHash: _ph, ...publicUser } = newUser;
  startSession(publicUser);
  return { user: publicUser, error: null };
}

export async function signIn(
  email: string,
  password: string
): Promise<{ user: User | null; error: AuthError | null }> {
  const trimEmail = email.trim().toLowerCase();

  if (!trimEmail)
    return { user: null, error: { field: 'email', message: 'Please enter your email.' } };
  if (!password)
    return { user: null, error: { field: 'password', message: 'Please enter your password.' } };

  // 1. Check Supabase admin-created accounts FIRST — admin password always wins
  try {
    const { data } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('email', trimEmail)
      .single();

    if (data) {
      if ((data as { password_hash: string }).password_hash !== hashPassword(password))
        return { user: null, error: { field: 'password', message: 'Incorrect password. Please try again.' } };

      const publicUser: User = {
        id: (data as { id: string }).id,
        name: (data as { name: string }).name,
        email: (data as { email: string }).email,
        role: ((data as { role: string }).role ?? 'student') as UserRole,
        createdAt: (data as { created_at: string }).created_at,
      };
      // Sync to localStorage so future logins are instant
      const allUsers = loadUsers();
      const idx = allUsers.findIndex((u) => u.email === trimEmail);
      const stored: StoredUser = { ...publicUser, passwordHash: hashPassword(password) };
      if (idx >= 0) allUsers[idx] = stored; else allUsers.push(stored);
      saveUsers(allUsers);
      startSession(publicUser);
      return { user: publicUser, error: null };
    }
  } catch {
    // Supabase unavailable — fall through to localStorage
  }

  // 2. Fallback: localStorage (self-registered users)
  const users = loadUsers();
  const found = users.find((u) => u.email === trimEmail);
  if (!found)
    return { user: null, error: { field: 'email', message: 'No account found with this email.' } };

  if (found.passwordHash !== hashPassword(password))
    return { user: null, error: { field: 'password', message: 'Incorrect password. Please try again.' } };

  const { passwordHash: _ph, ...publicUser } = found;
  startSession(publicUser);
  return { user: publicUser, error: null };
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

export function getSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function startSession(user: User) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function getAllUsers(): User[] {
  return loadUsers().map(({ passwordHash: _ph, ...u }) => u);
}

export function deleteUser(id: string) {
  const users = loadUsers().filter((u) => u.id !== id);
  saveUsers(users);
}

export function updateUserRole(id: string, role: UserRole) {
  const users = loadUsers().map((u) => (u.id === id ? { ...u, role } : u));
  saveUsers(users);
  const session = getSession();
  if (session?.id === id) startSession({ ...session, role });
}

// ── Subscription (Supabase-backed) ────────────────────────────
/**
 * Checks Supabase for the user's subscription status.
 * Returns true if subscribed. Admins always get true.
 */
export async function checkSubscription(email: string, role: UserRole): Promise<boolean> {
  if (role === 'admin') return true;
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('subscribed')
      .eq('email', email.toLowerCase())
      .single();
    return (data as { subscribed: boolean } | null)?.subscribed ?? false;
  } catch {
    return false;
  }
}

/**
 * Admin sets subscription status for a user by email.
 */
export async function setSubscription(
  email: string,
  subscribed: boolean,
  activatedBy: string,
): Promise<void> {
  await supabase.from('subscriptions').upsert(
    {
      email: email.toLowerCase(),
      subscribed,
      activated_at: new Date().toISOString(),
      activated_by: activatedBy,
    },
    { onConflict: 'email' },
  );
}

/**
 * Admin resets a student's password in Supabase and clears their localStorage cache
 * on this device. On next login the student will use the new password.
 */
export async function adminResetPassword(
  email: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  const trimEmail = email.trim().toLowerCase();

  const { error } = await supabase
    .from('user_accounts')
    .update({ password_hash: hashPassword(newPassword) })
    .eq('email', trimEmail);

  if (error) return { ok: false, error: error.message };

  // Clear cached localStorage entry so the new hash is used on next login
  const users = loadUsers().filter((u) => u.email !== trimEmail);
  saveUsers(users);
  return { ok: true };
}

/**
 * Admin creates an account for a student. Stored in Supabase so the
 * student can log in from any device. Also auto-grants subscription.
 */
export async function adminCreateAccount(
  name: string,
  email: string,
  password: string,
  createdBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimEmail = email.trim().toLowerCase();
  const trimName = name.trim();

  if (!trimName || trimName.length < 2) return { ok: false, error: 'Name must be at least 2 characters.' };
  if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) return { ok: false, error: 'Invalid email address.' };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };

  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Check for duplicate in Supabase
  const { data: existing } = await supabase
    .from('user_accounts')
    .select('email')
    .eq('email', trimEmail)
    .single();
  if (existing) return { ok: false, error: 'An account with this email already exists.' };

  const { error: insertError } = await supabase.from('user_accounts').insert({
    id,
    name: trimName,
    email: trimEmail,
    password_hash: hashPassword(password),
    role: 'student',
    created_at: new Date().toISOString(),
    created_by: createdBy,
  });

  if (insertError) return { ok: false, error: insertError.message };

  // Auto-grant subscription
  await setSubscription(trimEmail, true, createdBy);

  return { ok: true };
}

/**
 * Fetch all subscription records for displaying in admin panel.
 */
export async function getAllSubscriptions(): Promise<
  { email: string; subscribed: boolean; activated_at: string | null }[]
> {
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('email, subscribed, activated_at');
    return (data ?? []) as { email: string; subscribed: boolean; activated_at: string | null }[];
  } catch {
    return [];
  }
}

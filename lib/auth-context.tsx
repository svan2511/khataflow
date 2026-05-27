import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { api, setUnauthorizedHandler } from './api';

interface User {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  phone_verified_at: string | null;
  has_shop: boolean;
  created_at: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (phone: string, otp: string) => Promise<User>;
  signOut: () => Promise<void>;
  forceSignOut: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const CLEAR_FLAG_KEY = 'force_clear_done';

async function clearStaleAuth() {
  const done = await SecureStore.getItemAsync(CLEAR_FLAG_KEY);
  if (done) return;
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
  await SecureStore.setItemAsync(CLEAR_FLAG_KEY, '1');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    clearStaleAuth().then(loadStoredAuth);

    setUnauthorizedHandler(async () => {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      setState({ token: null, user: null, isLoading: false });
      router.replace('/login');
    });

    return () => setUnauthorizedHandler(() => {});
  }, []);

  async function loadStoredAuth() {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);

      if (token && userJson) {
        const user = JSON.parse(userJson);
        setState({ token, user, isLoading: false });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }

  const signIn = useCallback(async (phone: string, otp: string): Promise<User> => {
    const response = await api.verifyOtp(phone, otp);
    const { user, token } = response.data;

    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);

    setState({ token, user, isLoading: false });
    return user;
  }, []);

  const signOut = useCallback(async () => {
    if (state.token) {
      try {
        await api.logout(state.token);
      } catch {
        // ignore logout API errors
      }
    }

    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);

    setState({ token: null, user: null, isLoading: false });
    router.replace('/login');
  }, [state.token]);

  const forceSignOut = useCallback(async () => {
    setUnauthorizedHandler(() => {});
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    setState({ token: null, user: null, isLoading: false });
    router.replace('/login');
  }, []);

  const setUser = useCallback((user: User) => {
    setState(prev => ({ ...prev, user }));
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, forceSignOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

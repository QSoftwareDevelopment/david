import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { ApiError, get, post, setApiSession } from '@/api/client';
import type { Access, Hotel, Me } from '@/api/types';
import { supabase } from '@/lib/supabase';

/**
 * Who is using the app, and which hotel they are looking at.
 *
 * `status` is three-valued so a returning user never sees the sign-in screen
 * flash before being taken home. Demo mode skips accounts entirely: it is on
 * with EXPO_PUBLIC_DEMO=1 (or ?demo=1 on web) and the demo server answers for
 * its one hotel.
 */

export type AuthStatus = 'restoring' | 'signedOut' | 'needsHotel' | 'signedIn';

type Ctx = {
  status: AuthStatus;
  demo: boolean;
  hotel: Hotel | null;
  hotels: Hotel[];
  email: string | null;
  now: Date;
  /** What this person may see: everything, or one department. */
  access: Access;
  /** True for someone who works a single department. */
  scoped: boolean;
  /** Who the app is being viewed as: 'self', 'manager' or a department. Owners and managers can switch; the demo can too. */
  viewAs: string;
  setViewAs: (role: string) => void;
  /** Whether this person may switch views (the demo, owners and managers). */
  canSwitch: boolean;
  /** The role this person really has, whatever view they are in. */
  actualRole: Access['role'];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  createHotel: (name: string, timezone: string) => Promise<void>;
  chooseHotel: (id: string) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function isDemoMode(): boolean {
  if (process.env.EXPO_PUBLIC_DEMO === '1') return true;
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location) return false;
  try {
    return new URLSearchParams(window.location.search).has('demo');
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const demo = useMemo(isDemoMode, []);
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [session, setSession] = useState<Session | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [now, setNow] = useState(new Date());
  const hotelId = useRef<string | null>(null);
  const [access, setAccess] = useState<Access>({ role: 'owner', department: null });
  const [actual, setActual] = useState<Access>({ role: 'owner', department: null });
  const [viewAs, setViewAsState] = useState('self');
  const viewAsRef = useRef('self');

  useEffect(() => {
    setApiSession({
      getToken: async () => (supabase ? ((await supabase.auth.getSession()).data.session?.access_token ?? null) : null),
      hotelId: () => hotelId.current,
      viewAs: () => (viewAsRef.current !== 'self' ? viewAsRef.current : null),
    });
  }, [demo]);

  const load = useCallback(async () => {
    try {
      const me = await get<Me>('/api/me');
      setHotels(me.hotels);
      setHotel(me.hotel);
      hotelId.current = me.hotel.id;
      setNow(new Date(me.now));
      setAccess(me.access ?? { role: 'owner', department: null });
      setActual(me.actualAccess ?? me.access ?? { role: 'owner', department: null });
      setStatus('signedIn');
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setHotel(null);
        hotelId.current = null;
        setStatus('needsHotel');
      } else if (e instanceof ApiError && e.status === 401) {
        setStatus('signedOut');
      } else {
        // The server is unreachable. Stay where we are rather than log anyone out.
        setStatus((s) => (s === 'restoring' ? 'signedOut' : s));
      }
    }
  }, []);

  useEffect(() => {
    if (demo || !supabase) {
      void load();
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void load();
      else setStatus('signedOut');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setHotel(null);
        setStatus('signedOut');
      } else void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [demo, load]);

  const value = useMemo<Ctx>(
    () => ({
      status,
      demo,
      hotel,
      hotels,
      email: session?.user.email ?? null,
      now,
      access,
      scoped: access.role === 'staff' && access.department !== null,
      viewAs,
      actualRole: actual.role,
      canSwitch: demo || actual.role !== 'staff' || actual.department === null,
      setViewAs(role) {
        viewAsRef.current = role;
        setViewAsState(role);
        void load();
      },
      async signIn(email, password) {
        if (!supabase) throw new Error('Sign-in is not configured.');
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'That email and password don’t match.' : error.message);
      },
      async signUp(email, password) {
        if (!supabase) throw new Error('Sign-up is not configured.');
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw new Error(error.message);
        return { needsConfirmation: !data.session };
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut();
        viewAsRef.current = 'self';
        setViewAsState('self');
        setHotel(null);
        setStatus('signedOut');
      },
      async createHotel(name, timezone) {
        await post('/api/hotels', { name, timezone });
        await load();
      },
      chooseHotel(id) {
        hotelId.current = id;
        void load();
      },
      refresh: load,
    }),
    [status, demo, hotel, hotels, session, now, access, actual, viewAs, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}

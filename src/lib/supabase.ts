import { createClient } from '@supabase/supabase-js';
import { User } from '../types';
import { StickerDefinition, StickerRarity } from './store';

/*
  ========================================================================
  SUPABASE SQL SCRIPTS - COPY AND PASTER UNDER "SQL EDITOR" IN SUPABASE:
  ========================================================================

  -- 1. Table for Album Stickers
  CREATE TABLE IF NOT EXISTS public.husf_stickers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    rarity TEXT NOT NULL,
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- Enable row level security and allow everyone public read/write (for simple tournament/gamification flow)
  ALTER TABLE public.husf_stickers ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public Read All" ON public.husf_stickers FOR SELECT USING (true);
  CREATE POLICY "Public Insert All" ON public.husf_stickers FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public Update All" ON public.husf_stickers FOR UPDATE USING (true);
  CREATE POLICY "Public Delete All" ON public.husf_stickers FOR DELETE USING (true);

  -- 2. Table for Collaborative Users / Players progress
  CREATE TABLE IF NOT EXISTS public.husf_users (
    cpf TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sector TEXT NOT NULL,
    coins INTEGER DEFAULT 0 NOT NULL,
    stickers JSONB DEFAULT '[]'::jsonb NOT NULL,
    progress JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_admin BOOLEAN DEFAULT false NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  ALTER TABLE public.husf_users ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public Users Select" ON public.husf_users FOR SELECT USING (true);
  CREATE POLICY "Public Users Insert" ON public.husf_users FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public Users Update" ON public.husf_users FOR UPDATE USING (true);
  CREATE POLICY "Public Users Delete" ON public.husf_users FOR DELETE USING (true);

  -- 3. Table for P2P trading sessions
  CREATE TABLE IF NOT EXISTS public.husf_trades (
    id TEXT PRIMARY KEY,
    initiator_user_id TEXT NOT NULL,
    initiator_user_name TEXT NOT NULL,
    initiator_sticker_id INTEGER NOT NULL,
    initiator_confirmed BOOLEAN DEFAULT false NOT NULL,
    receiver_user_id TEXT,
    receiver_user_name TEXT,
    receiver_sticker_id INTEGER,
    receiver_confirmed BOOLEAN DEFAULT false NOT NULL,
    status TEXT NOT NULL, -- 'pending' | 'negotiating' | 'completed' | 'cancelled'
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  ALTER TABLE public.husf_trades ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public Trades Select" ON public.husf_trades FOR SELECT USING (true);
  CREATE POLICY "Public Trades Insert" ON public.husf_trades FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public Trades Update" ON public.husf_trades FOR UPDATE USING (true);
  CREATE POLICY "Public Trades Delete" ON public.husf_trades FOR DELETE USING (true);

  ========================================================================
*/

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabaseClient = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Default initial user mock if local/Supabase database is empty or not yet provisioned
export const DB_DEFAULT_USERS: User[] = [
  { cpf: '111.111.111-11', name: 'Ana Souza', sector: 'UTI Adulto', coins: 30, stickers: [1, 5, 12], progress: {} },
  { cpf: '222.222.222-22', name: 'Bruno Santos', sector: 'Pronto Socorro', coins: 10, stickers: [], progress: {} },
  { cpf: '333.333.333-33', name: 'Carolina Lima', sector: 'Centro Cirúrgico', coins: 150, stickers: [], progress: {} },
  { cpf: '444.444.444-44', name: 'Dr. Roberto Alves', sector: 'Clínica Médica', coins: 0, stickers: [], progress: {} },
  { cpf: '136.832.356-16', name: 'Thalis Alves Ramos', sector: 'Diretoria de Ensino e Pesquisa', coins: 850, stickers: [1, 3, 5, 7, 9, 11, 13], progress: {}, isAdmin: true },
];

export const DB_DEFAULT_STICKERS: StickerDefinition[] = [
  ...Array.from({ length: 12 }).map((_, i) => ({
    id: i + 1,
    name: `Figurinha Meta ${(i % 6) + 1} - #${i + 1}`,
    rarity: 'regular' as StickerRarity
  })),
  { id: 13, name: 'Celso Paredão', rarity: 'holografica' },
  { id: 14, name: 'Speak Up', rarity: 'holografica' },
  { id: 15, name: 'Lampião', rarity: 'lendaria' },
  { id: 16, name: 'Mãos Limpas', rarity: 'lendaria' },
  { id: 17, name: 'Suprema Bola de Ouro', rarity: 'suprema' }
];

// Helper to prevent database queries from hanging indefinitely if network/firewall/CORS is failing
function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Superou tempo limite de resposta da nuvem (2.5s)'));
    }, timeoutMs);
    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// ────────────────────────────────────────────────────────────────────────
// USERS SYNCHRONIZATION HELPERS
// ────────────────────────────────────────────────────────────────────────

export async function dbGetUsers(): Promise<User[]> {
  const getLocalBackup = (): User[] => {
    const local = localStorage.getItem('husf_users');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If cache exists but doesn't have the default admin, ensure it's merged or added
          if (!parsed.some(u => u.isAdmin)) {
            const merged = [...parsed];
            DB_DEFAULT_USERS.forEach(du => {
              if (!merged.some(mu => mu.cpf === du.cpf)) {
                merged.push(du);
              }
            });
            localStorage.setItem('husf_users', JSON.stringify(merged));
            return merged;
          }
          // Enforce Thalis Alves Ramos' name/sector on the admin CPF
          let updated = false;
          const updatedParsed = parsed.map(u => {
            if (u.cpf === '136.832.356-16') {
              if (u.name !== 'Thalis Alves Ramos' || u.sector !== 'Diretoria de Ensino e Pesquisa') {
                updated = true;
                return { ...u, name: 'Thalis Alves Ramos', sector: 'Diretoria de Ensino e Pesquisa', isAdmin: true };
              }
            }
            return u;
          });
          if (updated) {
            localStorage.setItem('husf_users', JSON.stringify(updatedParsed));
            return updatedParsed;
          }
          return parsed;
        }
      } catch { }
    }
    localStorage.setItem('husf_users', JSON.stringify(DB_DEFAULT_USERS));
    return DB_DEFAULT_USERS;
  };

  if (!isSupabaseConfigured || !supabaseClient) {
    return getLocalBackup();
  }

  try {
    const { data, error } = await promiseWithTimeout(
      supabaseClient
        .from('husf_users')
        .select('*')
        .order('name', { ascending: true }) as any,
      2500
    ) as any;

    if (error) throw error;

    if (data && data.length > 0) {
      const parsed: User[] = data.map((u) => {
        const isThisAdmin = u.cpf === '136.832.356-16';
        return {
          cpf: u.cpf,
          name: isThisAdmin ? 'Thalis Alves Ramos' : u.name,
          sector: isThisAdmin ? 'Diretoria de Ensino e Pesquisa' : u.sector,
          coins: Number(u.coins),
          stickers: Array.isArray(u.stickers) ? u.stickers : [],
          progress: typeof u.progress === 'object' && u.progress !== null ? u.progress : {},
          isAdmin: isThisAdmin || !!u.is_admin
        };
      });
      // Keep local sync updated
      localStorage.setItem('husf_users', JSON.stringify(parsed));
      return parsed;
    } else {
      // Seed default users to remote DB
      await dbSaveUsers(DB_DEFAULT_USERS);
      return DB_DEFAULT_USERS;
    }
  } catch (err) {
    console.warn('Supabase users query failed, loading from local storage backup:', err);
    return getLocalBackup();
  }
}

export async function dbSaveUsers(users: User[]): Promise<void> {
  // Always update local storage first so offline experience continues immediately
  localStorage.setItem('husf_users', JSON.stringify(users));

  if (!isSupabaseConfigured || !supabaseClient) return;

  try {
    const payloads = users.map((u) => ({
      cpf: u.cpf,
      name: u.name,
      sector: u.sector,
      coins: u.coins,
      stickers: u.stickers,
      progress: u.progress,
      is_admin: !!u.isAdmin,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabaseClient
      .from('husf_users')
      .upsert(payloads, { onConflict: 'cpf' });

    if (error) throw error;
  } catch (err) {
    console.error('Failed to sync users to Supabase:', err);
  }
}

export async function dbSaveSingleUser(user: User): Promise<void> {
  // Update local storage too to prevent state inconsistency
  const localUsers = await dbGetUsers();
  const index = localUsers.findIndex(u => u.cpf === user.cpf);
  if (index !== -1) {
    localUsers[index] = user;
  } else {
    localUsers.push(user);
  }
  localStorage.setItem('husf_users', JSON.stringify(localUsers));

  if (!isSupabaseConfigured || !supabaseClient) return;

  try {
    const { error } = await supabaseClient
      .from('husf_users')
      .upsert({
        cpf: user.cpf,
        name: user.name,
        sector: user.sector,
        coins: user.coins,
        stickers: user.stickers,
        progress: user.progress,
        is_admin: !!user.isAdmin,
        updated_at: new Date().toISOString()
      }, { onConflict: 'cpf' });

    if (error) throw error;
  } catch (err) {
    console.error(`Failed to sync individual user ${user.cpf} to Supabase:`, err);
  }
}


// ────────────────────────────────────────────────────────────────────────
// STICKERS CATALOG SYNCHRONIZATION HELPERS
// ────────────────────────────────────────────────────────────────────────

export async function dbGetStickers(): Promise<StickerDefinition[]> {
  const getLocalCatalog = (): StickerDefinition[] => {
    const local = localStorage.getItem('husf_sticker_catalog');
    if (local) {
      try { return JSON.parse(local); } catch { }
    }
    localStorage.setItem('husf_sticker_catalog', JSON.stringify(DB_DEFAULT_STICKERS));
    return DB_DEFAULT_STICKERS;
  };

  if (!isSupabaseConfigured || !supabaseClient) {
    return getLocalCatalog();
  }

  try {
    const { data, error } = await promiseWithTimeout(
      supabaseClient
        .from('husf_stickers')
        .select('*')
        .order('id', { ascending: true }) as any,
      2500
    ) as any;

    if (error) throw error;

    if (data && data.length > 0) {
      const parsed: StickerDefinition[] = data.map((s) => ({
        id: s.id,
        name: s.name,
        rarity: s.rarity as StickerRarity,
        image: s.image || undefined
      }));
      localStorage.setItem('husf_sticker_catalog', JSON.stringify(parsed));
      return parsed;
    } else {
      // Seed remote table since it has empty rows
      await dbSaveWholeCatalog(DB_DEFAULT_STICKERS);
      return DB_DEFAULT_STICKERS;
    }
  } catch (err) {
    console.warn('Supabase stickers query failed, loading from local storage backup:', err);
    return getLocalCatalog();
  }
}

export async function dbSaveWholeCatalog(stickers: StickerDefinition[]): Promise<void> {
  localStorage.setItem('husf_sticker_catalog', JSON.stringify(stickers));

  if (!isSupabaseConfigured || !supabaseClient) return;

  try {
    const payloads = stickers.map((s) => ({
      id: s.id,
      name: s.name,
      rarity: s.rarity,
      image: s.image || null
    }));

    // Perform massive upsert or block inserts
    const { error } = await supabaseClient
      .from('husf_stickers')
      .upsert(payloads, { onConflict: 'id' });

    if (error) throw error;
  } catch (err) {
    console.error('Failed to sync sticker catalog to Supabase:', err);
  }
}

export async function dbInsertSticker(sticker: StickerDefinition): Promise<void> {
  const current = await dbGetStickers();
  if (!current.some(s => s.id === sticker.id)) {
    current.push(sticker);
  }
  localStorage.setItem('husf_sticker_catalog', JSON.stringify(current));

  if (!isSupabaseConfigured || !supabaseClient) return;

  try {
    const { error } = await supabaseClient
      .from('husf_stickers')
      .insert({
        id: sticker.id,
        name: sticker.name,
        rarity: sticker.rarity,
        image: sticker.image || null
      });

    if (error) throw error;
  } catch (err) {
    console.error('Failed to insert new sticker on Supabase:', err);
  }
}

export async function dbDeleteSticker(id: number): Promise<void> {
  const current = await dbGetStickers();
  const updated = current.filter(s => s.id !== id);
  localStorage.setItem('husf_sticker_catalog', JSON.stringify(updated));

  if (!isSupabaseConfigured || !supabaseClient) return;

  try {
    const { error } = await supabaseClient
      .from('husf_stickers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    console.error('Failed to delete sticker from Supabase:', err);
  }
}


// ────────────────────────────────────────────────────────────────────────
// P2P TRADES SYNCHRONIZATION HELPERS
// ────────────────────────────────────────────────────────────────────────

export interface TradeSessionModel {
  id: string;
  initiator: {
    userId: string;
    userName: string;
    stickerId: number;
    confirmed: boolean;
  };
  receiver?: {
    userId: string;
    userName: string;
    stickerId: number;
    confirmed: boolean;
  };
  status: 'pending' | 'negotiating' | 'completed' | 'cancelled';
  expiresAt: number;
}

export async function dbGetTrade(id: string): Promise<TradeSessionModel | null> {
  if (!isSupabaseConfigured || !supabaseClient) {
    const local = localStorage.getItem(`celso_trade_${id}`);
    return local ? JSON.parse(local) : null;
  }

  try {
    const { data, error } = await promiseWithTimeout(
      supabaseClient
        .from('husf_trades')
        .select('*')
        .eq('id', id)
        .single() as any,
      2500
    ) as any;

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }

    if (!data) return null;

    const formatted: TradeSessionModel = {
      id: data.id,
      initiator: {
        userId: data.initiator_user_id,
        userName: data.initiator_user_name,
        stickerId: data.initiator_sticker_id,
        confirmed: !!data.initiator_confirmed
      },
      receiver: data.receiver_user_id ? {
        userId: data.receiver_user_id,
        userName: data.receiver_user_name || '',
        stickerId: data.receiver_sticker_id || 0,
        confirmed: !!data.receiver_confirmed
      } : undefined,
      status: data.status as any,
      expiresAt: Number(data.expires_at)
    };

    return formatted;
  } catch (err) {
    console.warn('Failed to query trade session from Supabase, loading from cache:', err);
    const local = localStorage.getItem(`celso_trade_${id}`);
    return local ? JSON.parse(local) : null;
  }
}

export async function dbUpsertTrade(trade: TradeSessionModel): Promise<void> {
  localStorage.setItem(`celso_trade_${trade.id}`, JSON.stringify(trade));

  if (!isSupabaseConfigured || !supabaseClient) return;

  try {
    const payload = {
      id: trade.id,
      initiator_user_id: trade.initiator.userId,
      initiator_user_name: trade.initiator.userName,
      initiator_sticker_id: trade.initiator.stickerId,
      initiator_confirmed: !!trade.initiator.confirmed,
      receiver_user_id: trade.receiver?.userId || null,
      receiver_user_name: trade.receiver?.userName || null,
      receiver_sticker_id: trade.receiver?.stickerId || null,
      receiver_confirmed: !!trade.receiver?.confirmed,
      status: trade.status,
      expires_at: trade.expiresAt
    };

    const { error } = await supabaseClient
      .from('husf_trades')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw error;
  } catch (err) {
    console.error('Failed to upsert trade session on Supabase:', err);
  }
}

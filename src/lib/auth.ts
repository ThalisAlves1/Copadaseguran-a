import { User } from '../types';
import { dbGetUsers, dbSaveUsers, DB_DEFAULT_USERS } from './supabase';

// Initialize local database back-up if not present or migrate existing back-up to Thalis Alves Ramos
const initialUsersRaw = localStorage.getItem('husf_users');
if (!initialUsersRaw) {
  localStorage.setItem('husf_users', JSON.stringify(DB_DEFAULT_USERS));
} else {
  try {
    const parsed = JSON.parse(initialUsersRaw);
    if (Array.isArray(parsed)) {
      let changed = false;
      const mutated = parsed.map(u => {
        if (u.cpf === '136.832.356-16') {
          if (u.name !== 'Thalis Alves Ramos' || u.sector !== 'Diretoria de Ensino e Pesquisa') {
            changed = true;
            return {
              ...u,
              name: 'Thalis Alves Ramos',
              sector: 'Diretoria de Ensino e Pesquisa',
              isAdmin: true
            };
          }
        }
        return u;
      });
      if (changed) {
        localStorage.setItem('husf_users', JSON.stringify(mutated));
      }
    }
  } catch (err) {}
}

export function getStoredUsers(): User[] {
  const data = localStorage.getItem('husf_users');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.map(u => {
          if (u.cpf === '136.832.356-16') {
            return {
              ...u,
              name: 'Thalis Alves Ramos',
              sector: 'Diretoria de Ensino e Pesquisa',
              isAdmin: true
            };
          }
          return u;
        });
      }
      return DB_DEFAULT_USERS;
    } catch {
      return DB_DEFAULT_USERS;
    }
  }
  return DB_DEFAULT_USERS;
}

export function saveStoredUsers(users: User[]) {
  localStorage.setItem('husf_users', JSON.stringify(users));
  // Background-sync with Supabase
  dbSaveUsers(users);
}

export const MOCK_USERS = getStoredUsers();

export const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const simulateLogin = async (cpf: string): Promise<User | null> => {
  try {
    // Attempt fetching the freshest list from Supabase
    const users = await dbGetUsers();
    const user = users.find((u) => u.cpf === cpf);
    return user ? JSON.parse(JSON.stringify(user)) : null;
  } catch (err) {
    console.warn("CPF lookup falling back to local list:", err);
    const users = getStoredUsers();
    const user = users.find((u) => u.cpf === cpf);
    return user ? JSON.parse(JSON.stringify(user)) : null;
  }
};



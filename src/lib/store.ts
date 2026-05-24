export type StickerRarity = 'regular' | 'holografica' | 'lendaria' | 'suprema';

export interface StickerDefinition {
  id: number;
  name: string;
  rarity: StickerRarity;
  image?: string;
}

import { dbSaveWholeCatalog, DB_DEFAULT_STICKERS } from './supabase';

// Get stickers from localStorage, with predefined initial values
export function getStoredStickers(): StickerDefinition[] {
  const data = localStorage.getItem('husf_sticker_catalog');
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      // Use defaults
    }
  }

  localStorage.setItem('husf_sticker_catalog', JSON.stringify(DB_DEFAULT_STICKERS));
  return DB_DEFAULT_STICKERS;
}

// Save stickers collection to localStorage
export function saveStoredStickers(stickers: StickerDefinition[]) {
  localStorage.setItem('husf_sticker_catalog', JSON.stringify(stickers));
  dbSaveWholeCatalog(stickers);
}


export function getStickersByRarity(rarity: StickerRarity): StickerDefinition[] {
  const allStickers = getStoredStickers();
  const list = allStickers.filter(s => s.rarity === rarity);
  if (list.length === 0) {
    // Safety fallback
    return [{ id: 9990 + (rarity === 'regular' ? 1 : rarity === 'holografica' ? 2 : rarity === 'lendaria' ? 3 : 4), name: `Cromo Coringa (${rarity.toUpperCase()})`, rarity }];
  }
  return list;
}

export const STICKER_CATALOG = {
  get regular() { return getStickersByRarity('regular'); },
  get holografica() { return getStickersByRarity('holografica'); },
  get lendaria() { return getStickersByRarity('lendaria'); },
  get suprema() { return getStickersByRarity('suprema'); }
};

export interface PackageDefinition {
  id: string;
  name: string;
  category: string;
  price: number;
  color: string;
  description: string;
  guaranteed: string;
  imageUrl?: string;
}

export const getAllStickers = () => {
  return getStoredStickers();
};

export const getStickerById = (id: number) => getAllStickers().find(s => s.id === id);

export const PACKAGES: PackageDefinition[] = [
  {
    id: 'plantao',
    name: 'Pacote do Plantão',
    category: 'Comum',
    price: 30,
    color: 'bg-emerald-500',
    description: 'Porta de entrada. Preencha a base do álbum regular.',
    guaranteed: '3 Figurinhas Regulares'
  },
  {
    id: 'elite',
    name: 'Pacote de Elite da Qualidade',
    category: 'Raro',
    price: 60,
    color: 'bg-amber-400',
    description: 'Introduz a chance de adquirir cromos holográficos.',
    guaranteed: '3 Figurinhas Mistas'
  },
  {
    id: 'reliquia',
    name: 'Pacote Relíquia Histórica',
    category: 'Lendário',
    price: 100,
    color: 'bg-fuchsia-600',
    description: 'Garante uma figurinha Lendária Retrô.',
    guaranteed: '1 Lendária + 2 Mistas'
  },
  {
    id: 'final',
    name: 'Pacote Grandes Finais',
    category: 'Premium',
    price: 150,
    color: 'bg-slate-900',
    description: 'A melhor oportunidade para caçar a Suprema Bola de Ouro.',
    guaranteed: '3 Figurinhas Mistas Premium'
  }
];

const pickRandom = (arr: StickerDefinition[]) => arr[Math.floor(Math.random() * arr.length)];

const gachaRoll = (rates: { regular: number, holografica: number, lendaria: number, suprema: number }): StickerDefinition => {
  const rand = Math.random() * 100;
  let accum = 0;
  
  accum += rates.suprema;
  if (rand <= accum) return pickRandom(STICKER_CATALOG.suprema);
  
  accum += rates.lendaria;
  if (rand <= accum) return pickRandom(STICKER_CATALOG.lendaria);
  
  accum += rates.holografica;
  if (rand <= accum) return pickRandom(STICKER_CATALOG.holografica);
  
  return pickRandom(STICKER_CATALOG.regular);
};

export const openPackage = (packageId: string): StickerDefinition[] => {
  const results: StickerDefinition[] = [];
  
  if (packageId === 'plantao') {
    // 100% regular
    for (let i = 0; i < 3; i++) {
      results.push(gachaRoll({ regular: 100, holografica: 0, lendaria: 0, suprema: 0 }));
    }
  } else if (packageId === 'elite') {
    // 80% reg, 18% holo, 1.9% lend, 0.1% sup
    for (let i = 0; i < 3; i++) {
      results.push(gachaRoll({ regular: 80, holografica: 18, lendaria: 1.9, suprema: 0.1 }));
    }
  } else if (packageId === 'reliquia') {
    // Slot 1: 100% Lendaria
    results.push(gachaRoll({ regular: 0, holografica: 0, lendaria: 100, suprema: 0 }));
    // Slot 2 and 3: 85% Reg, 14.5% Holo, 0% Lend, 0.5% Sup
    for (let i = 0; i < 2; i++) {
      results.push(gachaRoll({ regular: 85, holografica: 14.5, lendaria: 0, suprema: 0.5 }));
    }
  } else if (packageId === 'final') {
    // 45% reg, 40% holo, 12% lend, 3% sup
    for (let i = 0; i < 3; i++) {
      results.push(gachaRoll({ regular: 45, holografica: 40, lendaria: 12, suprema: 3 }));
    }
  }
  
  return results;
};


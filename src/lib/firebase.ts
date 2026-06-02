import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, onSnapshot, query, where, DocumentData } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { User } from '../types';
import { StickerDefinition } from './store';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const USERS_COLLECTION = 'husf_users';
const STICKERS_COLLECTION = 'husf_stickers';

export const dbGetUsers = async (): Promise<User[]> => {
  const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
  return querySnapshot.docs.map(doc => doc.data() as User);
};

export const dbSaveSingleUser = async (user: User): Promise<void> => {
  await setDoc(doc(db, USERS_COLLECTION, user.cpf), user, { merge: true });
};

export const dbGetStickers = async (): Promise<StickerDefinition[]> => {
  const querySnapshot = await getDocs(collection(db, STICKERS_COLLECTION));
  return querySnapshot.docs.map(doc => doc.data() as StickerDefinition);
};

export const dbSaveWholeCatalog = async (stickers: StickerDefinition[]): Promise<void> => {
  for (const sticker of stickers) {
    await setDoc(doc(db, STICKERS_COLLECTION, String(sticker.id)), sticker, { merge: true });
  }
};

export const dbInsertSticker = async (sticker: StickerDefinition): Promise<void> => {
  await setDoc(doc(db, STICKERS_COLLECTION, String(sticker.id)), sticker);
};

export const dbUpdateSticker = async (sticker: StickerDefinition): Promise<void> => {
  await updateDoc(doc(db, STICKERS_COLLECTION, String(sticker.id)), sticker as DocumentData);
};

export const dbDeleteSticker = async (id: number): Promise<void> => {
  await deleteDoc(doc(db, STICKERS_COLLECTION, String(id)));
};

export const subscribeToUsers = (onUpdate: (payload: any) => void) => {
  return onSnapshot(collection(db, USERS_COLLECTION), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'modified') {
        onUpdate({ new: change.doc.data() });
      }
    });
  });
};


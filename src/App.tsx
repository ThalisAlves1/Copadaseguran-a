import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { User, MetaProgress } from './types';
import { openPackage } from './lib/store';
import { getStoredUsers, saveStoredUsers } from './lib/auth';

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (user) {
      const users = getStoredUsers();
      const updatedUsers = users.map(u => u.cpf === user.cpf ? user : u);
      if (!updatedUsers.some(u => u.cpf === user.cpf)) {
        updatedUsers.push(user);
      }
      saveStoredUsers(updatedUsers);
    }
  }, [user]);

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleBuyPack = (packageId: string, cost: number) => {
    if (user && user.coins >= cost) {
      const stickers = openPackage(packageId);
      const newStickerIds = stickers.map(s => s.id);
      
      setUser({
        ...user,
        coins: user.coins - cost,
        stickers: [...user.stickers, ...newStickerIds],
      });
      return stickers;
    }
    return [];
  };

  const handleQuizFinish = (metaId: number, coinsEarned: number, correctAnswers: number, newProgress: MetaProgress) => {
    if (!user) return;
    
    // Create new user object with updated coins and progress
    const updatedUser: User = {
      ...user,
      coins: user.coins + coinsEarned,
      progress: {
        ...user.progress,
        [metaId]: newProgress
      }
    };
    
    setUser(updatedUser);
  };

  const handleTradeComplete = (givenStickerId: number, receivedStickerId: number) => {
    if (!user) return;
    const newStickers = [...user.stickers];
    const indexToRemove = newStickers.indexOf(givenStickerId);
    if (indexToRemove !== -1) {
      newStickers.splice(indexToRemove, 1);
    }
    newStickers.push(receivedStickerId);
    setUser({ ...user, stickers: newStickers });
  };

  return (
    <>
      {user ? (
        <Dashboard 
          user={user} 
          onLogout={handleLogout} 
          onBuyPack={handleBuyPack} 
          onQuizFinish={handleQuizFinish} 
          onTradeComplete={handleTradeComplete} 
          onUpdateUser={setUser}
        />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

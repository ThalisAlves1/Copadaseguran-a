import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, LogOut, CheckCircle2, Building2, PlayCircle, Trophy, ShoppingBag, Coins, LayoutGrid, UserCheck, MessageSquare, Pill, Stethoscope, Droplets, ShieldAlert, ArrowLeft, BookOpen, Crown, User as UserIcon, AlertCircle, Zap, ArrowRightLeft, Search, ShieldCheck, Award, UserPlus, Trash2, Lock, Unlock, Upload, Image, Database, Wifi, WifiOff } from 'lucide-react';
import { User, MetaProgress } from '../types';
import { Store } from './Store';
import { Quiz } from './Quiz';
import { Trading } from './Trading';
import { WelcomeScreen } from './WelcomeScreen';
import { StudyMaterial } from './StudyMaterial';
import { getStoredUsers, saveStoredUsers, formatCPF } from '../lib/auth';
import { StickerDefinition, getStickerById, getAllStickers, getStoredStickers, saveStoredStickers } from '../lib/store';
import { dbGetUsers, dbGetStickers, dbSaveSingleUser, isSupabaseConfigured, lastSupabaseError, dbInsertSticker, dbDeleteSticker } from '../lib/supabase';


const METAS = [
// ... keep METAS the same ...
  { id: 1, title: 'Meta 1', desc: 'Identificar o paciente corretamente', fullDesc: 'O objetivo desta meta é garantir que o paciente correto receba o tratamento correto. Isso envolve a utilização de no mínimo dois identificadores para confirmação, como o nome completo e a data de nascimento, antes de qualquer intervenção, administração de medicamentos ou procedimentos.', icon: <UserCheck className="w-6 h-6" />, color: 'bg-blue-500' },
  { id: 2, title: 'Meta 2', desc: 'Melhorar a comunicação efetiva', fullDesc: 'Garantir que as informações sejam transmitidas de forma clara, precisa e oportuna entre todos os profissionais de saúde. Uma comunicação efetiva reduz a ocorrência de erros, especialmente durante as transições de cuidado e ao receber ordens verbais ou telefônicas.', icon: <MessageSquare className="w-6 h-6" />, color: 'bg-indigo-500' },
  { id: 3, title: 'Meta 3', desc: 'Segurança dos medicamentos', fullDesc: 'Melhorar a segurança no processo de prescrição, uso e administração de medicamentos. Há uma atenção redobrada aos medicamentos de alta vigilância, cujos erros podem causar danos graves, exigindo dupla checagem e rotulagem rigorosa.', icon: <Pill className="w-6 h-6" />, color: 'bg-rose-500' },
  { id: 4, title: 'Meta 4', desc: 'Assegurar cirurgia segura', fullDesc: 'Garantir que a cirurgia seja realizada no local correto, com o procedimento correto e no paciente correto. A aplicação do Checklist de Cirurgia Segura em suas três fases (antes da indução anestésica, antes da incisão cirúrgica e antes de o paciente sair da sala) é fundamental.', icon: <Stethoscope className="w-6 h-6" />, color: 'bg-amber-500' },
  { id: 5, title: 'Meta 5', desc: 'Reduzir o risco de infecções', fullDesc: 'Reduzir de forma substancial o risco de infecções associadas aos cuidados de saúde. A prática mais importante nesta meta é a correta e frequente higienização das mãos, seguindo os 5 momentos preconizados pela OMS.', icon: <Droplets className="w-6 h-6" />, color: 'bg-cyan-500' },
  { id: 6, title: 'Meta 6', desc: 'Reduzir o risco de quedas', fullDesc: 'Avaliar sistematicamente e mitigar os riscos de danos aos pacientes resultantes de quedas durante sua permanência na instituição. Isso abrange adequar o ambiente, utilizar pulseiras de identificação de risco e educar familiares e pacientes.', icon: <ShieldAlert className="w-6 h-6" />, color: 'bg-orange-500' },
];

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onBuyPack: (packageId: string, cost: number) => StickerDefinition[];
  onQuizFinish: (metaId: number, coinsEarned: number, correctCount: number, newProgress: MetaProgress) => void;
  onTradeComplete: (givenStickerId: number, receivedStickerId: number) => void;
  onUpdateUser?: (updatedUser: User) => void;
}

type TabContent = 'inicio' | 'desafios' | 'album' | 'loja' | 'perfil' | 'ranking' | 'trocas' | 'admin' | 'estudo';

export function Dashboard({ user, onLogout, onBuyPack, onQuizFinish, onTradeComplete, onUpdateUser }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabContent>('inicio');
  const [rankingTab, setRankingTab] = useState<'individual' | 'setores'>('individual');
  const [sectorRankingMetric, setSectorRankingMetric] = useState<'average' | 'total'>('average');
  const [selectedMeta, setSelectedMeta] = useState<number | null>(null);
  const [studyMetaId, setStudyMetaId] = useState<number | null>(null);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminRefresh, setAdminRefresh] = useState(0);

  // Dynamic user list and registration states
  const [usersList, setUsersList] = useState<User[]>(() => getStoredUsers());
  const [newRegCpf, setNewRegCpf] = useState('');
  const [newRegName, setNewRegName] = useState('');
  const [newRegSector, setNewRegSector] = useState('UTI Adulto');
  const [newRegError, setNewRegError] = useState('');
  const [newRegSuccess, setNewRegSuccess] = useState('');
  const [adminSearchFilter, setAdminSearchFilter] = useState('');
  const [confirmDeleteCpf, setConfirmDeleteCpf] = useState<string | null>(null);

  // States for dynamic sticker creation and management
  const [stickerRefresh, setStickerRefresh] = useState(0);
  const [newStickerName, setNewStickerName] = useState('');
  const [newStickerRarity, setNewStickerRarity] = useState<'regular' | 'holografica' | 'lendaria' | 'suprema'>('regular');
  const [newStickerImage, setNewStickerImage] = useState('');
  const [stickerImageMode, setStickerImageMode] = useState<'upload' | 'url'>('upload');
  const [stickerError, setStickerError] = useState('');
  const [stickerSuccess, setStickerSuccess] = useState('');
  const [stickerSearch, setStickerSearch] = useState('');
  const [isCreatingSticker, setIsCreatingSticker] = useState(false);
  const [isDeletingStickerId, setIsDeletingStickerId] = useState<number | null>(null);

  const handleStickerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) { // 1.5MB limit to avoid packing too much base64 into localStorage
      setStickerError('A imagem selecionada é muito grande. Escolha uma imagem de até 1.5MB para melhor desempenho.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewStickerImage(reader.result as string);
    };
    reader.onerror = () => {
      setStickerError('Erro ao ler a imagem local.');
    };
    reader.readAsDataURL(file);
  };

  const handleCreateSticker = async (e: React.FormEvent) => {
    e.preventDefault();
    setStickerError('');
    setStickerSuccess('');

    const name = newStickerName.trim();
    if (!name) {
      setStickerError('Por favor, informe o nome da figurinha.');
      return;
    }

    setIsCreatingSticker(true);
    try {
      const currentCatalog = getStoredStickers();
      const nextId = currentCatalog.length > 0 ? Math.max(...currentCatalog.map(s => s.id)) + 1 : 1;

      const newSticker: StickerDefinition = {
        id: nextId,
        name,
        rarity: newStickerRarity,
        image: newStickerImage.trim() || undefined
      };

      await dbInsertSticker(newSticker);
      setStickerRefresh(prev => prev + 1);
      setNewStickerName('');
      setNewStickerImage('');
      setStickerSuccess(`Figurinha "#${nextId} - ${name}" cadastrada com sucesso!`);
      setTimeout(() => setStickerSuccess(''), 5000);
    } catch (err: any) {
      console.error(err);
      setStickerError(`Erro ao sincronizar figurinha na nuvem: ${err.message || 'Verifique sua conexão ou tente usar uma imagem menor.'}`);
    } finally {
      setIsCreatingSticker(false);
    }
  };

  const handleDeleteSticker = async (id: number) => {
    setIsDeletingStickerId(id);
    setStickerError('');
    setStickerSuccess('');
    try {
      await dbDeleteSticker(id);
      setStickerRefresh(prev => prev + 1);
      setStickerSuccess(`Figurinha deletada com sucesso do catálogo de compras.`);
      setTimeout(() => setStickerSuccess(''), 5000);
    } catch (err: any) {
      console.error(err);
      setStickerError(`Erro ao deletar figurinha na nuvem: ${err.message || err}`);
    } finally {
      setIsDeletingStickerId(null);
    }
  };

  const [buyingStickerDirectly, setBuyingStickerDirectly] = useState<StickerDefinition | null>(null);
  const [directBuyError, setDirectBuyError] = useState('');
  const [directBuySuccess, setDirectBuySuccess] = useState('');

  const getDirectStickerPrice = (rarity: string) => {
    switch (rarity) {
      case 'regular': return 20;
      case 'holografica': return 40;
      case 'lendaria': return 75;
      case 'suprema': return 120;
      default: return 20;
    }
  };

  const handleConfirmDirectBuySticker = () => {
    if (!user || !buyingStickerDirectly) return;
    setDirectBuyError('');
    setDirectBuySuccess('');

    const price = getDirectStickerPrice(buyingStickerDirectly.rarity);
    if (user.coins < price) {
      setDirectBuyError('Você não possui moedas suficientes para adquirir este cromo diretamente.');
      return;
    }

    if (onUpdateUser) {
      onUpdateUser({
        ...user,
        coins: user.coins - price,
        stickers: [...user.stickers, buyingStickerDirectly.id]
      });
      setDirectBuySuccess('Cromo adicionado ao seu álbum com sucesso!');
      setTimeout(() => {
        setBuyingStickerDirectly(null);
        setDirectBuySuccess('');
      }, 1500);
    }
  };

  const handleGiftSticker = (targetCpf: string, stickerId: number) => {
    const currentUsers = getStoredUsers();
    let stickerName = `Figurinha #${stickerId}`;
    const foundSticker = getStickerById(stickerId);
    if (foundSticker) {
      stickerName = `"${foundSticker.name}"`;
    }
    const updated = currentUsers.map(u => {
      if (u.cpf === targetCpf) {
        const stickers = u.stickers || [];
        return { ...u, stickers: [...stickers, stickerId] };
      }
      return u;
    });
    saveStoredUsers(updated);
    setUsersList(updated);
    
    if (targetCpf === user.cpf && onUpdateUser) {
      onUpdateUser({ ...user, stickers: [...(user.stickers || []), stickerId] });
    }
    
    setAdminRefresh(prev => prev + 1);
    setNewRegSuccess(`Sucesso! A figurinha ${stickerName} foi adicionada ao inventário do colaborador.`);
    setTimeout(() => setNewRegSuccess(''), 4000);
  };

  // States for bulk/mass registration
  const [regMode, setRegMode] = useState<'individual' | 'massa'>('individual');
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');
  const [bulkSummary, setBulkSummary] = useState<{
    success: number;
    duplicates: string[];
    invalid: string[];
  } | null>(null);

  // States for released safety goals (metas)
  const [releasedMetas, setReleasedMetas] = useState<number[]>(() => {
    const stored = localStorage.getItem('husf_released_metas');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [1, 2, 3, 4, 5, 6];
      }
    }
    return [1, 2, 3, 4, 5, 6];
  });

  const handleToggleMetaRelease = (metaId: number) => {
    let updated: number[];
    if (releasedMetas.includes(metaId)) {
      updated = releasedMetas.filter(id => id !== metaId);
    } else {
      updated = [...releasedMetas, metaId];
    }
    setReleasedMetas(updated);
    localStorage.setItem('husf_released_metas', JSON.stringify(updated));
  };

  const handleReleaseAllMetas = () => {
    const updated = [1, 2, 3, 4, 5, 6];
    setReleasedMetas(updated);
    localStorage.setItem('husf_released_metas', JSON.stringify(updated));
  };

  const handleLockAllMetas = () => {
    const updated: number[] = [];
    setReleasedMetas(updated);
    localStorage.setItem('husf_released_metas', JSON.stringify(updated));
  };

  // Fetch and synchronize fresh statistics from Supabase Database asynchronously
  useEffect(() => {
    let active = true;

    async function loadFreshData() {
      try {
        const freshUsers = await dbGetUsers();
        if (active) {
          setUsersList(freshUsers);
        }
      } catch (e) {
        console.warn('Dashboard failed to parse fresh database user records:', e);
      }

      try {
        await dbGetStickers();
        if (active) {
          setStickerRefresh(prev => prev + 1);
        }
      } catch (e) {
        console.warn('Dashboard failed to parse fresh database stickers catalog:', e);
      }
    }

    loadFreshData();
    return () => { active = false; };
  }, [adminRefresh, activeTab]);


  const computeSectorRanking = () => {
    const sectorMap: Record<string, { totalCoins: number, memberCount: number, totalQuizCoins: number }> = {};
    usersList.forEach(u => {
      if (u.isAdmin) return; // Excluir administradores da pontuação de setores
      if (!sectorMap[u.sector]) {
        sectorMap[u.sector] = { totalCoins: 0, memberCount: 0, totalQuizCoins: 0 };
      }
      sectorMap[u.sector].totalCoins += u.coins || 0;
      sectorMap[u.sector].memberCount += 1;

      // Sum quiz coins earned
      let quizSum = 0;
      [1, 2, 3, 4, 5, 6].forEach(metaId => {
        const prog = u.progress[metaId];
        quizSum += prog?.totalCoinsEarned || 0;
      });
      sectorMap[u.sector].totalQuizCoins += quizSum;
    });

    return Object.entries(sectorMap)
      .map(([name, data]) => {
        const maxQuizCoins = data.memberCount * 6 * 150; // Max possible is 900 per member
        const aproveitamento = maxQuizCoins > 0 ? Math.round((data.totalQuizCoins / maxQuizCoins) * 1000) / 10 : 0;
        return { name, ...data, aproveitamento };
      })
      .sort((a, b) => {
        const activeMetric = user.isAdmin ? sectorRankingMetric : 'average';
        if (activeMetric === 'average') {
          return b.aproveitamento - a.aproveitamento;
        }
        return b.totalCoins - a.totalCoins;
      });
  };
  const [quizResult, setQuizResult] = useState<{coins: number, correct: number} | null>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const handleTabChange = (tab: TabContent) => {
    setActiveTab(tab);
    if (tab === 'estudo') {
      setStudyMetaId(null);
    }
    if (tab !== 'desafios' && tab !== 'estudo') {
      setSelectedMeta(null);
      setIsQuizActive(false);
      setQuizResult(null);
    }
  };

  const startQuiz = () => {
    setIsQuizActive(true);
    setQuizResult(null);
  };

  const handleQuizComplete = (coinsEarned: number, correctAnswers: number, newProgress: MetaProgress) => {
    onQuizFinish(newProgress.metaId, coinsEarned, correctAnswers, newProgress);
    setIsQuizActive(false);
    setQuizResult({ coins: coinsEarned, correct: correctAnswers });
  };

  const handleRegisterCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    setNewRegError('');
    setNewRegSuccess('');

    const formattedCpf = newRegCpf.trim();
    const name = newRegName.trim();
    const sector = newRegSector.trim();

    if (!formattedCpf || !name || !sector) {
      setNewRegError('Por favor, preencha todos os campos do formulário.');
      return;
    }

    if (formattedCpf.length < 14) {
      setNewRegError('O CPF digitado está incompleto. Formato esperado: 111.111.111-11');
      return;
    }

    const currentUsers = getStoredUsers();
    if (currentUsers.some(u => u.cpf === formattedCpf)) {
      setNewRegError(`O CPF ${formattedCpf} já está cadastrado para o colaborador ${currentUsers.find(u => u.cpf === formattedCpf)?.name || ''}.`);
      return;
    }

    const newUser: User = {
      cpf: formattedCpf,
      name,
      sector,
      coins: 30,
      stickers: [],
      progress: {}
    };

    const updated = [...currentUsers, newUser];
    saveStoredUsers(updated);
    setUsersList(updated);
    setAdminRefresh(prev => prev + 1);

    setNewRegCpf('');
    setNewRegName('');
    setNewRegSuccess(`Sucesso! ${name} foi cadastrado(a) no setor ${sector} e já pode jogar!`);

    setTimeout(() => {
      setNewRegSuccess('');
    }, 6000);
  };

  const cleanAndFormatCPF = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 11) {
      return raw.trim();
    }
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const handleBulkRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError('');
    setBulkSuccess('');
    setBulkSummary(null);

    const txt = bulkText.trim();
    if (!txt) {
      setBulkError('Por favor, insira ou cole a lista de colaboradores.');
      return;
    }

    const lines = txt.split('\n');
    const currentUsers = getStoredUsers();
    
    const newAddedUsers: User[] = [];
    const duplicates: string[] = [];
    const invalid: string[] = [];
    let successCount = 0;
    const addedCpfInBatch = new Set<string>();

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Try splitting by semicolon, tab, comma, or pipe
      let parts = trimmedLine.split(';');
      if (parts.length < 2) parts = trimmedLine.split('\t');
      if (parts.length < 2) parts = trimmedLine.split(',');
      if (parts.length < 2) parts = trimmedLine.split('|');

      const cleanParts = parts.map(p => p.trim().replace(/^["']|["']$/g, ''));

      if (cleanParts.length < 2) {
        invalid.push(`Linha ${index + 1}: Formato inválido. Use "CPF ; Nome ; Setor".`);
        return;
      }

      const rawCpf = cleanParts[0];
      const name = cleanParts[1];
      const sector = cleanParts[2] || 'Outro Setor';

      if (!rawCpf || !name) {
        invalid.push(`Linha ${index + 1}: CPF ou Nome vazios.`);
        return;
      }

      const formattedCpf = cleanAndFormatCPF(rawCpf);

      if (formattedCpf.length < 14) {
        invalid.push(`Linha ${index + 1} (${name}): CPF "${rawCpf}" é inválido.`);
        return;
      }

      if (currentUsers.some(u => u.cpf === formattedCpf)) {
        duplicates.push(`${name} (${formattedCpf})`);
        return;
      }

      if (addedCpfInBatch.has(formattedCpf)) {
        duplicates.push(`${name} (CPF ${formattedCpf} repetido no texto)`);
        return;
      }

      addedCpfInBatch.add(formattedCpf);
      newAddedUsers.push({
        cpf: formattedCpf,
        name,
        sector,
        coins: 30,
        stickers: [],
        progress: {}
      });
      successCount++;
    });

    if (newAddedUsers.length > 0) {
      const updated = [...currentUsers, ...newAddedUsers];
      saveStoredUsers(updated);
      setUsersList(updated);
      setAdminRefresh(prev => prev + 1);
      setBulkSuccess(`Importação concluída! ${successCount} colaboradores cadastrados com sucesso.`);
      setBulkText('');
    } else {
      setBulkError('Nenhum colaborador novo foi cadastrado. Verifique os erros listados abaixo.');
    }

    setBulkSummary({
      success: successCount,
      duplicates,
      invalid
    });
  };

  const handleRewardUser = (targetCpf: string, amount: number) => {
    const currentUsers = getStoredUsers();
    const updated = currentUsers.map(u => {
      if (u.cpf === targetCpf) {
        return { ...u, coins: (u.coins || 0) + amount };
      }
      return u;
    });
    saveStoredUsers(updated);
    setUsersList(updated);
    
    if (targetCpf === user.cpf && onUpdateUser) {
      onUpdateUser({ ...user, coins: user.coins + amount });
    }
    
    setAdminRefresh(prev => prev + 1);

    // Toast-like notification of reward using success banner for feedback
    setNewRegSuccess(`Sucesso! Foram creditadas +${amount} moedas ao colaborador.`);
    setTimeout(() => setNewRegSuccess(''), 4000);
  };

  const handleDeleteUser = (targetCpf: string) => {
    if (targetCpf === user.cpf) {
      setNewRegError('Você não pode excluir o seu próprio usuário administrador logado!');
      return;
    }
    const currentUsers = getStoredUsers();
    const updated = currentUsers.filter(u => u.cpf !== targetCpf);
    saveStoredUsers(updated);
    setUsersList(updated);
    setConfirmDeleteCpf(null);
    setAdminRefresh(prev => prev + 1);
    
    setNewRegSuccess('Colaborador removido com sucesso de nosso banco de dados hospitalar.');
    setTimeout(() => setNewRegSuccess(''), 4000);
  };

  const allStickersCatalog = useMemo(() => {
    return getAllStickers();
  }, [stickerRefresh]);

  const filteredStickers = useMemo(() => {
    return allStickersCatalog
      .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.id - b.id);
  }, [allStickersCatalog, searchQuery]);

  const groupedStickers = useMemo(() => {
    const groups: { title: string; color: string; bgColor: string; numColor: string; stickers: typeof filteredStickers }[] = [];
    if (searchQuery) {
       groups.push({ title: 'Resultados da Busca', color: 'from-slate-600 to-slate-800', bgColor: 'bg-slate-100 border-slate-200', numColor: 'text-slate-300', stickers: filteredStickers });
       return groups;
    }
    
    const page1 = filteredStickers.filter(s => s.id >= 1 && s.id <= 6);
    if (page1.length) groups.push({ title: 'Trabalho em Equipe', color: 'from-[#009b3a] to-[#007028]', bgColor: 'bg-[#e8f5e9] border-[#c8e6c9]', numColor: 'text-[#c8e6c9]/80', stickers: page1 });
    
    const page2 = filteredStickers.filter(s => s.id >= 7 && s.id <= 12);
    if (page2.length) groups.push({ title: 'Evolução Contínua', color: 'from-[#002776] to-[#001746]', bgColor: 'bg-[#e3f2fd] border-[#bbdefb]', numColor: 'text-[#bbdefb]/80', stickers: page2 });
    
    const especiais = filteredStickers.filter(s => s.id > 12);
    if (especiais.length) groups.push({ title: 'Hall da Fama', color: 'from-[#fedf00] to-[#e6c200]', bgColor: 'bg-[#fffde7] border-[#fff59d]', numColor: 'text-[#fff59d]/80', stickers: especiais });
    
    return groups;
  }, [filteredStickers, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-6 p-4 sm:p-6 lg:p-8">
        
        {/* Sidebar / Header */}
        <div className="w-full lg:w-80 shrink-0 space-y-4 lg:space-y-6">
          
          {/* User Profile Card */}
          <div className={`bg-white p-5 rounded-2xl shadow-sm border flex flex-col gap-4 ${user.isAdmin ? 'border-purple-300 ring-4 ring-purple-100/40 bg-gradient-to-b from-purple-50/20 via-white to-white' : 'border-slate-100'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl shrink-0 border-2 ${user.isAdmin ? 'bg-purple-100 text-purple-700 border-purple-300 shadow-sm' : 'bg-brand-100 text-brand-700 border-brand-200'}`}>
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-sm text-slate-500 font-medium mb-0.5">{getGreeting()},</p>
                  {user.isAdmin && (
                    <span className="bg-purple-600 text-white text-[9px] font-black tracking-wide uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5 scale-90 mb-0.5 select-none">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      ADMIN
                    </span>
                  )}
                </div>
                <h2 className="font-bold text-slate-800 text-xl leading-tight truncate font-[Space_Grotesk] uppercase">{user.name}</h2>
                <div className="flex items-center text-xs sm:text-sm text-slate-500 gap-1.5 mt-1 truncate">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{user.sector}</span>
                </div>


              </div>
            </div>

            <div className="pt-4 border-t border-slate-50 flex items-center justify-between gap-4">
              <div className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold text-sm shadow-sm whitespace-nowrap">
                <Coins className="w-4 h-4 text-amber-500" />
                {user.coins} Moedas
              </div>
              <button
                onClick={onLogout}
                className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl text-sm font-bold transition-colors flex items-center justify-center group gap-2"
                title="Sair"
              >
                <span className="hidden sm:inline lg:hidden group-hover:text-red-600">Sair</span>
                <LogOut className="w-5 h-5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="bg-white p-2 sm:p-3 lg:p-4 rounded-t-3xl sm:rounded-2xl shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)] sm:shadow-sm border-t sm:border border-slate-100 flex lg:flex-col gap-1 sm:gap-2 fixed sm:static bottom-0 left-0 right-0 z-50 justify-around lg:justify-start px-2 sm:px-3 lg:px-4 pb-6 sm:pb-3 lg:pb-4">
            <button 
              onClick={() => handleTabChange('inicio')}
              className={`group flex-[0.8] lg:w-full min-w-[60px] sm:min-w-0 rounded-xl py-2 sm:py-3 px-1 sm:px-4 font-bold flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-1 sm:gap-3 transition-all ${activeTab === 'inicio' ? 'bg-brand-600 text-white shadow-md scale-[1.03] sm:scale-100' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Home className={`w-5 h-5 sm:w-5 sm:h-5 ${activeTab === 'inicio' ? 'text-brand-200' : 'text-slate-400 group-hover:text-brand-500'}`} />
              <span className="text-[10px] sm:text-base leading-none">Início</span>
            </button>
            <button 
              onClick={() => handleTabChange('desafios')}
              className={`group flex-[0.8] lg:w-full min-w-[60px] sm:min-w-0 rounded-xl py-2 sm:py-3 px-1 sm:px-4 font-bold flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-1 sm:gap-3 transition-all ${activeTab === 'desafios' ? 'bg-brand-600 text-white shadow-md scale-[1.03] sm:scale-100' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Trophy className={`w-5 h-5 sm:w-5 sm:h-5 ${activeTab === 'desafios' ? 'text-brand-200' : 'text-slate-400 group-hover:text-brand-500'}`} />
              <span className="text-[10px] sm:text-base leading-none">Desafios</span>
            </button>
            <button 
              onClick={() => handleTabChange('estudo')}
              className={`group flex-[0.8] lg:w-full min-w-[60px] sm:min-w-0 rounded-xl py-2 sm:py-3 px-1 sm:px-4 font-bold flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-1 sm:gap-3 transition-all ${activeTab === 'estudo' ? 'bg-brand-600 text-white shadow-md scale-[1.03] sm:scale-100' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <BookOpen className={`w-5 h-5 sm:w-5 sm:h-5 ${activeTab === 'estudo' ? 'text-brand-200' : 'text-slate-400 group-hover:text-brand-500'}`} />
              <span className="text-[10px] sm:text-base leading-none">Apostila</span>
            </button>
            <button 
              onClick={() => handleTabChange('album')}
              className={`group flex-[0.8] lg:w-full min-w-[60px] sm:min-w-0 rounded-xl py-2 sm:py-3 px-1 sm:px-4 font-bold flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-1 sm:gap-3 transition-all ${activeTab === 'album' ? 'bg-brand-600 text-white shadow-md scale-[1.03] sm:scale-100' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutGrid className={`w-5 h-5 sm:w-5 sm:h-5 ${activeTab === 'album' ? 'text-brand-200' : 'text-slate-400 group-hover:text-brand-500'}`} />
              <span className="text-[10px] sm:text-base leading-none">Álbum</span>
            </button>
            <button 
              onClick={() => handleTabChange('loja')}
              className={`group flex-[0.8] lg:w-full min-w-[60px] sm:min-w-0 rounded-xl py-2 sm:py-3 px-1 sm:px-4 font-bold flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-1 sm:gap-3 transition-all ${activeTab === 'loja' ? 'bg-amber-500 text-white shadow-md scale-[1.03] sm:scale-100' : 'text-slate-500 hover:bg-amber-50'}`}
            >
              <ShoppingBag className={`w-5 h-5 sm:w-5 sm:h-5 ${activeTab === 'loja' ? 'text-amber-200' : 'text-slate-400 group-hover:text-amber-500'}`} />
              <span className="text-[10px] sm:text-base leading-none">Loja</span>
            </button>
            <button 
              onClick={() => handleTabChange('trocas')}
              className={`group flex-[0.8] lg:w-full min-w-[60px] sm:min-w-0 rounded-xl py-2 sm:py-3 px-1 sm:px-4 font-bold flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-1 sm:gap-3 transition-all ${activeTab === 'trocas' ? 'bg-indigo-500 text-white shadow-md scale-[1.03] sm:scale-100' : 'text-slate-500 hover:bg-indigo-50'}`}
            >
              <ArrowRightLeft className={`w-5 h-5 sm:w-5 sm:h-5 ${activeTab === 'trocas' ? 'text-indigo-200' : 'text-slate-400 group-hover:text-indigo-500'}`} />
              <span className="text-[10px] sm:text-base leading-none">Trocas</span>
            </button>
            <button 
              onClick={() => handleTabChange('ranking')}
              className={`group flex-[0.8] lg:w-full min-w-[60px] sm:min-w-0 rounded-xl py-2 sm:py-3 px-1 sm:px-4 font-bold flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-1 sm:gap-3 transition-all ${activeTab === 'ranking' ? 'bg-brand-600 text-white shadow-md scale-[1.03] sm:scale-100' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Crown className={`w-5 h-5 sm:w-5 sm:h-5 ${activeTab === 'ranking' ? 'text-brand-200' : 'text-slate-400 group-hover:text-amber-500'}`} />
              <span className="text-[10px] sm:text-base leading-none">Ranking</span>
            </button>
            <button 
              onClick={() => handleTabChange('perfil')}
              className={`group flex-[0.8] lg:w-full min-w-[60px] sm:min-w-0 rounded-xl py-2 sm:py-3 px-1 sm:px-4 font-bold flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-1 sm:gap-3 transition-all ${activeTab === 'perfil' ? 'bg-brand-600 text-white shadow-md scale-[1.03] sm:scale-100' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <UserIcon className={`w-5 h-5 sm:w-5 sm:h-5 ${activeTab === 'perfil' ? 'text-brand-200' : 'text-slate-400 group-hover:text-brand-500'}`} />
              <span className="text-[10px] sm:text-base leading-none">Perfil</span>
            </button>
            {user.isAdmin && (
              <button 
                onClick={() => handleTabChange('admin')}
                className={`group flex-[0.8] lg:w-full min-w-[60px] sm:min-w-0 rounded-xl py-2 sm:py-3 px-1 sm:px-4 font-bold flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-1 sm:gap-3 transition-all ${activeTab === 'admin' ? 'bg-purple-600 text-white shadow-md scale-[1.03] sm:scale-100 animate-pulse' : 'text-purple-600 hover:bg-purple-50'}`}
              >
                <ShieldCheck className={`w-5 h-5 sm:w-5 sm:h-5 ${activeTab === 'admin' ? 'text-purple-200' : 'text-purple-500 group-hover:text-purple-600'}`} />
                <span className="text-[10px] sm:text-base leading-none text-purple-700 font-extrabold group-hover:text-purple-800">Gestão</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 pb-20 sm:pb-0">
          <AnimatePresence mode="wait">
          {activeTab === 'estudo' && (
            <motion.div
              key="estudo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <StudyMaterial 
                onClose={() => {
                  if (selectedMeta !== null) {
                    setActiveTab('desafios');
                  } else {
                    setActiveTab('inicio');
                  }
                }}
                initialMetaId={studyMetaId}
              />
            </motion.div>
          )}

          {activeTab === 'inicio' && (
            <motion.div
              key="inicio"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <WelcomeScreen user={user} onNavigate={handleTabChange} />
            </motion.div>
          )}

          {activeTab === 'desafios' && (
            <motion.div 
              key="desafios"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {selectedMeta === null ? (
                <>
                  <div className="bg-brand-600 rounded-2xl p-8 text-white shadow-lg overflow-hidden relative">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-brand-500 blur-3xl opacity-50 pointer-events-none" />
                    
                    <h1 className="text-3xl font-bold mb-2 relative z-10 font-[Space_Grotesk]">Escolha um Desafio</h1>
                    <p className="text-brand-50 relative z-10 max-w-lg">
                      Complete os questionários de cada uma das 6 Metas Internacionais de Segurança do Paciente para testar seus conhecimentos e ganhar moedas da Copa!
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {METAS.map((meta) => {
                      const prog = user.progress[meta.id];
                      const totalCoins = prog?.totalCoinsEarned || 0;
                      const isTreinoLivre = totalCoins >= 150;
                      const isReleased = releasedMetas.includes(meta.id);
                      const canPlay = isReleased || user.isAdmin;

                      return (
                      <button
                        key={meta.id}
                        disabled={!canPlay}
                        onClick={() => setSelectedMeta(meta.id)}
                        className={`group bg-white rounded-2xl p-4 md:p-5 shadow-sm border transition-all flex items-center gap-5 text-left relative overflow-hidden ${
                          !canPlay 
                            ? 'bg-slate-50 border-slate-200/60 opacity-60 cursor-not-allowed' 
                            : 'bg-white border-slate-100 hover:border-brand-300 hover:shadow-md cursor-pointer'
                        }`}
                      >
                        <div className={`shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-white ${meta.color} shadow-sm ${canPlay ? 'group-hover:scale-110' : ''} transition-transform relative`}>
                          {meta.icon}
                          {!isReleased && (
                            <div className="absolute -top-1 -right-1 bg-red-600 border border-white text-white rounded-full p-0.5 shadow-sm">
                              <Lock className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 text-lg mb-0.5 font-[Space_Grotesk] truncate">{meta.title}</h3>
                            {!isReleased && (
                              <span className="bg-red-50 text-red-600 border border-red-100 text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none uppercase shrink-0">
                                Bloqueada
                              </span>
                            )}
                            {!isReleased && user.isAdmin && (
                              <span className="bg-purple-100 text-purple-700 text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none uppercase shrink-0">
                                Admin Bypass
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 text-sm truncate">{meta.desc}</p>
                        </div>
                        
                        <div className="shrink-0 flex items-center gap-4">
                          {!isReleased ? (
                            <span className="flex items-center gap-1.5 text-red-600 font-bold text-xs bg-red-50/50 px-2.5 py-1.5 rounded-lg border border-red-100">
                              <Lock className="w-3.5 h-3.5 text-red-500" />
                              Aguardando Liberação
                            </span>
                          ) : isTreinoLivre ? (
                            <span className="flex items-center gap-1.5 text-slate-500 font-bold text-sm bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                              Treino
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-amber-600 font-bold text-sm bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                              Top {totalCoins}/150 <Coins className="w-4 h-4" />
                            </span>
                          )}
                          {canPlay && (
                            <span className="hidden md:flex bg-slate-50 text-brand-600 font-bold text-sm items-center justify-center w-10 h-10 rounded-full group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
                              <PlayCircle className="w-6 h-6" />
                            </span>
                          )}
                        </div>
                      </button>
                    )})}
                  </div>
                </>
              ) : isQuizActive ? (
                (() => {
                  const meta = METAS.find(m => m.id === selectedMeta);
                  if (!meta) return null;
                  return (
                    <Quiz 
                      metaId={meta.id}
                      metaTitle={meta.title}
                      metaColor={meta.color}
                      progress={user.progress[meta.id]}
                      onComplete={handleQuizComplete}
                      onAbort={() => {
                        setIsQuizActive(false);
                      }}
                    />
                  );
                })()
              ) : (
                (() => {
                  const meta = METAS.find(m => m.id === selectedMeta);
                  if (!meta) return null;
                  const prog = user.progress[meta.id];
                  const today = new Date().toISOString().split('T')[0];
                  
                  const isTreinoLivre = prog?.totalCoinsEarned && prog.totalCoinsEarned >= 150;
                  const isAmador = prog?.isAmador || (prog?.totalCoinsEarned && prog.totalCoinsEarned > 0 && prog.lastPlayedDate !== today);
                  let attemptsToday = prog?.lastPlayedDate === today ? (prog.attemptsToday || 0) : 0;
                  const hasAttemptsRemaining = attemptsToday < 3;
                  
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6"
                    >
                      <button 
                        onClick={() => { setSelectedMeta(null); setQuizResult(null); }}
                        className="flex items-center gap-2 text-slate-500 hover:text-brand-600 font-bold transition-colors mb-2"
                      >
                        <ArrowLeft className="w-5 h-5" />
                        Voltar para Desafios
                      </button>

                      {quizResult && (
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                          <div>
                            <h3 className="text-xl font-bold text-green-800 mb-1">Partida Finalizada!</h3>
                            <p className="text-green-700 font-medium">Você acertou {quizResult.correct} de 5 perguntas.</p>
                          </div>
                          <div className="bg-white rounded-xl px-6 py-4 shadow-sm border border-green-100 text-center">
                            <span className="block text-sm text-slate-500 font-bold mb-1 uppercase tracking-wider">Moedas Ganhas</span>
                            <span className="text-3xl font-bold text-amber-500 flex items-center justify-center gap-2">
                              +{quizResult.coins} <Coins className="w-6 h-6" />
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="bg-white rounded-2xl p-5 sm:p-8 shadow-sm border border-slate-100 relative overflow-hidden">
                        {/* Decorative background slightly tinted with meta's color */}
                        <div className={`absolute top-0 right-0 w-full h-full opacity-5 pointer-events-none ${meta.color}`} />
                        
                        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 relative z-10 items-start">
                          <div className={`shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white ${meta.color} shadow-lg`}>
                            {React.cloneElement(meta.icon, { className: "w-8 h-8 sm:w-10 sm:h-10" })}
                          </div>
                          
                          <div className="w-full">
                            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2 font-[Space_Grotesk]">{meta.title}</h2>
                            <h3 className="text-lg sm:text-xl font-medium text-slate-600 mb-4">{meta.desc}</h3>
                            
                            <div className="bg-slate-50 rounded-xl p-5 sm:p-6 border border-slate-100 mb-6 sm:mb-8 inline-block w-full">
                              <p className="text-slate-700 leading-relaxed sm:font-medium text-sm sm:text-base">
                                {meta.fullDesc}
                              </p>
                            </div>

                            {/* Informações de Regras */}
                            <div className="flex flex-col gap-3 mb-6">
                              {isTreinoLivre ? (
                                <div className="bg-slate-100 text-slate-700 rounded-lg p-3 text-sm font-medium flex items-center gap-2">
                                  <CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0" />
                                  Você já alcançou o teto de 150 moedas nesta meta! O modo Treino Livre gera conhecimento, mas não gera novas moedas.
                                </div>
                              ) : isAmador ? (
                                <div className="bg-blue-50 text-blue-800 rounded-lg p-3 text-sm font-medium flex items-center gap-2">
                                  <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                                  Recompensa de Amador: Você já completou rodadas desta meta em dias anteriores. Cada acerto hoje pagará 2 moedas (sem bônus multiplicador).
                                </div>
                              ) : (
                                <div className="bg-amber-50 text-amber-800 rounded-lg p-3 text-sm font-medium flex items-center gap-2">
                                  <Zap className="w-5 h-5 text-amber-500 shrink-0" />
                                  {attemptsToday === 0 
                                    ? 'Modo Chute de Primeira Ativo: Bônus máximo liberado! Faça de primeira para multiplicar suas moedas.'
                                    : `Você tem ${3 - attemptsToday} chance(s) restante(s) hoje para melhorar seu saldo nesta meta.`}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 relative z-10">
                          <button 
                            onClick={() => {
                              setStudyMetaId(meta.id);
                              setActiveTab('estudo');
                            }}
                            className="bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 py-4 px-4 sm:px-6 rounded-xl font-bold flex flex-col sm:flex-row items-center justify-center gap-3 transition-colors shadow-sm text-center"
                          >
                            <BookOpen className="w-6 h-6 text-brand-500 shrink-0" />
                            Material de Estudo
                          </button>
                          
                          <button 
                            disabled={!hasAttemptsRemaining && !isTreinoLivre}
                            onClick={startQuiz}
                            className={`py-4 px-4 sm:px-6 rounded-xl font-bold flex flex-col sm:flex-row items-center justify-center gap-3 transition-colors shadow-sm text-center border-2 ${
                              (!hasAttemptsRemaining && !isTreinoLivre) ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white border-brand-600'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <PlayCircle className="w-6 h-6 shrink-0" />
                              {(!hasAttemptsRemaining && !isTreinoLivre) ? 'Tentativas Esgotadas Hoje' : isTreinoLivre ? 'Modo Treino Livre' : 'Iniciar Quiz (20s p/ questão)'}
                            </div>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()
              )}
            </motion.div>
          )}

          {activeTab === 'loja' && (
            <motion.div
              key="loja"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Store coins={user.coins} onBuyPack={onBuyPack} />
            </motion.div>
          )}

          {activeTab === 'album' && (
            <motion.div
               key="album"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="bg-[#fdfcf8] rounded-r-3xl rounded-l-md p-6 sm:p-8 shadow-[inset_10px_0_20px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.08)] border-y-[6px] border-r-[6px] border-l-[20px] border-slate-200 flex flex-col min-h-[600px] relative overflow-hidden"
            >
              <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-slate-300/30 to-transparent pointer-events-none z-10" />
              
              <div className="text-center mb-8 relative z-20">
                <LayoutGrid className="w-16 h-16 text-brand-300 mx-auto mb-4 drop-shadow-sm" />
                <h2 className="text-3xl font-bold text-slate-800 mb-2 font-[Space_Grotesk]">Álbum de Figurinhas</h2>
                <div className="inline-flex items-center gap-2 bg-white px-5 py-2.5 rounded-full shadow-sm border border-slate-200 mt-2">
                  <span className="text-brand-600 font-bold text-lg">{user.stickers.length} / {allStickersCatalog.length}</span>
                  <span className="text-slate-500 text-sm font-medium">figurinhas coladas</span>
                </div>
              </div>

              <div className="relative max-w-md mx-auto w-full mb-10 z-20">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar figurinhas por nome..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3.5 border-slate-200 rounded-2xl bg-white text-slate-900 border focus:ring-2 focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-all shadow-sm"
                />
              </div>
              
              <div className="flex flex-col gap-12 z-20 relative w-full">
                {groupedStickers.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-slate-500 font-medium">Nenhuma figurinha encontrada para "{searchQuery}".</p>
                  </div>
                ) : (
                  groupedStickers.map((group, groupIdx) => (
                    <div key={groupIdx} className="bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200">
                      {/* Page Header */}
                      <div className={`bg-gradient-to-r ${group.color} px-6 sm:px-8 py-5 flex justify-between items-center text-white relative overflow-hidden border-b-4 border-black/10`}>
                        <div className="absolute inset-0 bg-white/5 mix-blend-overlay"></div>
                        <h3 className="text-2xl sm:text-3xl font-black font-[Space_Grotesk] tracking-wider uppercase drop-shadow-md relative z-10">{group.title}</h3>
                        <div className="bg-white/20 px-4 py-1.5 rounded-full text-base font-bold backdrop-blur-md shadow-inner hidden sm:block relative z-10 border border-white/30">
                           {group.stickers.filter(s => user.stickers.includes(s.id)).length} / {group.stickers.length}
                        </div>
                      </div>
                      
                      {/* Page Grid */}
                      <div className="p-6 sm:p-10 bg-[#fdfcf8] relative">
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 100% 100%, #000 1px, transparent 1px), radial-gradient(circle at 0 0, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-8 lg:gap-10 justify-items-center relative z-10">
                          {group.stickers.map((sticker, i) => {
                            const hasSticker = user.stickers.includes(sticker.id);
                            if (hasSticker) {
                              return (
                                <div key={`${sticker.id}-${i}`} className={`w-full aspect-[2.5/3.5] max-w-[140px] rounded-xl flex flex-col items-center justify-center p-1.5 text-center border-[5px] shadow-sm relative overflow-hidden group transition-all hover:scale-105 hover:shadow-xl hover:z-10 focus:z-10 ${sticker.rarity === 'suprema' ? 'bg-yellow-400 border-yellow-300 text-yellow-950' : sticker.rarity === 'lendaria' ? 'bg-fuchsia-600 border-fuchsia-400 text-white' : sticker.rarity === 'holografica' ? 'bg-cyan-400 border-cyan-300 text-cyan-950' : 'bg-white border-slate-100 text-slate-800'}`}>
                                  {sticker.rarity !== 'regular' && (
                                    <div className="absolute top-0 bottom-0 left-0 w-[200%] bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-[60%] group-hover:animate-shimmer pointer-events-none" />
                                  )}
                                  {sticker.image ? (
                                    <img src={sticker.image} alt={sticker.name} className="flex-1 w-full min-h-0 object-contain drop-shadow-md mb-2 pointer-events-none mt-1" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="flex-1 flex items-center justify-center text-4xl font-bold opacity-30 mb-2">#{sticker.id}</div>
                                  )}
                                  <div className="mt-auto bg-slate-100/80 w-[#110%] -mx-[5%] py-1.5 relative left-1/2 -translate-x-1/2">
                                     <span className="font-bold text-[8px] uppercase tracking-widest opacity-90 block leading-tight text-slate-800 mb-0.5">{sticker.rarity}</span>
                                     <h4 className="font-bold text-[10px] leading-tight font-[Space_Grotesk] line-clamp-2 text-slate-800 px-2">{sticker.name}</h4>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div 
                                  key={`${sticker.id}-${i}`} 
                                  onClick={() => setBuyingStickerDirectly(sticker)}
                                  className={`w-full aspect-[2.5/3.5] max-w-[140px] flex flex-col items-center justify-center p-1 text-center relative overflow-hidden group border-2 ${group.bgColor} cursor-pointer hover:border-brand-500 hover:scale-[1.03] transition-all hover:shadow-md`}
                                  title="Clique para obter esta figurinha directamente por moedas"
                                >
                                  <div className="absolute inset-x-0 inset-y-0 bg-white/20"></div>
                                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                                       <span className={`text-[80px] xs:text-[100px] leading-none font-black font-[Space_Grotesk] tracking-tight group-hover:scale-110 transition-transform select-none ${group.numColor}`}>{sticker.id}</span>
                                  </div>
                                  <div className="mt-auto mb-2 relative z-10 w-full px-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                                       <div className="bg-white/95 py-1.5 rounded-sm backdrop-blur-xs shadow-sm flex flex-col items-center gap-0.5">
                                         <span className="font-bold text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-700 line-clamp-1 truncate block px-1">{sticker.name}</span>
                                         <span className="text-[8px] font-extrabold text-amber-600 bg-amber-50 px-1 py-0.5 rounded flex items-center gap-0.5">
                                           {getDirectStickerPrice(sticker.rarity)} <Coins className="w-2.5 h-2.5 text-amber-500" />
                                         </span>
                                       </div>
                                  </div>
                                </div>
                              );
                            }
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Direct Purchase Modal */}
              <AnimatePresence>
                {buyingStickerDirectly && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0.95, y: 15 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.95, y: 15 }}
                      className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-sm w-full relative overflow-hidden flex flex-col items-center"
                    >
                      <button
                        type="button"
                        onClick={() => setBuyingStickerDirectly(null)}
                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                      >
                        ✕
                      </button>

                      <div className="mb-4 inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-500">
                        <Coins className="w-8 h-8 animate-bounce" />
                      </div>

                      <h3 className="text-lg font-extrabold text-slate-800 font-[Space_Grotesk] mb-2">
                        Adquirir Cromo Direto
                      </h3>

                      <p className="text-slate-500 text-xs mb-4">
                        Deseja gastar suas moedas para colar a figurinha <span className="font-bold text-slate-800">#{buyingStickerDirectly.id} - "{buyingStickerDirectly.name}"</span> diretamente em seu Álbum sem precisar de sorte?
                      </p>

                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 w-full">
                        <div className="flex justify-between text-xs text-slate-500 font-bold uppercase mb-2">
                          <span>Seu Saldo:</span>
                          <span className="text-slate-800 flex items-center gap-1">
                            {user.coins} <Coins className="w-3.5 h-3.5 text-amber-500" />
                          </span>
                        </div>
                        <div className="flex justify-between text-xs font-bold uppercase border-t border-slate-200/60 pt-2">
                          <span className="text-brand-700">Preço do Cromo ({buyingStickerDirectly.rarity}):</span>
                          <span className="text-amber-600 flex items-center gap-1 text-sm font-black">
                            {getDirectStickerPrice(buyingStickerDirectly.rarity)} <Coins className="w-4 h-4 text-amber-500" />
                          </span>
                        </div>
                      </div>

                      {directBuyError && (
                        <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-xl w-full">
                          {directBuyError}
                        </div>
                      )}

                      {directBuySuccess && (
                        <div className="mb-4 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl w-full">
                          {directBuySuccess}
                        </div>
                      )}

                      <div className="flex gap-3 w-full">
                        <button
                          type="button"
                          onClick={() => setBuyingStickerDirectly(null)}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-3 px-4 rounded-xl transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmDirectBuySticker}
                          disabled={user.coins < getDirectStickerPrice(buyingStickerDirectly.rarity)}
                          className={`flex-1 text-white text-xs font-bold py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${user.coins >= getDirectStickerPrice(buyingStickerDirectly.rarity) ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-300 cursor-not-allowed opacity-85'}`}
                        >
                          Confirmar e Colar
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'trocas' && (
            <motion.div
               key="trocas"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
            >
              <Trading user={user} onTradeComplete={onTradeComplete} />
            </motion.div>
          )}

          {activeTab === 'ranking' && (
            <motion.div
              key="ranking"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[400px]"
            >
              <div className="bg-brand-600 p-6 md:p-8 text-white relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-brand-500 blur-3xl opacity-50 pointer-events-none" />
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 relative z-10 font-[Space_Grotesk] flex items-center gap-3">
                  <Crown className="w-8 h-8 text-amber-300" />
                  Ranking HUSF
                </h1>
                <p className="text-brand-50 relative z-10">Confira a classificação dos colaboradores e setores do hospital.</p>
              </div>

              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => setRankingTab('individual')}
                  className={`flex-1 py-4 font-bold text-sm sm:text-base border-b-2 transition-colors ${rankingTab === 'individual' ? 'border-brand-600 text-brand-700 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                  Ranking Individual
                </button>
                <button
                  onClick={() => setRankingTab('setores')}
                  className={`flex-1 py-4 font-bold text-sm sm:text-base border-b-2 transition-colors ${rankingTab === 'setores' ? 'border-brand-600 text-brand-700 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                  Ranking de Setores
                </button>
              </div>
              
              <div className="p-4 md:p-6 flex-1 overflow-y-auto">
                {rankingTab === 'individual' ? (
                  <div className="flex flex-col gap-3">
                    {[...usersList].filter(u => !u.isAdmin).sort((a, b) => b.coins - a.coins).map((rankedUser, index) => (
                      <div key={rankedUser.cpf} className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border ${index === 0 ? 'bg-amber-50 border-amber-200' : index === 1 ? 'bg-slate-50 border-slate-200' : index === 2 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'}`}>
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center font-bold text-sm sm:text-lg rounded-full shrink-0 ${index === 0 ? 'bg-amber-400 text-white shadow-md' : index === 1 ? 'bg-slate-300 text-slate-700 shadow-sm' : index === 2 ? 'bg-orange-300 text-orange-800 shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                          {index + 1}
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-lg shrink-0 border border-brand-200">
                          {rankedUser.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-800 truncate text-sm sm:text-base">{rankedUser.name}</h3>
                          <p className="text-xs sm:text-sm text-slate-500 truncate">{rankedUser.sector}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5 font-bold text-amber-600 bg-amber-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-amber-100 text-sm sm:text-base">
                          {rankedUser.coins} <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Metric selector toggle - Only visible to admin */}
                    {user.isAdmin && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-3 sm:px-4 sm:py-3 rounded-xl border border-slate-200/60 mb-1">
                        <div>
                          <span className="text-xs sm:text-sm font-bold text-slate-700 block">
                            Opções de Administrador (Critério de Classificação)
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            Selecione como quer analisar: por média de aproveitamento ou moedas totais na carteira.
                          </span>
                        </div>
                        <div className="flex bg-slate-200/60 p-1 rounded-lg self-start sm:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => setSectorRankingMetric('average')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sectorRankingMetric === 'average' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            Aproveitamento % (Mais Justo)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSectorRankingMetric('total')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sectorRankingMetric === 'total' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            Moedas na Carteira
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                      {computeSectorRanking().map((sector, index) => {
                        const showTotalWalletCoins = user.isAdmin && sectorRankingMetric === 'total';
                        return (
                          <div key={sector.name} className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border ${index === 0 ? 'bg-amber-50/70 border-amber-200' : index === 1 ? 'bg-slate-50/70 border-slate-200' : index === 2 ? 'bg-orange-50/70 border-orange-200' : 'bg-white border-slate-100'}`}>
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center font-bold text-sm sm:text-lg rounded-full shrink-0 ${index === 0 ? 'bg-amber-400 text-white shadow-md' : index === 1 ? 'bg-slate-300 text-slate-700 shadow-sm' : index === 2 ? 'bg-orange-300 text-orange-850 shadow-sm' : 'bg-slate-105 text-slate-500 border border-slate-200 bg-slate-50'}`}>
                              {index + 1}
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-50 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg shrink-0 border border-indigo-100">
                              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-slate-800 truncate text-sm sm:text-base">{sector.name}</h3>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                                <span><strong>{sector.memberCount}</strong> {sector.memberCount === 1 ? 'membro' : 'membros'}</span>
                                <span className="text-slate-300">•</span>
                                <span className={!showTotalWalletCoins ? 'text-brand-750 font-bold' : ''}>
                                  Aproveitamento: <strong>{sector.aproveitamento}%</strong>
                                </span>
                                {user.isAdmin && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span>Pontos Quizzes: <strong>{sector.totalQuizCoins}</strong></span>
                                    <span className="text-slate-300">•</span>
                                    <span className={showTotalWalletCoins ? 'text-brand-750 font-bold' : ''}>
                                      Na Carteira: <strong>{sector.totalCoins}</strong> moedas
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-1 font-bold text-amber-605 bg-amber-50/80 px-2 sm:px-3 py-1 rounded-lg border border-amber-200/60 text-sm sm:text-base">
                                {showTotalWalletCoins ? (
                                  <>
                                    {sector.totalCoins} <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                                  </>
                                ) : (
                                  <>
                                    {sector.aproveitamento}%
                                  </>
                                )}
                              </div>
                              <span className="text-[9px] text-slate-400 font-extrabold tracking-wider uppercase">
                                {showTotalWalletCoins ? 'Carteira' : 'Aproveitamento'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'perfil' && (
            <motion.div
              key="perfil"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="bg-brand-600 p-8 text-white relative overflow-hidden flex flex-col items-center border-b border-brand-500 text-center">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-brand-500 blur-3xl opacity-50 pointer-events-none" />
                
                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-4xl sm:text-5xl border-4 border-white shadow-lg mb-4 relative z-10">
                  {user.name.charAt(0)}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold font-[Space_Grotesk] uppercase relative z-10">{user.name}</h2>
                <p className="text-brand-100 font-medium relative z-10 mt-1">{user.sector}</p>
                <p className="text-sm text-brand-200 mt-1 mb-4 relative z-10 bg-brand-700/50 px-3 py-1 rounded-full">CPF: {user.cpf}</p>
              </div>
              
              <div className="p-6 md:p-8 grid sm:grid-cols-2 gap-4">
                <div className="bg-amber-50 rounded-xl p-6 border border-amber-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                    <Coins className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Moedas Copas</p>
                    <p className="text-3xl font-bold text-slate-800">{user.coins}</p>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                    <LayoutGrid className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Figurinhas Obtidas</p>
                    <p className="text-3xl font-bold text-slate-800">{user.stickers.length}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'admin' && user.isAdmin && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Header Box */}
              <div className="bg-gradient-to-r from-purple-700 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-purple-500 blur-3xl opacity-30 pointer-events-none" />
                <div className="relative z-10">
                  <span className="bg-purple-900/50 backdrop-blur-md text-purple-200 border border-purple-500/30 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2.5 inline-flex items-center gap-1.5 leading-none">
                    <ShieldCheck className="w-4 h-4 text-purple-300" />
                    Ambiente de Controle
                  </span>
                  <h1 className="text-3xl font-black font-[Space_Grotesk] tracking-tight mb-2">Painel de Gestão da Qualidade HUSF</h1>
                  <p className="text-purple-100 max-w-2xl leading-relaxed text-sm">
                    Espaço administrative exclusivo para auditorias e testes de usabilidade. Gerencie moedas dos colaboradores, libere figurinhas para homologação rápida e visualize relatórios de desempenho operacional por metas.
                  </p>
                </div>
              </div>

              {/* Alerta Educacional de Sincronização */}
              {!isSupabaseConfigured ? (
                <div className="bg-amber-50/80 border-2 border-dashed border-amber-300 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row gap-4 items-start relative overflow-hidden">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
                    <WifiOff className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-900 text-sm sm:text-base font-[Space_Grotesk]">Aviso de Sincronização: Rodando em Modo Local (Offline)</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Atualmente o aplicativo está rodando em <strong>Modo Local (Offline)</strong> porque o banco de dados em nuvem Supabase não foi configurado. 
                      Isso causa a <strong>divergência</strong> que você notou: os colaboradores cadastrados por você neste navegador <strong>ficam guardados apenas no cache deste PC</strong> e por isso não aparecem quando você abre o link no celular!
                    </p>
                    <div className="mt-3 bg-white p-3 rounded-lg border border-amber-200 text-[11px] text-slate-500 font-semibold space-y-1">
                      <p className="text-amber-850 font-bold">Como resolver e habilitar a sincronização automática em tempo real:</p>
                      <ol className="list-decimal pl-4 space-y-0.5">
                        <li>Abra a aba <strong>Settings (Configurações)</strong> na barra lateral esquerda da sua plataforma AI Studio.</li>
                        <li>Clique na seção de <strong>Secrets (Segredos)</strong>.</li>
                        <li>Adicione as duas variáveis: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-700">VITE_SUPABASE_URL</code> e <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-700">VITE_SUPABASE_ANON_KEY</code> com as credenciais do seu projeto Supabase.</li>
                        <li>Com as variáveis salvas, todo cadastro feito no PC aparecerá instantaneamente no Celular!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              ) : lastSupabaseError ? (
                <div className="bg-rose-50 border-2 border-dashed border-rose-300 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row gap-4 items-start relative overflow-hidden">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 shadow-sm">
                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-rose-900 text-sm sm:text-base font-[Space_Grotesk]">Erro de Conexão com o Supabase</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Suas credenciais do Supabase foram inseridas corretamente em <strong>Secrets</strong>, mas o banco de dados retornou o seguinte erro:
                    </p>
                    <div className="mt-2 bg-rose-100/50 p-3 rounded-lg border border-rose-200 text-[11px] font-mono text-rose-800 leading-snug">
                      {lastSupabaseError}
                    </div>
                    {lastSupabaseError.toLowerCase().includes('relation') || lastSupabaseError.toLowerCase().includes('does not exist') ? (
                      <div className="mt-3 bg-white p-3 rounded-lg border border-slate-200 text-[11px] text-slate-500 font-medium space-y-1">
                        <p className="text-rose-950 font-bold">Causa provável: As tabelas não existem.</p>
                        <p className="leading-relaxed">
                          Você precisa criar as tabelas do banco de dados no painel do Supabase. Copie o script SQL disponível em <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-700">src/lib/supabase.ts</code> (no topo do arquivo) e cole-o no menu <strong>SQL Editor</strong> do seu painel do Supabase, depois clique em <strong>Run</strong>.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 bg-white p-3 rounded-lg border border-slate-200 text-[11px] text-slate-500 font-medium space-y-1">
                        <p className="text-slate-855 font-bold">Como resolver:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li>Verifique se as variáveis de URL e chave do Anon estão corretas e sem espaços extras.</li>
                          <li>Certifique-se de que reiniciou o Dev Server do AI Studio para registrar as novas chaves.</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Stats row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-1">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-xs font-bold uppercase tracking-wide">Colaboradores</span>
                    <UserCheck className="w-5 h-5 text-indigo-500" />
                  </div>
                  <p className="text-2xl font-black text-slate-800 font-[Space_Grotesk]">{usersList.length}</p>
                  <p className="text-[10px] text-indigo-500 font-semibold">Base ativa carregada</p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-1">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-xs font-bold uppercase tracking-wide">Moedas Totais</span>
                    <Coins className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-2xl font-black text-slate-800 font-[Space_Grotesk]">
                    {usersList.reduce((acc, u) => acc + u.coins, 0) + (user.cpf !== '136.832.356-16' ? user.coins : 0)}
                  </p>
                  <p className="text-[10px] text-amber-500 font-semibold">Moedas na economia</p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-1">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-xs font-bold uppercase tracking-wide">Setores Ativos</span>
                    <Building2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-black text-slate-800 font-[Space_Grotesk]">
                    {new Set(usersList.map(u => u.sector)).size}
                  </p>
                  <p className="text-[10px] text-emerald-500 font-semibold">Departamentos monitorados</p>
                </div>

                <div className={`p-5 rounded-2xl shadow-sm border space-y-1 ${isSupabaseConfigured ? 'bg-emerald-50/25 border-emerald-100' : 'bg-amber-50/20 border-amber-100'}`}>
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-xs font-bold uppercase tracking-wide">Banco de Dados</span>
                    {isSupabaseConfigured ? (
                      <Wifi className="w-4.5 h-4.5 text-emerald-500" />
                    ) : (
                      <WifiOff className="w-4.5 h-4.5 text-amber-500" />
                    )}
                  </div>
                  <p className={`text-2xl font-black font-[Space_Grotesk] ${isSupabaseConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {isSupabaseConfigured ? 'Nuvem Sync' : 'Offline'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {isSupabaseConfigured ? 'Dados em tempo real' : 'Local (este navegador)'}
                  </p>
                </div>
              </div>

              {/* Audit Tools & Simulation */}
              <div className="grid md:grid-cols-5 gap-6">
                
                {/* Registrador de Colaboradores (Individual ou em Massa) */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 md:col-span-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                      <h3 className="font-bold text-slate-800 text-lg font-[Space_Grotesk] flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-purple-600" />
                        Cadastrar Colaborador do Hospital
                      </h3>
                      <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-extrabold uppercase">Gerenciamento</span>
                    </div>

                    {/* Selector de modo de Cadastro */}
                    <div className="flex bg-slate-100/80 p-1 rounded-xl mb-4">
                      <button
                        type="button"
                        onClick={() => { setRegMode('individual'); setBulkSummary(null); }}
                        className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${regMode === 'individual' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Cadastro Único
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRegMode('massa'); setBulkSummary(null); }}
                        className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${regMode === 'massa' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        📋 Registro em Massa (Excel/Texto)
                      </button>
                    </div>

                    {regMode === 'individual' ? (
                      <div>
                        <p className="text-slate-500 text-xs mb-4 leading-relaxed">
                          Preencha os dados do colaborador para registrá-lo na base de usuários autorizados do HUSF. Ele obterá <span className="font-bold text-amber-600">30 moedas iniciais</span> para começar a abrir seus primeiros pacotes.
                        </p>

                        <form onSubmit={handleRegisterCollaborator} className="space-y-4">
                          {/* Name input */}
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome Completo do Colaborador</label>
                            <input 
                              type="text" 
                              placeholder="Ex: Dra. Mariana Ramos ou Técnico Carlos"
                              value={newRegName}
                              onChange={(e) => setNewRegName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white font-medium transition-colors"
                              required
                            />
                          </div>

                          {/* CPF and sector container */}
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide font-medium">CPF (Login do Usuário)</label>
                              <input 
                                type="text" 
                                placeholder="000.000.000-00"
                                maxLength={14}
                                value={newRegCpf}
                                onChange={(e) => {
                                  const masked = formatCPF(e.target.value);
                                  setNewRegCpf(masked);
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white font-mono tracking-wider transition-colors"
                                required
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide font-medium">Setor Principal</label>
                              <select 
                                value={newRegSector}
                                onChange={(e) => setNewRegSector(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white font-medium transition-colors cursor-pointer"
                              >
                                <option value="UTI Adulto">UTI Adulto</option>
                                <option value="UTI Neonatal">UTI Neonatal</option>
                                <option value="Pronto Socorro">Pronto Socorro</option>
                                <option value="Centro Cirúrgico">Centro Cirúrgico</option>
                                <option value="Clínica Médica">Clínica Médica</option>
                                <option value="Higienização / Limpeza">Higienização / Limpeza</option>
                                <option value="Diretoria de Qualidade">Diretoria de Qualidade</option>
                                <option value="Farmácia Hospitalar">Farmácia Hospitalar</option>
                                <option value="Pediatria">Pediatria</option>
                                <option value="Radiologia">Radiologia</option>
                                <option value="Outro Setor">Outro Setor...</option>
                              </select>
                            </div>
                          </div>

                          {/* Fallback Custom Sector Input if select "Outro Setor" */}
                          {newRegSector === 'Outro Setor' && (
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide font-medium">Especifique o Setor Personalizado</label>
                              <input
                                type="text"
                                placeholder="Nome do departamento, ex: Laboratório Clínico"
                                onChange={(e) => setNewRegSector(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white font-medium transition-colors"
                                required
                              />
                            </div>
                          )}

                          {/* Display warning or successes */}
                          {newRegError && (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-rose-700 text-xs shadow-2xs">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>{newRegError}</span>
                            </div>
                          )}

                          {newRegSuccess && (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2 text-emerald-700 text-xs shadow-2xs">
                              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                              <span>{newRegSuccess}</span>
                            </div>
                          )}

                          {/* Form action */}
                          <button 
                            type="submit"
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-extrabold uppercase text-xs tracking-wider py-3 rounded-xl shadow-xs hover:from-purple-700 hover:to-indigo-800 transition-all hover:shadow-xs cursor-pointer active:scale-95"
                          >
                            Registrar na Base HUSF
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-slate-500 text-xs leading-relaxed">
                          Adicione múltiplos colaboradores de uma só vez! Cole dados vindos do <strong>Excel</strong>, <strong>Google Sheets</strong> ou de um arquivo de texto. Cada funcionário deve estar em sua própria linha no padrão:
                        </p>

                        <div className="bg-purple-50/60 border border-purple-150 p-3 rounded-xl text-[11px] text-purple-950 font-medium">
                          <strong>Padrão suportado:</strong> <code className="bg-white px-1 py-0.5 border border-purple-100 rounded text-purple-800 font-bold font-mono">CPF ; Nome ; Setor</code>
                          <pre className="mt-2 font-mono text-[10px] text-purple-900 bg-white/70 p-2 rounded-lg select-all border border-purple-100 overflow-x-auto">
                            {"111.111.111-11 ; Dra. Laura Albuquerque ; UTI Neonatal\n222.222.222-22 ; Fernando Lima ; Pronto Socorro\n333.333.333-33 ; Patrícia Santos ; Farmácia Hospitalar"}
                          </pre>
                          <p className="mt-2 text-[10px] text-purple-600/90 leading-normal">
                            💡 O CPF pode ser inserido tanto com pontos/hífen quanto apenas os 11 dígitos numéricos (o sistema formatará automaticamente!). Caso o Setor não seja informado, será classificado como "Outro Setor".
                          </p>
                        </div>

                        <form onSubmit={handleBulkRegister} className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dados para Processamento</label>
                            <textarea
                              rows={5}
                              placeholder="CPF;Nome;Setor&#13;CPF;Nome;Setor..."
                              value={bulkText}
                              onChange={(e) => setBulkText(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs text-slate-850 font-mono leading-relaxed focus:outline-none focus:border-purple-500 focus:bg-white transition-colors resize-y min-h-[140px]"
                            />
                          </div>

                          {bulkError && (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-rose-700 text-xs">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>{bulkError}</span>
                            </div>
                          )}

                          {bulkSuccess && (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2 text-emerald-700 text-xs">
                              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                              <span>{bulkSuccess}</span>
                            </div>
                          )}

                          <button 
                            type="submit"
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-extrabold uppercase text-xs tracking-wider py-3 rounded-xl shadow-xs hover:from-purple-700 hover:to-indigo-800 transition-all hover:shadow-xs cursor-pointer active:scale-95"
                          >
                            Importar Linhas e Cadastrar Todos
                          </button>
                        </form>

                        {/* Import summary results panel */}
                        {bulkSummary && (
                          <div className="mt-4 border-t border-slate-100 pt-3.5 space-y-3">
                            <h4 className="font-bold text-slate-700 text-xs font-[Space_Grotesk]">Resultado do Último Processamento:</h4>
                            
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-lg">
                                ✓ {bulkSummary.success} Cadastrados
                              </span>
                              {bulkSummary.duplicates.length > 0 && (
                                <span className="bg-amber-50 border border-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-lg">
                                  ⚠ {bulkSummary.duplicates.length} Duplicidades Puladas
                                </span>
                              )}
                              {bulkSummary.invalid.length > 0 && (
                                <span className="bg-rose-50 border border-rose-100 text-rose-700 font-bold px-2.5 py-1 rounded-lg">
                                  ✗ {bulkSummary.invalid.length} Erros Encontrados
                                </span>
                              )}
                            </div>

                            {/* Dup report lists */}
                            {bulkSummary.duplicates.length > 0 && (
                              <div className="bg-amber-50/50 border border-amber-100/50 p-2 rounded-xl text-[11px] text-amber-800">
                                <p className="font-bold flex items-center gap-1 mb-1">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                  Colaboradores pulados (CPF já cadastrado):
                                </p>
                                <ul className="list-disc pl-4 space-y-0.5 max-h-[75px] overflow-y-auto">
                                  {bulkSummary.duplicates.map((dup, idx) => (
                                    <li key={idx}>Line items: {dup}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Errors report lists */}
                            {bulkSummary.invalid.length > 0 && (
                              <div className="bg-rose-50/50 border border-rose-100/50 p-2 rounded-xl text-[11px] text-rose-800">
                                <p className="font-bold flex items-center gap-1 mb-1">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                  Linhas não processadas (Erros de digitação/formato):
                                </p>
                                <ul className="list-disc pl-4 space-y-0.5 max-h-[75px] overflow-y-auto">
                                  {bulkSummary.invalid.map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Exclusive Quick Simulation Tools */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 md:col-span-2 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                      <h3 className="font-bold text-slate-800 text-lg font-[Space_Grotesk] flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        Atalhos Administrador
                      </h3>
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-extrabold uppercase">Homologação</span>
                    </div>

                    <p className="text-slate-500 text-xs leading-relaxed">
                      Utilize essas ações automáticas para dar bypass em etapas de auditoria ou testar o comportamento do álbum e da loja de pacotes:
                    </p>

                    <div className="space-y-3.5">
                      {/* Infinite coins bypass */}
                      <div className="p-3.5 rounded-2xl border border-indigo-50 bg-indigo-50/10 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 font-[Space_Grotesk]">
                            <Coins className="w-4 h-4 text-amber-500" />
                            Emitir Moedas para Si Mesmo
                          </h4>
                          <p className="text-[10px] text-slate-400">Adicione +250 moedas em seu saldo de modo instantâneo para testar compras na loja.</p>
                        </div>
                        <button
                          onClick={() => {
                            if (onUpdateUser) {
                              onUpdateUser({
                                ...user,
                                coins: user.coins + 250
                              });
                            }
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0 animate-pulse"
                        >
                          Adicionar Moedas
                        </button>
                      </div>

                      {/* Unlock all stickers bypass */}
                      <div className="p-3.5 rounded-2xl border border-purple-50 bg-purple-50/10 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5 font-[Space_Grotesk]">
                            <Award className="w-4 h-4 text-purple-500" />
                            Completar Meu Álbum
                          </h4>
                          <p className="text-[10px] text-slate-400">Desbloqueia instantaneamente todas as figurinhas para homologar animações.</p>
                        </div>
                        <button
                          onClick={() => {
                            if (onUpdateUser) {
                              const allIds = getAllStickers().map(s => s.id);
                              onUpdateUser({
                                ...user,
                                stickers: allIds
                              });
                            }
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
                        >
                          Liberar Todas
                        </button>
                      </div>

                      {/* Reset self progress */}
                      <div className="p-3.5 rounded-2xl border border-rose-50 bg-rose-50/10 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-rose-950 flex items-center gap-1.5 font-[Space_Grotesk]">
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                            Zerar Progresso & Inventário
                          </h4>
                          <p className="text-[10px] text-slate-400">Esvazia o álbum e moedas para re-jogar na visão de usuário do zero.</p>
                        </div>
                        <button
                          onClick={() => {
                            if (onUpdateUser) {
                              onUpdateUser({
                                ...user,
                                coins: 30,
                                stickers: [],
                                progress: {}
                              });
                            }
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
                        >
                          Limpar Progresso
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Controle de Liberação das Metas de Segurança */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg font-[Space_Grotesk] flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-purple-600" />
                      Controle Dinâmico de Liberação das Metas de Segurança (HUSF)
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">Determine em tempo real quais das 6 Metas Internacionais estão liberadas ou bloqueadas para os colaboradores responderem.</p>
                  </div>
                  
                  {/* Quick toggle controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleReleaseAllMetas}
                      className="bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer active:scale-95"
                    >
                      ✓ Liberar Todas
                    </button>
                    <button
                      onClick={handleLockAllMetas}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer active:scale-95"
                    >
                      ✗ Bloquear Todas
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {METAS.map((meta) => {
                    const isReleased = releasedMetas.includes(meta.id);
                    return (
                      <div 
                        key={meta.id} 
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                          isReleased 
                            ? 'bg-emerald-50/15 border-emerald-100 hover:border-emerald-200' 
                            : 'bg-rose-50/10 border-rose-100/40 hover:border-rose-200/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${meta.color}`}>
                            {meta.icon}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm font-[Space_Grotesk] truncate">{meta.title}</h4>
                            <p className="text-[11px] text-slate-500 truncate">{meta.desc}</p>
                          </div>
                        </div>

                        {/* Status badge and Toggle Switch */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                          <span className={`text-[9px] uppercase font-extrabold px-2 py-1 rounded-md tracking-wider leading-none ${
                            isReleased 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isReleased ? 'Liberada para Jogar' : 'Bloqueada p/ Equipe'}
                          </span>

                          <button
                            onClick={() => handleToggleMetaRelease(meta.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 leading-none ${
                              isReleased
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {isReleased ? (
                              <>
                                <Lock className="w-3.5 h-3.5 text-rose-600" /> Bloquear
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5 text-emerald-600" /> Liberar
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Gerenciamento de Figurinhas da Copa Celso */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100/90">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg font-[Space_Grotesk] flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-500 animate-pulse" />
                      Gerenciamento de Figurinhas da Copa Celso (Álbum)
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">Cadastre novas figurinhas colecionáveis ou remova itens existentes do álbum e dos pacotes de compra em tempo real.</p>
                  </div>
                </div>

                <div className="grid lg:grid-cols-5 gap-6">
                  {/* Form to Add Sticker */}
                  <div className="lg:col-span-2 bg-slate-50/50 border border-slate-200/65 p-5 rounded-2xl flex flex-col justify-between">
                    <div>
                      <h4 className="font-extrabold text-xs text-purple-700 uppercase tracking-widest mb-4 flex items-center gap-1.5 font-[Space_Grotesk]">
                        ✨ Adicionar Cromo no Catálogo
                      </h4>

                      <form onSubmit={handleCreateSticker} className="space-y-4">
                        {/* Name Input */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome da Figurinha</label>
                          <input 
                            type="text" 
                            placeholder="Ex: Celso do Repouso, Meta 7, etc."
                            value={newStickerName}
                            onChange={(e) => setNewStickerName(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-purple-500 font-medium transition-colors"
                            required
                          />
                        </div>

                        {/* Rarity selector */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Raridade</label>
                          <select 
                            value={newStickerRarity}
                            onChange={(e) => setNewStickerRarity(e.target.value as any)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-purple-500 font-medium transition-colors cursor-pointer"
                          >
                            <option value="regular">Regular (Comum)</option>
                            <option value="holografica">Holográfica (Rara)</option>
                            <option value="lendaria">Lendária (Muito Rara)</option>
                            <option value="suprema">Suprema (Extremamente Rara)</option>
                          </select>
                        </div>

                        {/* Origem da Imagem (Upload Local ou Link Web) */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Origem da Imagem da Figurinha</label>
                          <div className="flex bg-white border border-slate-200/80 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => { setStickerImageMode('upload'); setNewStickerImage(''); }}
                              className={`flex-1 text-center py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${stickerImageMode === 'upload' ? 'bg-purple-100/70 text-purple-700' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                              📁 Enviar do Meu PC (Local)
                            </button>
                            <button
                              type="button"
                              onClick={() => { setStickerImageMode('url'); setNewStickerImage(''); }}
                              className={`flex-1 text-center py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${stickerImageMode === 'url' ? 'bg-purple-100/70 text-purple-700' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                              🔗 Link Web (URL)
                            </button>
                          </div>
                        </div>

                        {stickerImageMode === 'upload' ? (
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Carregar Arquivo Local</label>
                            <div className="border-2 border-dashed border-slate-200 hover:border-purple-400 rounded-xl p-4 flex flex-col items-center justify-center bg-white hover:bg-slate-50/50 transition-colors relative cursor-pointer">
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleStickerFileChange}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                              <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                              <span className="text-[11px] text-slate-500 font-semibold text-center">Clique para selecionar imagem do seu PC</span>
                              <span className="text-[9px] text-slate-400 mt-0.5">Tamanho recomendado: até 1.5MB</span>
                            </div>
                            {newStickerImage && (
                              <div className="mt-2 bg-purple-50/50 border border-purple-100 p-2 text-xs rounded-xl flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                                  <img src={newStickerImage} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="block text-[11px] text-purple-950 font-bold">✓ Imagem carregada localmente</span>
                                  <button 
                                    type="button" 
                                    onClick={() => setNewStickerImage('')} 
                                    className="text-[10px] text-rose-600 font-bold hover:underline"
                                  >
                                    Remover imagem
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                              <span>Link da Imagem (URL)</span>
                              <span className="text-[10px] text-slate-400 lowercase normal-case">usa padrão se vazio</span>
                            </label>
                            <input 
                              type="url" 
                              placeholder="https://exemplo.com/imagem.png"
                              value={newStickerImage}
                              onChange={(e) => setNewStickerImage(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-purple-500 font-medium transition-colors"
                            />
                            {newStickerImage && (
                              <div className="mt-2 bg-slate-50 rounded-xl p-2.5 flex items-center justify-center border border-slate-100">
                                <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-white shrink-0 flex items-center justify-center">
                                  <img src={newStickerImage} alt="Preview URL" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Status messages inside the form */}
                        {stickerError && (
                          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-rose-700 text-xs shadow-2xs">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{stickerError}</span>
                          </div>
                        )}

                        {stickerSuccess && (
                          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2 text-emerald-700 text-xs shadow-2xs">
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                            <span>{stickerSuccess}</span>
                          </div>
                        )}

                        <button 
                          type="submit"
                          disabled={isCreatingSticker}
                          className={`w-full text-white font-extrabold uppercase text-xs tracking-wider py-3 rounded-xl shadow-xs transition-colors cursor-pointer active:scale-95 ${isCreatingSticker ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800'}`}
                        >
                          {isCreatingSticker ? 'Sincronizando...' : 'Adicionar Figurinha'}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* List and Search of Stickers */}
                  <div className="lg:col-span-3 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <h4 className="font-extrabold text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1 font-[Space_Grotesk]">
                        📋 Figurinhas Ativas ({allStickersCatalog.length})
                      </h4>

                      <div className="relative w-full sm:w-60 shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Buscar figurinha pelo nome..."
                          value={stickerSearch}
                          onChange={(e) => setStickerSearch(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-805 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white font-medium transition-all"
                        />
                      </div>
                    </div>

                    <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                            <th className="py-3 px-4 w-16">ID</th>
                            <th className="py-3 px-4">Nome da Figurinha</th>
                            <th className="py-3 px-4">Raridade</th>
                            <th className="py-3 px-4 text-right w-20">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-750 text-xs font-semibold">
                          {allStickersCatalog
                            .filter(st => st.name.toLowerCase().includes(stickerSearch.toLowerCase()))
                            .map((st) => {
                              let badgeColor = "bg-slate-100 text-slate-805";
                              if (st.rarity === 'suprema') badgeColor = "bg-yellow-100 text-yellow-800 font-bold border border-yellow-200";
                              else if (st.rarity === 'lendaria') badgeColor = "bg-fuchsia-100 text-fuchsia-800 font-bold border border-fuchsia-200";
                              else if (st.rarity === 'holografica') badgeColor = "bg-cyan-100 text-cyan-800 font-bold border border-cyan-200";

                              return (
                                <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-4 font-mono font-bold text-slate-400 text-[11px]">#{st.id}</td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      {st.image ? (
                                        <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                                          <img src={st.image} alt={st.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                        </div>
                                      ) : (
                                        <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center font-black text-[10px] shrink-0">★</div>
                                      )}
                                      <span className="font-semibold text-slate-800 truncate max-w-[150px] sm:max-w-xs">{st.name}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded ${badgeColor}`}>
                                      {st.rarity}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      type="button"
                                      disabled={isDeletingStickerId !== null}
                                      onClick={() => {
                                        if (confirm(`Tem certeza de que deseja remover a figurinha "${st.name}"? Isso a removerá do álbum e dos futuros pacotes abertos.`)) {
                                          handleDeleteSticker(st.id);
                                        }
                                      }}
                                      className={`p-1 px-2 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer active:scale-90 font-bold border-none ${isDeletingStickerId === st.id ? 'text-slate-400 bg-slate-150 cursor-not-allowed animate-pulse' : 'text-rose-600 hover:bg-rose-50'}`}
                                      title="Remover do catálogo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      {isDeletingStickerId === st.id ? 'Removendo...' : 'Remover'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          {allStickersCatalog.filter(st => st.name.toLowerCase().includes(stickerSearch.toLowerCase())).length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                                Nenhuma figurinha encontrada com esse termo.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabela robusta de gerenciamento e pesquisa de dados de colaboradores */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg font-[Space_Grotesk] flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-indigo-500" />
                      Auditoria e Gerenciamento de Colaboradores
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">Veja a listagem de todos que participam do jogo HUSF em tempo real.</p>
                  </div>
                  
                  {/* Search input inside the registry list */}
                  <div className="relative w-full sm:w-80 shrink-0">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Pesquisar por nome, setor ou CPF..."
                      value={adminSearchFilter}
                      onChange={(e) => setAdminSearchFilter(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs border border-slate-200 focus:border-indigo-500 rounded-xl pl-9.5 pr-4 py-2.5 outline-none font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 pl-2">Colaborador</th>
                        <th className="pb-3">CPF</th>
                        <th className="pb-3">Setor</th>
                        <th className="pb-3 text-center">Moedas</th>
                        <th className="pb-3 text-right pr-2">Ações Administrativas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {usersList
                        .filter(u => 
                          u.name.toLowerCase().includes(adminSearchFilter.toLowerCase()) ||
                          u.sector.toLowerCase().includes(adminSearchFilter.toLowerCase()) ||
                          u.cpf.includes(adminSearchFilter)
                        )
                        .map((u) => (
                        <tr key={u.cpf} className="hover:bg-slate-50/50 transition-colors group">
                          {/* Colaborador Avatar & Name */}
                          <td className="py-3 pl-2">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs flex items-center justify-center border border-indigo-100">
                                {u.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-slate-800 block truncate">{u.name}</span>
                                {u.isAdmin && (
                                  <span className="text-[9px] font-black tracking-wider uppercase text-purple-600 bg-purple-50 border border-purple-100 px-1 py-0.5 rounded leading-none mt-0.5 inline-block">
                                    ADMIN
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* CPF */}
                          <td className="py-3 font-mono text-xs text-slate-500 tracking-wider">
                            {u.cpf}
                          </td>

                          {/* Setor */}
                          <td className="py-3">
                            <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-bold">
                              {u.sector}
                            </span>
                          </td>

                          {/* Coins */}
                          <td className="py-3 text-center">
                            <span className="inline-flex items-center gap-1 font-extrabold text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 text-xs">
                              {u.coins} <Coins className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          </td>

                          {/* Quick Admin action links */}
                          <td className="py-3 text-right pr-2">
                            <div className="inline-flex items-center gap-2 justify-end">
                              {/* Reward buttons */}
                              <button 
                                onClick={() => handleRewardUser(u.cpf, 100)}
                                className="text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-2 py-1 transition-all active:scale-95 cursor-pointer"
                                title="Recompensar com 100 Moedas"
                              >
                                +100
                              </button>
                              <button 
                                onClick={() => handleRewardUser(u.cpf, 500)}
                                className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2 py-1 transition-all active:scale-95 cursor-pointer"
                                title="Recompensar com 500 Moedas"
                              >
                                +500
                              </button>

                              {/* Gift sticker select dropdown */}
                              <select
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    handleGiftSticker(u.cpf, parseInt(val));
                                    e.target.value = ''; // Reset select
                                  }
                                }}
                                className="text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg px-1.5 py-1.5 border border-indigo-150 outline-none cursor-pointer max-w-[110px]"
                                defaultValue=""
                              >
                                <option value="" disabled>🎁 Dar Figurinha</option>
                                {allStickersCatalog.map(st => (
                                  <option key={st.id} value={st.id}>
                                    #{st.id} - {st.name}
                                  </option>
                                ))}
                              </select>

                              {/* Persistent state-based confirmation delete link */}
                              {confirmDeleteCpf === u.cpf ? (
                                <div className="inline-flex items-center gap-1 animate-pulse bg-red-50 p-1 border border-red-200 rounded-lg">
                                  <button
                                    onClick={() => handleDeleteUser(u.cpf)}
                                    className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[9px] tracking-wider px-2 py-1 rounded-md"
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteCpf(null)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[9px] px-1.5 py-1 rounded-md"
                                  >
                                    X
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (u.cpf === user.cpf) return;
                                    setConfirmDeleteCpf(u.cpf);
                                  }}
                                  disabled={u.cpf === user.cpf}
                                  className={`p-2 rounded-lg transition-all ${u.cpf === user.cpf ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer active:scale-95'}`}
                                  title="Excluir Colaborador"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Simulated quality audit flow log stream */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-lg font-[Space_Grotesk] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-pulse" />
                    Fluxo de Auditorias de Segurança Ativas (HUSF)
                  </h3>
                  <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Monitoramento de Boas Práticas</span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 animate-pulse shrink-0" />
                    <div>
                      <span className="font-bold text-slate-700">Auditório Geral:</span> Colaborador <span className="font-bold text-slate-800">Ana Souza</span> (UTI Adulto) respondeu corretamente à pergunta sobre higienização correta das mãos (<span className="text-emerald-600 font-semibold">Meta 5</span>).
                      <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Há 1 minuto atrás</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-700">Álbum & Engajamento:</span> Colaborador <span className="font-bold text-slate-800">Bruno Santos</span> (Pronto Socorro) abriu um Pacote Comum e adquiriu a figurinha <span className="font-semibold text-indigo-600">#4 Checklist Cirúrgico</span>.
                      <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Há 4 minutos atrás</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-700">Auditório Geral:</span> Colaborador <span className="font-bold text-slate-800">Carolina Lima</span> (Centro Cirúrgico) conquistou nota máxima e acumulou moedas no treinamento livre da <span className="text-emerald-600 font-semibold">Meta 3 (Segurança de Medicamentos)</span>.
                      <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Há 12 minutos atrás</span>
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
        </div>

      </div>
    </div>
  );
}


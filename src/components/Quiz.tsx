import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ShieldAlert, CheckCircle2, XCircle, ArrowRight, Coins, Zap, Trophy } from 'lucide-react';
import { Question, getRandomQuestions } from '../lib/questions';
import { MetaProgress } from '../types';
import { playSound } from '../lib/audio';

interface QuizProps {
  metaId: number;
  metaTitle: string;
  metaColor: string;
  progress?: MetaProgress;
  onComplete: (coinsEarned: number, correctAnswers: number, newProgress: MetaProgress) => void;
  onAbort: () => void;
}

export function Quiz({ metaId, metaTitle, metaColor, progress, onComplete, onAbort }: QuizProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isShowingFeedback, setIsShowingFeedback] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [isFinished, setIsFinished] = useState(false);
  const [finishData, setFinishData] = useState<{coinsToAward: number, newProgress: MetaProgress} | null>(null);

  // Animated number component
  const AnimatedNumber = ({ value }: { value: number }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      let start = 0;
      const end = value;
      if (start === end) {
        setDisplayValue(end);
        return;
      }

      const duration = 1500;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        setDisplayValue(Math.floor(start + (end - start) * easeProgress));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }, [value]);

    return <>{displayValue}</>;
  };

  // Setup initial questions on mount
  useEffect(() => {
    setQuestions(getRandomQuestions(metaId, 5));
  }, [metaId]);

  // Timer logic
  useEffect(() => {
    if (isShowingFeedback || isFinished || questions.length === 0) return;

    if (timeLeft === 0) {
      handleTimeOut();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isShowingFeedback, isFinished, questions.length]);

  const handleTimeOut = () => {
    setSelectedOption(-1); // Represents timeout
    setIsShowingFeedback(true);
    playSound('error');
  };

  const handleSelectOption = (index: number) => {
    if (isShowingFeedback) return;
    setSelectedOption(index);
    setIsShowingFeedback(true);
    
    if (questions[currentIndex].correctIndex === index) {
      setCorrectCount(prev => prev + 1);
      playSound('success');
    } else {
      playSound('error');
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsShowingFeedback(false);
      setTimeLeft(20);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    setIsFinished(true);
    
    const today = new Date().toISOString().split('T')[0];
    const isAmador = progress?.isAmador || (progress?.totalCoinsEarned && progress.totalCoinsEarned > 0 && progress.lastPlayedDate !== today) ? true : false;
    
    let attemptsToday = progress?.lastPlayedDate === today ? (progress.attemptsToday || 0) : 0;
    const isFirstAttemptOfDay = attemptsToday === 0;
    const highestCoinsToday = progress?.lastPlayedDate === today ? (progress.highestCoinsToday || 0) : 0;
    
    let todayCoins = 0;
    
    // Treino livre enforced if limit reached
    const isTreinoLivre = progress?.totalCoinsEarned && progress.totalCoinsEarned >= 150;

    if (isTreinoLivre) {
      todayCoins = 0;
    } else if (isAmador) {
      todayCoins = correctCount * 2;
    } else {
      // Copa rewards
      if (isFirstAttemptOfDay) {
        if (correctCount === 3) todayCoins = 45;
        else if (correctCount === 4) todayCoins = 60;
        else if (correctCount === 5) todayCoins = 125;
      } else {
        if (correctCount === 3) todayCoins = 30;
        else if (correctCount === 4) todayCoins = 40;
        else if (correctCount === 5) todayCoins = 70;
      }
    }

    let coinsToAward = 0;
    if (isTreinoLivre) {
      coinsToAward = 0;
    } else if (isAmador) {
      // We still use max logic to guarantee they get value if they score higher today
      coinsToAward = Math.max(0, todayCoins - highestCoinsToday);
    } else {
      coinsToAward = Math.max(0, todayCoins - highestCoinsToday);
    }

    const currentTotal = progress?.totalCoinsEarned || 0;
    if (!isTreinoLivre && currentTotal + coinsToAward > 150) {
      coinsToAward = 150 - currentTotal;
    }

    const newProgress: MetaProgress = {
      metaId,
      lastPlayedDate: today,
      attemptsToday: attemptsToday + 1,
      highestCoinsToday: Math.max(highestCoinsToday, todayCoins),
      totalCoinsEarned: Math.min(150, currentTotal + coinsToAward),
      isAmador: isAmador || (!isAmador && attemptsToday >= 2 && new Date().getHours() === 23)
    };

    setFinishData({ coinsToAward, newProgress });
  };

  if (questions.length === 0) return null;

  if (isFinished && finishData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Blurred backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-w-md w-full text-center p-8 relative z-10"
        >
         <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-brand-500 blur-3xl opacity-20 pointer-events-none" />
         <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-amber-500 blur-3xl opacity-20 pointer-events-none" />
         
         <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mb-6 shadow-sm border-4 border-white">
              <Trophy className="w-10 h-10 text-brand-600" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2 font-[Space_Grotesk]">Resultado do Quiz</h2>
            <p className="text-base text-slate-500 mb-8 font-medium">Você acertou <span className="text-brand-600 font-bold">{correctCount}</span> de {questions.length} perguntas.</p>

            <div className="w-full bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 mb-8 relative overflow-hidden shadow-inner flex flex-col items-center">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-amber-400 blur-3xl opacity-20 rounded-full pointer-events-none" />
              <p className="text-amber-800 font-bold uppercase tracking-widest text-xs mb-2 relative z-10">Moedas Conquistadas</p>
              <div className="flex items-center justify-center gap-2 relative z-10">
                <Coins className="w-8 h-8 text-amber-500" />
                <span className="text-5xl font-bold text-amber-600 font-[Space_Grotesk] leading-none drop-shadow-sm">
                  <AnimatedNumber value={finishData.coinsToAward} />
                </span>
              </div>
            </div>

            <button
               onClick={() => onComplete(finishData.coinsToAward, correctCount, finishData.newProgress)}
               className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 px-8 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-md flex items-center justify-center gap-2"
            >
              Continuar
              <ArrowRight className="w-5 h-5" />
            </button>
         </div>
        </motion.div>
      </div>
    );
  }

  const question = questions[currentIndex];
  const isCorrect = selectedOption === question.correctIndex;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden max-w-3xl mx-auto w-full"
    >
      {/* Header */}
      <div className={`${metaColor} p-6 pb-8 text-white relative overflow-hidden flex items-center justify-between`}>
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none" />
        <div>
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold tracking-wide uppercase shadow-sm">
            {metaTitle}
          </span>
          <p className="mt-2 text-white/90 font-medium">
            Pergunta {currentIndex + 1} de {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900/40 px-4 py-2 rounded-xl backdrop-blur-md font-bold text-xl shadow-inner relative z-10">
          <Clock className={`w-6 h-6 ${timeLeft <= 5 && !isShowingFeedback ? 'text-red-400 animate-pulse' : 'text-white'}`} />
          <span className={`${timeLeft <= 5 && !isShowingFeedback ? 'text-red-400' : 'text-white'}`}>
            00:{timeLeft.toString().padStart(2, '0')}
          </span>
        </div>
        
        {/* Timer Progress Bar */}
        {!isShowingFeedback && !isFinished && (
          <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/20">
            <motion.div 
              key={`timer-${currentIndex}`}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 20, ease: 'linear' }}
              className={`h-full rounded-r-full ${timeLeft <= 5 ? 'bg-red-400' : 'bg-white'}`}
            />
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-slate-100 relative">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex) / questions.length) * 100}%` }}
          className={`h-full ${metaColor.replace('bg-', 'bg-')} shadow-md`}
        />
      </div>

      {/* Question Content */}
      <div className="p-6 sm:p-10">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-8 leading-relaxed font-[Space_Grotesk]">
          {question.text}
        </h2>

        <div className="space-y-4">
          {question.options.map((opt, idx) => {
            let buttonClass = "w-full text-left p-[22px] rounded-2xl transition-all font-medium text-slate-700 bg-white shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] hover:shadow-[0_4px_15px_-3px_rgba(6,81,237,0.12)] hover:bg-slate-50 border-2 border-transparent";
            
            if (isShowingFeedback) {
              if (idx === question.correctIndex) {
                buttonClass = "w-full text-left p-[22px] rounded-2xl border-2 transition-all font-bold text-green-800 bg-green-50 border-green-500 shadow-md transform scale-[1.02] z-10 relative";
              } else if (idx === selectedOption) {
                buttonClass = "w-full text-left p-[22px] rounded-2xl border-2 transition-all font-bold text-red-800 bg-red-50 border-red-400 opacity-60";
              } else {
                buttonClass = "w-full text-left p-[22px] rounded-2xl border-2 border-transparent transition-all font-medium text-slate-400 bg-slate-50 opacity-50";
              }
            }

            return (
              <button
                key={idx}
                disabled={isShowingFeedback}
                onClick={() => handleSelectOption(idx)}
                className={buttonClass}
              >
                 <div className="flex items-center gap-4">
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${isShowingFeedback && idx === question.correctIndex ? 'bg-green-500 text-white' : isShowingFeedback && idx === selectedOption ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 transition-colors'}`}>
                     {['A', 'B', 'C', 'D'][idx]}
                   </div>
                   <span className="flex-1 leading-snug">{opt}</span>
                   
                   {isShowingFeedback && idx === question.correctIndex && <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />}
                   {isShowingFeedback && idx === selectedOption && idx !== question.correctIndex && <XCircle className="w-6 h-6 text-red-500 shrink-0" />}
                 </div>
              </button>
            );
          })}
        </div>

        {/* Feedback (VAR Educativo) */}
        <AnimatePresence>
          {isShowingFeedback && (
            <motion.div 
              initial={{ opacity: 0, height: 0, y: 10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              className="mt-8"
            >
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 relative overflow-hidden mb-6 shadow-sm">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${isCorrect ? 'bg-green-500' : 'bg-rose-500'}`} />
                
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex items-start gap-4 sm:w-1/3 shrink-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                      {isCorrect ? <CheckCircle2 className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                    </div>
                    <div className="pt-1">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Análise do VAR</span>
                      <h4 className={`font-bold text-lg font-[Space_Grotesk] leading-tight ${isCorrect ? 'text-green-700' : 'text-rose-700'}`}>
                        {isCorrect ? 'Procedimento Correto' : 'Revisão de Protocolo'}
                      </h4>
                    </div>
                  </div>
                  
                  <div className="flex-1 sm:pl-6 sm:border-l border-slate-200/80">
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {question.feedback}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-6">
                <button 
                  onClick={handleNextQuestion}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 px-8 rounded-xl flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 shadow-md"
                >
                  {currentIndex < questions.length - 1 ? 'Próxima Pergunta' : 'Ver Resultados'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer controls if not showing feedback */}
      {!isShowingFeedback && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-slate-400 font-medium text-sm">
          <span>Seja rápido. Você tem 20 segundos.</span>
          <button onClick={onAbort} className="hover:text-slate-600 transition-colors">
            Abandonar Partida
          </button>
        </div>
      )}
    </motion.div>
  );
}

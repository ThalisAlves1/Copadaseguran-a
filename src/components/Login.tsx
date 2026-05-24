import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, ArrowRight, Loader2, Building2, UserCheck, ArrowLeft } from 'lucide-react';
import { formatCPF, simulateLogin } from '../lib/auth';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validatedUser, setValidatedUser] = useState<User | null>(null);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpf.length !== 14) {
      setError('Por favor, informe um CPF válido (11 dígitos).');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const user = await simulateLogin(cpf);
      if (user) {
        setValidatedUser(user);
      } else {
        setError('Colaborador não cadastrado na plataforma. Solicite seu cadastro ao Administrador (Setor de Qualidade).');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50/50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl shadow-slate-200 overflow-hidden flex flex-col lg:flex-row"
      >
        <div className="bg-brand-600 p-8 md:p-14 lg:p-16 text-center text-white flex flex-col justify-center items-center lg:w-5/12 relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 left-0 w-full h-full bg-brand-500 opacity-20 blur-3xl rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none" />
          
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
            className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-8 relative z-10 shadow-lg"
          >
            <ShieldCheck className="w-12 h-12 text-white" />
          </motion.div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4 relative z-10 leading-tight font-[Space_Grotesk]">Segurança do Paciente</h1>
          <p className="text-brand-50 text-lg leading-relaxed relative z-10">
            Plataforma de Treinamento e Avaliação das 6 Metas Internacionais.
          </p>
        </div>

        <div className="p-6 sm:p-8 md:p-14 lg:p-16 lg:w-7/12 flex flex-col justify-center">
          {validatedUser ? (
            <motion.div
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="mb-6 text-center lg:text-left">
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-flex items-center gap-1.5 border border-emerald-100">
                  <UserCheck className="w-4 h-4" />
                  Cadastro Identificado
                </span>
                <h2 className="text-3xl font-extrabold text-slate-800 mb-2 font-[Space_Grotesk]">Confirme seus Dados</h2>
                <p className="text-slate-500 text-sm leading-relaxed">Verifique se as informações abaixo coincidem com o seu crachá profissional antes de acessar o portal de treinamento.</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200/85 space-y-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-brand-600 text-white rounded-full flex items-center justify-center font-black text-xl shadow-md shrink-0">
                    {validatedUser.name.charAt(0)}
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Nome Completo</span>
                    <h3 className="text-lg font-bold text-slate-800 font-[Space_Grotesk] leading-tight uppercase tracking-wide">{validatedUser.name}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/60">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-brand-600 mt-1 shrink-0" />
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Setor alocado</span>
                      <p className="text-sm font-bold text-slate-700 leading-tight">{validatedUser.sector}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-600 mt-1 shrink-0" />
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">CPF Confirmado</span>
                      <p className="text-sm font-mono font-bold text-slate-700 leading-tight">{validatedUser.cpf}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => onLoginSuccess(validatedUser)}
                  className="w-full bg-brand-600 hover:bg-brand-700 active:scale-[0.99] transform text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center transition-all shadow-md shadow-brand-100 hover:shadow-brand-300 gap-2 cursor-pointer"
                >
                  Sim, sou eu / Continuar
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  onClick={() => {
                    setValidatedUser(null);
                    setCpf('');
                  }}
                  className="w-full bg-white hover:bg-slate-50 text-slate-500 border-2 border-slate-200 text-sm font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-colors gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Não sou eu, corrigir CPF
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="mb-6 text-center lg:text-left">
                <h2 className="text-2xl font-bold text-slate-800 mb-2 font-[Space_Grotesk]">Entrar na Plataforma</h2>
                <p className="text-slate-500 text-sm">Insira seu CPF cadastrado para acessar o ambiente de treinamento.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="cpf" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    CPF do Colaborador
                  </label>
                  <div className="relative">
                    <input
                      id="cpf"
                      type="text"
                      value={cpf}
                      onChange={handleCpfChange}
                      placeholder="000.000.000-00"
                      className={`w-full px-5 py-4 rounded-xl border-2 focus:ring-4 focus:outline-none transition-all text-xl tracking-wider text-center lg:text-left ${
                        error ? 'border-red-300 focus:ring-red-100 focus:border-red-500' : 'border-slate-200 focus:ring-brand-100 focus:border-brand-500'
                      }`}
                      disabled={isLoading}
                    />
                  </div>
                  {error && (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-red-500 text-sm mt-2 font-medium"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || cpf.length !== 14}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 text-white font-extrabold py-4 px-4 rounded-xl flex items-center justify-center transition-all shadow-md shadow-brand-100/50 cursor-pointer text-base"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Procurar Meu Nome
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

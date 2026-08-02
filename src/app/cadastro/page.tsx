'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { signInWithRedirect, getRedirectResult, createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password) {
      setError('Preencha todos os campos!');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Sync with Firestore collection 'perfis'
      await setDoc(doc(db, 'perfis', user.uid), {
        email: user.email,
        nome: name,
        brandName: name,
        createdAt: new Date().toISOString(),
        plano: 'gratis'
      });

      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado. Vá para o login.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-email') {
        setError('O formato do e-mail é inválido.');
      } else {
        setError('Ocorreu um erro ao criar a conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error: any) {
      console.error('Erro ao iniciar redirecionamento do Google:', error);
      toast.error('Erro ao conectar com Google. Tente novamente.');
    }
  };

  const GoogleIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.15C1.43 8.55 1 10.22 1 12s.43 3.45 1.15 4.93l3.69-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.15 7.07l3.69 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex w-full">
      {/* Lado Esquerdo - Mensagem Inspiradora */}
      <div className="hidden lg:flex w-1/2 bg-secondary flex-col justify-center px-20 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10">
          <h1 className="text-5xl font-black mb-6 leading-tight">Valorize suas mãos. <br/>Destaque sua arte.</h1>
          <p className="text-xl text-white/80 font-medium">A primeira plataforma feita exclusivamente para artesãos e artesãs do Recôncavo gerenciarem seus negócios com profissionalismo e orgulho.</p>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="w-full lg:w-1/2 bg-background flex flex-col justify-center items-center p-8 md:p-12">
        <div className="w-full max-w-md bg-surface p-10 rounded-[2rem] shadow-sm border-4 border-border">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black text-secondary">AtelIA</h2>
            <p className="text-slate-500 mt-2 font-medium">Junte-se à comunidade e profissionalize seu ateliê hoje.</p>
          </div>

          <button 
            onClick={handleGoogleLogin}
            type="button" 
            className="w-full bg-surface text-slate-700 font-medium text-lg py-4 rounded-xl border-2 border-border hover:bg-background transition-colors flex items-center justify-center gap-3 mb-6"
          >
            <GoogleIcon />
            Entrar com o Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-slate-400 font-medium text-sm">ou</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Seu Nome / Marca</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  value={name} onChange={e => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-border focus:border-primary focus:outline-none transition-colors text-lg"
                  placeholder="Ex: Dona Maria"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="email" 
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-border focus:border-primary focus:outline-none transition-colors text-lg"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="password" 
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-border focus:border-primary focus:outline-none transition-colors text-lg"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm font-medium">
                <AlertCircle size={20} />
                {error}
              </div>
            )}

            <button disabled={loading} type="submit" className="w-full bg-primary hover:bg-primary-hover text-slate-900 font-black text-lg py-4 rounded-xl transition-colors mt-4 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Criar Minha Conta'}
            </button>
          </form>

          <p className="text-center mt-8 text-slate-600 font-medium">
            Já tem uma conta? <Link href="/login" className="text-secondary font-bold hover:underline">Entre aqui</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

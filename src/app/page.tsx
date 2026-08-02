'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { 
  FileText, TrendingUp, Package, Sparkles, Target, Star, 
  ChevronDown, Check, Globe, LayoutGrid, X, Calculator, 
  PieChart, Store, Box, BrainCircuit, MessageSquare, Plus, Minus
} from 'lucide-react';

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) setUserId(user.uid);
    });
    return () => unsubscribe();
  }, []);

  const handleUpgrade = async () => {
    if (!userId) {
      window.location.href = '/cadastro';
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: 'monthly', userId }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.message || "Erro retornado pelo servidor.");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Não foi possível gerar o link de checkout.");
      }
    } catch (error: any) {
      console.error("Erro detalhado no checkout:", error);
      toast.error(error.message || "Erro ao iniciar o checkout. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const faqs = [
    {
      question: "Preciso entender de contabilidade para usar?",
      answer: "Não, de forma alguma. O AtelIA foi desenhado para traduzir toda a complexidade contábil em termos simples e visuais. Nós cuidamos da matemática para que você foque apenas na sua arte."
    },
    {
      question: "Os dados ficam salvos onde?",
      answer: "Tudo fica salvo de forma segura na nuvem (como no seu e-mail). Isso significa que você pode acessar seu estoque e orçamentos pelo celular enquanto está na rua comprando material, ou pelo computador quando estiver no ateliê. Tudo sincronizado em tempo real."
    },
    {
      question: "O plano grátis tem limite de tempo?",
      answer: "Não! Você pode usar o plano grátis pelo tempo que precisar para conhecer a plataforma. Ele tem limites na quantidade de produtos e PDFs gerados, mas nunca expirará."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      
      {/* HEADER */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-6 py-8 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 100 100">
            <rect width="100" height="100" rx="28" fill="var(--color-primary)"></rect>
            <path d="M23,70 Q38,72 48,58 T74,30" fill="none" stroke="var(--color-background)" strokeWidth="7" strokeLinecap="round" strokeDasharray="1 12"></path>
            <circle cx="74" cy="30" r="8" fill="var(--color-background)"></circle>
          </svg>
          <div className="text-2xl font-heading font-bold tracking-tight">Atel<span className="text-primary">IA</span></div>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-bold text-secondary hover:text-primary transition-colors hidden md:block">
            Acessar Painel
          </Link>
          <Link href="/cadastro" className="text-sm font-bold bg-primary text-white px-5 py-2.5 rounded-full hover:bg-primary/90 transition-colors shadow-sm">
            Criar Conta
          </Link>
        </div>
      </motion.header>

      {/* 1. HERO SECTION */}
      <section className="container mx-auto px-6 py-20 md:py-32 flex flex-col items-center text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-4xl mx-auto flex flex-col items-center"
        >
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border shadow-sm mb-8 text-sm font-bold text-secondary">
            <Sparkles size={16} className="text-primary" />
            <span className="uppercase tracking-widest text-xs">A Revolução Criativa Chegou</span>
          </motion.div>
          
          <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl lg:text-8xl font-heading font-black tracking-tight leading-[1.1] mb-6">
            O controle do seu ateliê <br className="hidden sm:block"/><span className="text-primary">na palma da mão.</span>
          </motion.h1>
          
          <motion.p variants={fadeInUp} className="text-xl md:text-2xl text-secondary font-medium max-w-3xl mb-12 leading-relaxed">
            Muito mais que uma calculadora. O AtelIA é o primeiro ERP completo com Inteligência Artificial e um CFO Virtual criado exclusivamente para artesãs.
          </motion.p>
          
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link 
              href="/cadastro" 
              className="relative inline-flex group items-center justify-center bg-primary text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all overflow-hidden shadow-lg"
            >
              <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></span>
              <span className="relative z-10">Criar Conta Grátis</span>
            </Link>
            
            <a 
              href="#planos" 
              className="inline-flex items-center justify-center bg-transparent text-foreground border-2 border-border hover:border-primary font-bold text-lg px-8 py-4 rounded-2xl transition-colors"
            >
              Conhecer o Plano Pro
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* 2. O QUE É O ATELIA (PROBLEMA/SOLUÇÃO) */}
      <section className="bg-surface py-24 md:py-32 border-y border-border">
        <div className="container mx-auto px-6 max-w-4xl text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-5xl font-heading font-black mb-6">
              A robustez de um ERP. <br className="hidden md:block"/>A facilidade de um App.
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-secondary leading-relaxed font-medium">
              Sabemos que você não quer passar horas em planilhas ou decifrando termos contábeis complexos. 
              Somos uma plataforma de gestão desenhada meticulosamente para artesãs que buscam assumir 
              o controle total de suas empresas, sem barreiras técnicas. Nós cuidamos dos números, do estoque 
              e da precificação para que você foque no que faz de melhor: a sua arte.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* NOVO: COMO FUNCIONA (PASSO A PASSO VISUAL) */}
      <section className="container mx-auto px-6 py-24 md:py-32">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-6xl mx-auto"
        >
          <motion.div variants={fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-heading font-black mb-4">Como Funciona?</h2>
            <p className="text-xl text-secondary font-medium">Um fluxo perfeito, do material à venda.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Linha conectora oculta no mobile */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-border -z-10"></div>

            <motion.div variants={fadeInUp} className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-surface border-4 border-background shadow-lg flex items-center justify-center mb-6 relative">
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center text-sm border-2 border-background">1</div>
                <Package size={40} className="text-primary" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-3">Alimente o Estoque</h3>
              <p className="text-secondary font-medium leading-relaxed max-w-sm">
                Cadastre seus insumos, como tecidos e linhas, inserindo o valor que você pagou.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-surface border-4 border-background shadow-lg flex items-center justify-center mb-6 relative">
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center text-sm border-2 border-background">2</div>
                <Calculator size={40} className="text-primary" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-3">Monte sua Peça</h3>
              <p className="text-secondary font-medium leading-relaxed max-w-sm">
                Nossa calculadora inteligente une os insumos consumidos, as horas de trabalho e seus custos invisíveis.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-surface border-4 border-background shadow-lg flex items-center justify-center mb-6 relative">
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center text-sm border-2 border-background">3</div>
                <TrendingUp size={40} className="text-primary" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-3">Venda com Lucro Certo</h3>
              <p className="text-secondary font-medium leading-relaxed max-w-sm">
                Com o preço perfeito definido, gere orçamentos em PDF ou exiba suas peças diretamente na Vitrine Pública.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* NOVO: CONTROLE ABSOLUTO (GRID DE MÓDULOS) */}
      <section className="bg-surface py-24 md:py-32">
        <div className="container mx-auto px-6 max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-heading font-black mb-4">Controle Absoluto.</h2>
            <p className="text-xl text-secondary font-medium">Módulos avançados desenhados para microempreendedoras.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <motion.div variants={fadeInUp} className="bg-background rounded-3xl p-8 shadow-sm border border-border">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <PieChart size={24} className="text-primary" />
              </div>
              <h3 className="text-xl font-heading font-bold mb-4">Financeiro Descomplicado</h3>
              <p className="text-secondary font-medium leading-relaxed">
                Controle de faturamento, registro de despesas, metas de ganhos e previsão de recebimentos em uma dashboard visual e inteligente.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-background rounded-3xl p-8 shadow-sm border border-border">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Store size={24} className="text-primary" />
              </div>
              <h3 className="text-xl font-heading font-bold mb-4">Gestão de Lojas Parceiras</h3>
              <p className="text-secondary font-medium leading-relaxed">
                Envie produtos físicos para mostruários externos, acompanhe consignações e dê baixa no estoque de forma centralizada e sincronizada na nuvem.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-background rounded-3xl p-8 shadow-sm border border-border">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Box size={24} className="text-primary" />
              </div>
              <h3 className="text-xl font-heading font-bold mb-4">Estoque de Pronta Entrega</h3>
              <p className="text-secondary font-medium leading-relaxed">
                Controle exato e instantâneo do que você tem pronto para vender, com visualização do custo de produção oculto para garantir a proteção da sua margem.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* NOVO: SEU TIME DE INTELIGÊNCIA ARTIFICIAL (DARK MODE) */}
      <section className="bg-[#2C2620] text-[#F7F2EC] py-24 md:py-32 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <BrainCircuit size={400} />
        </div>
        
        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center mb-16"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8 text-sm font-bold">
              <Sparkles size={16} className="text-primary" />
              <span className="uppercase tracking-widest text-xs">Exclusividade Plano Pro</span>
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-5xl font-heading font-black mb-6">Seu Time de Inteligência Artificial.</motion.h2>
            <motion.p variants={fadeInUp} className="text-xl opacity-80 max-w-3xl mx-auto font-medium">
              Não ande mais sozinha. O AtelIA traz três assistentes virtuais de ponta treinados especificamente para a realidade do artesanato brasileiro.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* IA 1 */}
            <motion.div variants={fadeInUp} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                <Target size={28} className="text-primary" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-4">CFO Virtual</h3>
              <p className="opacity-80 font-medium leading-relaxed">
                O guardião implacável do seu caixa. Ele analisa ativamente suas métricas, acompanha flutuações de preços de insumos e alerta você imediatamente sobre a saúde financeira e segurança das margens de lucro.
              </p>
            </motion.div>

            {/* IA 2 */}
            <motion.div variants={fadeInUp} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                <Check size={28} className="text-primary" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-4">Conselheira AtelIA</h3>
              <p className="opacity-80 font-medium leading-relaxed">
                A especialista em organização e rotina. Ela ajuda você a estruturar a produção artesanal semanal, sugerindo quais encomendas priorizar para que você nunca mais entregue peças atrasadas.
              </p>
            </motion.div>

            {/* IA 3 */}
            <motion.div variants={fadeInUp} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                <MessageSquare size={28} className="text-primary" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-4">Assistente Empreendedor</h3>
              <p className="opacity-80 font-medium leading-relaxed">
                Foco total em vendas e crescimento. Ele cria ideias de marketing do zero, escreve textos encantadores para as suas redes sociais e ajuda você a elaborar estratégias de vendas para datas comemorativas.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 4. PLANOS E PREÇOS */}
      <section id="planos" className="bg-surface py-24 md:py-32">
        <div className="container mx-auto px-6 max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-heading font-black mb-4">Planos que cabem no seu bolso.</h2>
            <p className="text-xl text-secondary font-medium">Comece de graça e evolua quando estiver pronta.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-center"
          >
            {/* PLANO GRÁTIS */}
            <motion.div variants={fadeInUp} className="bg-background rounded-3xl p-8 border border-border shadow-sm flex flex-col h-full">
              <h3 className="text-2xl font-heading font-black mb-2">Plano Grátis</h3>
              <p className="text-secondary font-medium mb-6">Para quem está começando a se organizar.</p>
              <div className="text-5xl font-heading font-black mb-8">R$ 0<span className="text-xl text-secondary font-medium">/mês</span></div>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-primary shrink-0 mt-0.5" />
                  <span className="font-medium text-foreground">Salva até 5 produtos</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-primary shrink-0 mt-0.5" />
                  <span className="font-medium text-foreground">Precifica até 10 itens</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-primary shrink-0 mt-0.5" />
                  <span className="font-medium text-foreground">1 orçamento em PDF por mês</span>
                </li>
                <li className="flex items-start gap-3 opacity-50">
                  <X size={20} className="text-foreground shrink-0 mt-0.5" />
                  <span className="font-medium text-foreground line-through">Integração com Time de IAs</span>
                </li>
                <li className="flex items-start gap-3 opacity-50">
                  <X size={20} className="text-foreground shrink-0 mt-0.5" />
                  <span className="font-medium text-foreground line-through">Vitrine Pública</span>
                </li>
              </ul>
              
              <Link href="/cadastro" className="mt-auto block w-full py-4 text-center font-bold text-foreground border-2 border-border rounded-xl hover:border-foreground transition-colors">
                Começar Grátis
              </Link>
            </motion.div>

            {/* PLANO PRO */}
            <motion.div variants={fadeInUp} className="bg-primary text-white rounded-3xl p-8 shadow-xl flex flex-col relative md:-my-6 md:py-14 border border-primary/20 h-full md:h-auto">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-foreground text-surface text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
                Mais Popular
              </div>
              <h3 className="text-2xl font-heading font-black mb-2">Plano Pro</h3>
              <p className="text-white/80 font-medium mb-6">O poder completo da Inteligência Artificial.</p>
              <div className="text-5xl font-heading font-black mb-8">R$ 29,90<span className="text-xl text-white/80 font-medium">/mês</span></div>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-white shrink-0 mt-0.5" />
                  <span className="font-medium">Salvar produtos <strong className="bg-white/20 px-2 py-0.5 rounded ml-1">ILIMITADO</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-white shrink-0 mt-0.5" />
                  <span className="font-medium">Precificação <strong className="bg-white/20 px-2 py-0.5 rounded ml-1">ILIMITADA</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-white shrink-0 mt-0.5" />
                  <span className="font-medium">Orçamentos PDF <strong className="bg-white/20 px-2 py-0.5 rounded ml-1">ILIMITADO</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-white shrink-0 mt-0.5" />
                  <span className="font-bold">Acesso total ao Time de IAs</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-white shrink-0 mt-0.5" />
                  <span className="font-bold">Vitrine Pública Habilitada</span>
                </li>
              </ul>
              
              <button 
                onClick={handleUpgrade}
                disabled={loading}
                className="mt-auto block w-full py-4 text-center font-bold text-primary bg-white rounded-xl shadow-lg hover:bg-surface transition-colors disabled:opacity-50"
              >
                {loading ? 'Redirecionando...' : 'Assinar Plano Pro'}
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* A MISSÃO E FUNDADOR (CEO) */}
      <section className="container mx-auto px-6 py-24 md:py-32">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 lg:gap-24"
        >
          <motion.div variants={fadeInUp} className="w-full md:w-1/2">
            <div className="relative aspect-square md:aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl border-4 border-surface">
              <img 
                src="/img/davi_rocha.jpg" 
                alt="Davi Rocha - CEO do AtelIA" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=800";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent"></div>
              <div className="absolute bottom-8 left-8 text-white">
                <h3 className="font-heading font-black text-3xl mb-1">Davi Rocha</h3>
                <p className="font-bold opacity-90 uppercase tracking-widest text-xs">CEO & Fundador</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div variants={fadeInUp} className="w-full md:w-1/2">
            <Star size={32} className="text-primary mb-6" />
            <h2 className="text-3xl md:text-5xl font-heading font-black mb-8">Nossa Missão</h2>
            <div className="space-y-6 text-lg text-secondary font-medium leading-relaxed">
              <p>
                Davi Rocha é o CEO e a mente por trás do AtelIA. Como um jovem empreendedor, conciliando o terceiro ano do ensino médio com a criação de tecnologias focadas em problemas reais, Davi acompanhou de perto a rotina de sua mãe, artesã. 
              </p>
              <p>
                Ao ver a enorme dificuldade que ela enfrentava na hora de precificar seus produtos de forma justa e organizar orçamentos, percebeu que essa era a dor de milhares de empreendedoras criativas.
              </p>
              <p>
                Foi de dentro de casa que nasceu o <strong>AtelIA</strong>: uma plataforma construída para simplificar a gestão complexa e valorizar cada detalhe do trabalho manual.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* NOVO: PERGUNTAS FREQUENTES (FAQ) */}
      <section className="py-24 border-y border-border bg-surface">
        <div className="container mx-auto px-6 max-w-3xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-heading font-black mb-4">Perguntas Frequentes.</h2>
            <p className="text-xl text-secondary font-medium">Tudo o que você precisa saber.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="space-y-4"
          >
            {faqs.map((faq, index) => (
              <motion.div variants={fadeInUp} key={index} className="border border-border rounded-2xl overflow-hidden bg-background">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-black/5 transition-colors"
                >
                  <span className="font-heading font-bold text-lg pr-4">{faq.question}</span>
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${openFaq === index ? 'bg-primary text-white' : 'bg-surface text-secondary'}`}>
                    {openFaq === index ? <Minus size={16} /> : <Plus size={16} />}
                  </div>
                </button>
                
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 text-secondary font-medium leading-relaxed border-t border-border/50 pt-4">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-surface border-t border-border py-16 px-6">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 100 100">
              <rect width="100" height="100" rx="28" fill="var(--color-primary)"></rect>
              <path d="M23,70 Q38,72 48,58 T74,30" fill="none" stroke="var(--color-background)" strokeWidth="7" strokeLinecap="round" strokeDasharray="1 12"></path>
              <circle cx="74" cy="30" r="8" fill="var(--color-background)"></circle>
            </svg>
            <div className="text-2xl font-heading font-bold tracking-tighter">AtelIA</div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-8 text-sm font-bold text-secondary">
            <Link href="#planos" className="hover:text-primary transition-colors">Planos</Link>
            <Link href="#" className="hover:text-primary transition-colors">Instagram</Link>
            <Link href="#" className="hover:text-primary transition-colors">Termos de Uso</Link>
            <Link href="#" className="hover:text-primary transition-colors">Privacidade</Link>
          </div>
          
          <div className="text-sm font-medium text-secondary/60">
            © {new Date().getFullYear()} AtelIA. <br className="md:hidden"/>Todos os direitos reservados.
          </div>
        </div>
      </footer>

    </div>
  );
}

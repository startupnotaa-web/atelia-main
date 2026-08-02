'use client';

import { useState, useEffect } from 'react';
import { Plus, Minus, CheckCircle2, X, ChevronDown, ChevronUp, DollarSign, Clock, Package, Building2, TrendingUp, ShoppingCart, Upload, Loader2 } from 'lucide-react';
import Paywall from '@/components/Paywall';
import { useTenant } from '@/lib/TenantProvider';
import LimitModal from '@/components/LimitModal';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { addCatalogItem } from '@/app/actions/erp';
import { getGreetings } from '@/utils/greetings';
import { uploadImage } from '@/app/actions/upload-image';

type Material = {
  id: string;
  name: string;
  totalCost: number;
  purchasedQuantity: number;
  unit?: string;
  quantityUsed: string;
};

type FixedCost = {
  id: string;
  name: string;
  value: string;
};

const INITIAL_DB: Omit<Material, 'quantityUsed'>[] = [
  { id: '1', name: 'Fio de Malha Premium', totalCost: 35.00, purchasedQuantity: 1000, unit: 'g' },
  { id: '2', name: 'Barbante Cru 24 Fios', totalCost: 20.00, purchasedQuantity: 500, unit: 'g' },
  { id: '3', name: 'Fecho de Metal Dourado', totalCost: 50.00, purchasedQuantity: 10, unit: 'unid' },
];

export default function PricingWizard() {
  const [dbMaterials, setDbMaterials] = useState<Omit<Material, 'quantityUsed'>[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('@artesas/materials');
    if (stored) {
      setDbMaterials(JSON.parse(stored));
    } else {
      setDbMaterials(INITIAL_DB);
      localStorage.setItem('@artesas/materials', JSON.stringify(INITIAL_DB));
    }
  }, []);

  // --- STATE ---
  const [productName, setProductName] = useState('');
  
  // 1. Mão de Obra
  const [monthlySalary, setMonthlySalary] = useState('1500');
  const [workHoursPerMonth, setWorkHoursPerMonth] = useState('130');
  const [hoursOnPiece, setHoursOnPiece] = useState(0);
  const [minutesOnPiece, setMinutesOnPiece] = useState(0);
  
  // 2. Materiais e Embalagem
  const [selectedMaterials, setSelectedMaterials] = useState<Material[]>([]);
  const [packagingCost, setPackagingCost] = useState('0');
  
  // 3. Custos Fixos
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([
    { id: '1', name: 'Aluguel / Condomínio', value: '0' },
    { id: '2', name: 'Luz / Água', value: '0' },
    { id: '3', name: 'Internet / Celular', value: '0' },
  ]);
  const [isFixedCostsOpen, setIsFixedCostsOpen] = useState(false);
  
  // 4. Variáveis e Margem
  const [cardFeePercent, setCardFeePercent] = useState('5');
  const [platformFeePercent, setPlatformFeePercent] = useState('0');
  const [shippingCost, setShippingCost] = useState('0');
  const [profitMargin, setProfitMargin] = useState('30');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMatName, setNewMatName] = useState('');
  const [newMatUnit, setNewMatUnit] = useState('g');
  const [newMatPrice, setNewMatPrice] = useState('');
  const [newMatQty, setNewMatQty] = useState('');

  // Catalog Modal
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogName, setCatalogName] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('');
  const [catalogPhotoUrl, setCatalogPhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitItemName, setLimitItemName] = useState('');

  const parseCurrency = (val: string) => {
    if (!val) return 0;
    const sanitized = val.toString().replace(/[^\d.,]/g, '').replace(',', '.');
    return Number(sanitized) || 0;
  };

  const { canCreateMoreProducts, incrementProductsCreated, pronoun } = useTenant();
  const g = getGreetings(pronoun);

  // --- CALCULATIONS ---
  const salaryNum = parseCurrency(monthlySalary);
  const workHoursNum = parseCurrency(workHoursPerMonth);
  const hourlyRate = workHoursNum > 0 ? salaryNum / workHoursNum : 0;
  
  const laborTimeInHours = hoursOnPiece + (minutesOnPiece / 60);
  const laborCost = hourlyRate * laborTimeInHours;
  
  const materialsCostOnly = selectedMaterials.reduce((acc, mat) => {
    const usedQty = parseCurrency(mat.quantityUsed);
    const costPerUnit = mat.totalCost / mat.purchasedQuantity;
    return acc + (costPerUnit * usedQty);
  }, 0);
  const totalMaterialsAndPackaging = materialsCostOnly + parseCurrency(packagingCost);
  
  const totalFixedMonthly = fixedCosts.reduce((acc, fc) => acc + parseCurrency(fc.value), 0);
  const fixedCostPerHour = workHoursNum > 0 ? totalFixedMonthly / workHoursNum : 0;
  const fixedCostPerPiece = fixedCostPerHour * laborTimeInHours;
  
  const baseCost = laborCost + totalMaterialsAndPackaging + fixedCostPerPiece + parseCurrency(shippingCost);
  
  const cardFee = parseCurrency(cardFeePercent);
  const platformFee = parseCurrency(platformFeePercent);
  const profit = parseCurrency(profitMargin);
  
  const percentageSum = (cardFee + platformFee + profit) / 100;
  // Prevent division by zero or negative if percentages sum to 100% or more
  const safePercentageSum = percentageSum >= 1 ? 0.99 : percentageSum;
  
  const finalPrice = baseCost / (1 - safePercentageSum);
  
  const profitAmount = finalPrice * (profit / 100);
  const feesAmount = finalPrice * ((cardFee + platformFee) / 100);

  // --- HANDLERS ---
  const handleAddExistingMaterial = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id) return;
    const mat = dbMaterials.find(m => m.id === id);
    if (mat && !selectedMaterials.find(m => m.id === id)) {
      setSelectedMaterials([...selectedMaterials, { ...mat, quantityUsed: '' }]);
    }
    e.target.value = ''; 
  };

  const handleSaveNewMaterial = () => {
    if (!newMatName || !newMatPrice || !newMatQty) return alert("Preencha todos os campos do material.");

    const newMaterial = {
      id: Math.random().toString(36).substr(2, 9),
      name: newMatName,
      unit: newMatUnit,
      totalCost: parseCurrency(newMatPrice),
      purchasedQuantity: parseCurrency(newMatQty),
    };

    const updatedDb = [...dbMaterials, newMaterial];
    setDbMaterials(updatedDb);
    localStorage.setItem('@artesas/materials', JSON.stringify(updatedDb));

    setSelectedMaterials([...selectedMaterials, { ...newMaterial, quantityUsed: '' }]);

    setNewMatName('');
    setNewMatPrice('');
    setNewMatQty('');
    setIsModalOpen(false);
  };
  
  const handleAddFixedCost = () => {
    setFixedCosts([...fixedCosts, { id: Math.random().toString(36).substr(2, 9), name: '', value: '0' }]);
  };
  
  const handleUpdateFixedCost = (id: string, field: 'name' | 'value', val: string) => {
    setFixedCosts(fixedCosts.map(fc => fc.id === id ? { ...fc, [field]: val } : fc));
  };
  
  const handleRemoveFixedCost = (id: string) => {
    setFixedCosts(fixedCosts.filter(fc => fc.id !== id));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await uploadImage(formData) as any;
      if (response.success && response.secure_url) {
        setCatalogPhotoUrl(response.secure_url);
      } else {
        alert(response.error || 'Erro ao enviar a imagem.');
      }
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro no upload.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveToCatalog = async () => {
    if (!catalogName || !catalogCategory) {
      alert("Preencha o nome e a categoria.");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      alert(`Você precisa estar ${g.loggedIn} para salvar no catálogo.`);
      return;
    }
    
    try {
      const res = await addCatalogItem({
        nome: catalogName,
        categoria: catalogCategory,
        fotoUrl: catalogPhotoUrl || '',
        precoFinal: finalPrice,
        custoBase: baseCost,
        margemLucro: profit,
        userId: user.uid,
        visivelNaVitrine: true
      });
      
      if (res.success) {
        incrementProductsCreated();
        alert('Produto salvo no catálogo com sucesso!');
        setIsCatalogModalOpen(false);
      } else {
        if (res.error === 'LIMIT_REACHED_PRODUCTS') {
          setIsCatalogModalOpen(false);
          setLimitItemName('Catálogo');
          setLimitModalOpen(true);
        } else {
          alert('Erro ao salvar no catálogo.');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar no catálogo.');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (!canCreateMoreProducts()) {
    return <Paywall title="Limite Atingido" description="Você atingiu o limite de 5 produtos do Plano Grátis. Faça o upgrade para criar produtos ilimitados." />;
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-20">
      
      {/* Header */}
      <div className="bg-surface rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-border p-8 md:p-10">
        <h1 className="text-4xl md:text-5xl font-black text-secondary mb-4">Simulador de Precificação</h1>
        <p className="text-xl text-slate-600 mb-8">
          Preencha os blocos abaixo e deixe a matemática com a gente para descobrir o preço justo e lucrativo.
        </p>
        
        <div>
          <label className="block text-lg font-bold text-slate-900 mb-2">O que estamos precificando?</label>
          <input 
            type="text" 
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Ex: Bolsa de Macramê" 
            className="w-full text-2xl p-6 border-2 border-border rounded-2xl text-slate-900 font-bold focus:border-secondary focus:ring-4 focus:ring-secondary-light transition-all shadow-sm bg-surface"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-8">
          
          {/* BLOCO 1: MÃO DE OBRA */}
          <section className="bg-surface rounded-3xl shadow-sm border border-border p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-secondary-light/30 rounded-xl text-secondary">
                <Clock size={28} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">1. Mão de Obra (O Tempo)</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-6 bg-background rounded-2xl border border-border">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Pró-labore Mensal Desejado</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                  <input type="text" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-border font-bold text-slate-900 focus:border-secondary" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Horas Trabalhadas/Mês</label>
                <div className="relative">
                  <input type="text" value={workHoursPerMonth} onChange={e => setWorkHoursPerMonth(e.target.value)} className="w-full pl-4 pr-12 py-3 rounded-xl border-2 border-border font-bold text-slate-900 focus:border-secondary" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">h</span>
                </div>
              </div>
              <div className="md:col-span-2 flex justify-between items-center text-sm font-medium text-slate-600 bg-surface p-4 rounded-xl border border-border">
                <span>Valor da sua hora calculada:</span>
                <span className="font-bold text-lg text-secondary">{formatCurrency(hourlyRate)}/h</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-4">Tempo dedicado a ESTA peça</label>
              <div className="flex items-center justify-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-slate-500 mb-2">Horas</span>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setHoursOnPiece(Math.max(0, hoursOnPiece - 1))} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"><Minus size={24} /></button>
                    <span className="text-3xl font-black w-12 text-center">{hoursOnPiece}</span>
                    <button onClick={() => setHoursOnPiece(hoursOnPiece + 1)} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"><Plus size={24} /></button>
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-300 mb-[-1.5rem]">:</div>
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-slate-500 mb-2">Minutos</span>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setMinutesOnPiece(Math.max(0, minutesOnPiece - 15))} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"><Minus size={24} /></button>
                    <span className="text-3xl font-black w-16 text-center">{minutesOnPiece}</span>
                    <button onClick={() => setMinutesOnPiece(Math.min(45, minutesOnPiece + 15))} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"><Plus size={24} /></button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* BLOCO 2: MATERIAIS E EMBALAGEM */}
          <section className="bg-surface rounded-3xl shadow-sm border border-border p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-secondary-light/30 rounded-xl text-secondary">
                <Package size={28} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">2. Materiais e Embalagem</h2>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <select 
                onChange={handleAddExistingMaterial}
                className="flex-1 p-4 border-2 border-border rounded-xl font-bold text-slate-700 focus:border-secondary bg-background"
                defaultValue=""
              >
                <option value="" disabled>Buscar do estoque...</option>
                {dbMaterials.filter(dbm => !selectedMaterials.find(sm => sm.id === dbm.id)).map(mat => (
                  <option key={mat.id} value={mat.id}>{mat.name} ({mat.unit})</option>
                ))}
              </select>
              <button onClick={() => setIsModalOpen(true)} className="px-6 py-4 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl flex items-center justify-center gap-2">
                <Plus size={20} /> Novo
              </button>
            </div>

            <div className="space-y-3 mb-6 max-h-[250px] overflow-y-auto pr-2">
              {selectedMaterials.length === 0 && (
                <div className="text-center p-6 border-2 border-dashed border-border rounded-xl text-slate-500 font-medium text-sm">
                  Nenhum material adicionado.
                </div>
              )}
              {selectedMaterials.map((mat, idx) => (
                <div key={idx} className="flex items-center gap-4 bg-background p-4 rounded-xl border border-border">
                  <div className="flex-1 font-bold text-slate-800 line-clamp-1">{mat.name}</div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="Qtd."
                      value={mat.quantityUsed}
                      onChange={(e) => {
                        const newMats = [...selectedMaterials];
                        newMats[idx].quantityUsed = e.target.value;
                        setSelectedMaterials(newMats);
                      }}
                      className="w-20 p-2 text-center border-2 border-border rounded-lg font-bold focus:border-secondary bg-surface"
                    />
                    <span className="font-bold text-slate-500 text-sm w-8">{mat.unit}</span>
                  </div>
                  <button onClick={() => setSelectedMaterials(selectedMaterials.filter(m => m.id !== mat.id))} className="text-slate-400 hover:text-red-500">
                    <X size={24} />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-border">
              <label className="block text-sm font-bold text-slate-700 mb-2">Custo de Embalagem e Brindes (R$)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                <input type="text" value={packagingCost} onChange={e => setPackagingCost(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-border font-bold text-slate-900 focus:border-secondary" placeholder="0,00" />
              </div>
            </div>
          </section>
          
        </div>

        <div className="space-y-8">
          
          {/* BLOCO 3: CUSTOS FIXOS */}
          <section className="bg-surface rounded-3xl shadow-sm border border-border overflow-hidden">
            <button 
              onClick={() => setIsFixedCostsOpen(!isFixedCostsOpen)}
              className="w-full p-8 flex items-center justify-between bg-surface hover:bg-background transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-secondary-light/30 rounded-xl text-secondary">
                  <Building2 size={28} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 text-left">3. Custos Fixos (A Estrutura)</h2>
              </div>
              {isFixedCostsOpen ? <ChevronUp size={28} className="text-slate-400" /> : <ChevronDown size={28} className="text-slate-400" />}
            </button>
            
            {isFixedCostsOpen && (
              <div className="px-8 pb-8 animate-in slide-in-from-top-4 duration-300 border-t border-border pt-6">
                <p className="text-sm text-slate-500 mb-6 font-medium">Liste suas despesas fixas mensais. Vamos calcular o rateio proporcional para as horas desta peça.</p>
                <div className="space-y-3 mb-6">
                  {fixedCosts.map((fc, idx) => (
                    <div key={fc.id} className="flex gap-4 items-center">
                      <input 
                        type="text" 
                        value={fc.name} 
                        onChange={e => handleUpdateFixedCost(fc.id, 'name', e.target.value)}
                        placeholder="Nome (Ex: Aluguel)" 
                        className="flex-1 p-3 rounded-xl border-2 border-border font-medium focus:border-secondary"
                      />
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">R$</span>
                        <input 
                          type="text" 
                          value={fc.value} 
                          onChange={e => handleUpdateFixedCost(fc.id, 'value', e.target.value)}
                          className="w-full pl-9 pr-3 py-3 rounded-xl border-2 border-border font-bold focus:border-secondary"
                        />
                      </div>
                      <button onClick={() => handleRemoveFixedCost(fc.id)} className="text-slate-400 hover:text-red-500 p-2">
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={handleAddFixedCost} className="text-secondary font-bold text-sm flex items-center gap-2 hover:underline">
                  <Plus size={16} /> Adicionar Custo Fixo
                </button>
                
                <div className="mt-8 bg-background p-4 rounded-xl border border-border flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-600">Rateio nesta peça:</span>
                  <span className="font-bold text-lg text-slate-800">{formatCurrency(fixedCostPerPiece)}</span>
                </div>
              </div>
            )}
          </section>

          {/* BLOCO 4: VARIÁVEIS E MARGEM */}
          <section className="bg-surface rounded-3xl shadow-sm border border-border p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-secondary-light/30 rounded-xl text-secondary">
                <TrendingUp size={28} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">4. Custos Variáveis & Margem</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Taxa da Maquininha</label>
                <div className="relative">
                  <input type="text" value={cardFeePercent} onChange={e => setCardFeePercent(e.target.value)} className="w-full pl-4 pr-10 py-4 rounded-xl border-2 border-border font-bold text-slate-900 focus:border-secondary text-right" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Comissão Plataforma</label>
                <div className="relative">
                  <input type="text" value={platformFeePercent} onChange={e => setPlatformFeePercent(e.target.value)} className="w-full pl-4 pr-10 py-4 rounded-xl border-2 border-border font-bold text-slate-900 focus:border-secondary text-right" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Deslocamento / Frete Fixo</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                  <input type="text" value={shippingCost} onChange={e => setShippingCost(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-border font-bold text-slate-900 focus:border-secondary" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-primary mb-2">Margem de Lucro Desejada</label>
                <div className="relative">
                  <input type="text" value={profitMargin} onChange={e => setProfitMargin(e.target.value)} className="w-full pl-4 pr-10 py-4 rounded-xl border-2 border-primary bg-primary/5 font-black text-slate-900 focus:border-secondary text-right" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-primary">%</span>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* PAINEL DE RESULTADO (BLOCO 5 E 6) */}
      <section className="bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 md:p-12 text-white relative overflow-hidden mt-8 border-4 border-slate-800">
        
        {/* Background decors */}
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
           <ShoppingCart size={200} />
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="space-y-6">
            <h3 className="text-3xl font-bold text-slate-300">Preço Sugerido para:<br/><span className="text-white text-4xl mt-2 block">{productName || 'Sua Peça Linda'}</span></h3>
            
            <div className="bg-surface rounded-[2rem] p-8 inline-block shadow-lg border-b-8 border-r-8 border-slate-800">
              <span className="text-slate-500 font-bold text-sm uppercase tracking-wider block mb-2">Preço Final (Markup)</span>
              {/* COR VERDE MUSGO EXIGIDA #4A5D23 */}
              <span className="text-5xl md:text-[5rem] leading-none font-black block tracking-tighter" style={{ color: '#4A5D23' }}>
                {formatCurrency(finalPrice)}
              </span>
            </div>

            <div className="pt-6">
               <button 
                onClick={() => {
                  setCatalogName(productName);
                  setIsCatalogModalOpen(true);
                }}
                className="w-full md:w-auto bg-primary hover:bg-primary-hover text-slate-900 text-xl font-black px-12 py-6 rounded-2xl transition-colors shadow-lg"
              >
                Salvar Produto no Meu Catálogo
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-md rounded-3xl p-8 border border-slate-700/50">
            <h4 className="text-lg font-bold text-slate-300 mb-6 uppercase tracking-wider">Para onde vai o dinheiro?</h4>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Materiais + Embalagem</span>
                <span className="font-bold">{formatCurrency(totalMaterialsAndPackaging)}</span>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-400 h-full" style={{ width: `${(totalMaterialsAndPackaging / finalPrice) * 100}%` }}></div>
              </div>

              <div className="flex justify-between items-center mt-4">
                <span className="text-slate-400 font-medium">Sua Mão de Obra (Pró-labore)</span>
                <span className="font-bold">{formatCurrency(laborCost)}</span>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-400 h-full" style={{ width: `${(laborCost / finalPrice) * 100}%` }}></div>
              </div>

              <div className="flex justify-between items-center mt-4">
                <span className="text-slate-400 font-medium">Rateio Custos Fixos + Deslocamento</span>
                <span className="font-bold">{formatCurrency(fixedCostPerPiece + parseCurrency(shippingCost))}</span>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-orange-400 h-full" style={{ width: `${((fixedCostPerPiece + parseCurrency(shippingCost)) / finalPrice) * 100}%` }}></div>
              </div>

              <div className="flex justify-between items-center mt-4">
                <span className="text-slate-400 font-medium">Taxas (Maquininha/Plataforma)</span>
                <span className="font-bold text-red-300">{formatCurrency(feesAmount)}</span>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-red-400 h-full" style={{ width: `${(feesAmount / finalPrice) * 100}%` }}></div>
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-700">
                <span className="text-primary font-bold text-lg">Lucro Líquido do Ateliê</span>
                <span className="font-black text-2xl text-primary">{formatCurrency(profitAmount)}</span>
              </div>
              <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden mt-2">
                <div className="bg-primary h-full" style={{ width: `${(profitAmount / finalPrice) * 100}%` }}></div>
              </div>
            </div>
            
          </div>
        </div>
      </section>

      {/* MODAL DE NOVO MATERIAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-surface w-full max-w-lg rounded-[2rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 border-2 border-border">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 bg-slate-100 p-2 rounded-full transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-slate-900 mb-8">Novo Material</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nome do Material</label>
                <input 
                  type="text" 
                  value={newMatName} onChange={e => setNewMatName(e.target.value)}
                  placeholder="Ex: Resina Epóxi" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Unidade</label>
                  <select 
                    value={newMatUnit} onChange={e => setNewMatUnit(e.target.value)}
                    className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary bg-surface"
                  >
                    <option value="g">Gramas (g)</option>
                    <option value="kg">Quilos (kg)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="m">Metros (m)</option>
                    <option value="unid">Unidades</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Preço Total Pago</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">R$</span>
                    <input 
                      type="text"
                      value={newMatPrice} onChange={e => setNewMatPrice(e.target.value)}
                      placeholder="0,00" 
                      className="w-full text-lg pl-9 pr-3 py-4 border-2 border-border rounded-xl font-medium focus:border-secondary"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Qtd Total na embalagem comprada</label>
                <input 
                  type="text"
                  value={newMatQty} onChange={e => setNewMatQty(e.target.value)}
                  placeholder="Ex: 500" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary"
                />
              </div>
            </div>

            <button 
              onClick={handleSaveNewMaterial}
              className="w-full mt-8 bg-slate-900 hover:bg-black text-white text-lg font-bold py-4 rounded-xl transition-colors shadow-sm"
            >
              Salvar Material
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CATÁLOGO */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCatalogModalOpen(false)} />
          <div className="relative bg-surface w-full max-w-lg rounded-[2rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 border-2 border-border">
            <button onClick={() => setIsCatalogModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 bg-slate-100 p-2 rounded-full transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-slate-900 mb-8">Salvar no Catálogo</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nome da Peça</label>
                <input 
                  type="text" 
                  value={catalogName} onChange={e => setCatalogName(e.target.value)}
                  placeholder="Ex: Chaveiro de Resina" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Categoria</label>
                <input 
                  type="text" 
                  value={catalogCategory} onChange={e => setCatalogCategory(e.target.value)}
                  placeholder="Ex: Acessórios" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Foto da Peça (opcional)</label>
                <div className="relative w-full">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                  />
                  <div className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden bg-background hover:bg-slate-100 transition-colors">
                    {isUploadingPhoto ? (
                      <div className="flex flex-col items-center text-primary">
                        <Loader2 size={32} className="animate-spin mb-2" />
                        <span className="text-sm font-bold">Enviando...</span>
                      </div>
                    ) : catalogPhotoUrl ? (
                      <img src={catalogPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <Upload size={32} className="mb-2" />
                        <span className="text-sm font-bold">Clique para enviar imagem</span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">Envie uma foto para deixar sua vitrine mais atrativa.</p>
              </div>
            </div>

            <button 
              onClick={handleSaveToCatalog}
              className="w-full mt-8 bg-primary hover:bg-primary-hover text-slate-900 text-lg font-black py-4 rounded-xl transition-colors shadow-sm"
            >
              Confirmar e Salvar
            </button>
          </div>
        </div>
      )}

      <LimitModal 
        isOpen={limitModalOpen} 
        onClose={() => setLimitModalOpen(false)} 
        itemName={limitItemName} 
      />

    </div>
  );
}

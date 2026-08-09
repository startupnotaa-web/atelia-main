'use client';

import { useState, useEffect } from 'react';
import { Plus, X, AlertTriangle, Package, Trash2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

type Material = {
  id: string;
  nome: string;
  custoTotal: number;
  quantidadeTotal: number;
  unidadeMedida: string;
  lowStockAlert?: number;
  currentStock?: number;
  linkedFinanceEntryId?: string;
};

export default function StockGrid() {
  const [dbMaterials, setDbMaterials] = useState<Material[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        const q = query(collection(db, 'estoque'), where('userId', '==', user.uid));
        const unsubscribeDb = onSnapshot(
          q,
          (snap) => {
            const items: Material[] = [];
            snap.forEach(docSnap => {
              const data = docSnap.data();
              items.push({
                id: docSnap.id,
                nome: data.nome || data.name || 'Sem Nome',
                unidadeMedida: data.unidadeMedida || data.unit || 'un',
                custoTotal: data.custoTotal || data.price || data.totalCost || 0,
                quantidadeTotal: data.quantidadeTotal || data.quantity || data.purchasedQuantity || 0,
                currentStock: data.currentStock ?? data.quantidadeTotal ?? data.quantity ?? data.purchasedQuantity ?? 0,
                lowStockAlert: data.lowStockAlert || 0,
                linkedFinanceEntryId: data.linkedFinanceEntryId || '',
              });
            });
            setDbMaterials(items);
          },
          (error) => {
            console.error('Erro ao carregar estoque:', error);
            if (error.code === 'permission-denied') {
              import('react-hot-toast').then(mod => mod.toast.error('Erro ao carregar dados: Permissão negada'));
            } else {
              import('react-hot-toast').then(mod => mod.toast.error('Erro ao carregar estoque.'));
            }
          }
        );
        return () => unsubscribeDb();
      } else {
        setDbMaterials([]);
        setUserId(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // State: Novo Material Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newMatName, setNewMatName] = useState('');
  const [newMatUnit, setNewMatUnit] = useState('g');
  const [newMatPrice, setNewMatPrice] = useState('');
  const [newMatQty, setNewMatQty] = useState('');
  const [newMatAlert, setNewMatAlert] = useState('');

  // State: Reabastecer Modal
  const [restockMaterial, setRestockMaterial] = useState<Material | null>(null);
  const [restockPrice, setRestockPrice] = useState('');
  const [restockQty, setRestockQty] = useState('');

  // States: Finance Integration & Delete
  const [launchFinanceNew, setLaunchFinanceNew] = useState(true);
  const [launchFinanceRestock, setLaunchFinanceRestock] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<Material | null>(null);
  const [deleteFinanceAlso, setDeleteFinanceAlso] = useState(true);

  const parseCurrency = (val: string) => {
    if (!val) return 0;
    const sanitized = val.replace(/[^\d.,]/g, '').replace(',', '.');
    return Number(sanitized) || 0;
  };

  const handleSaveNewMaterial = async () => {
    if (!userId) return alert('Faça login primeiro.');
    if (!newMatName || !newMatPrice || !newMatQty) return alert("Preencha todos os campos obrigatórios.");

    const qty = parseCurrency(newMatQty);
    const cost = parseCurrency(newMatPrice);
    const alertQty = parseCurrency(newMatAlert) || 0;

    let linkedFinanceEntryId = '';
    if (launchFinanceNew && cost > 0) {
      const financeRef = await addDoc(collection(db, 'finance_entries'), {
        userId,
        type: 'saida',
        category: 'Matéria-prima',
        value: cost,
        description: `Compra de insumo: ${newMatName}`,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
      linkedFinanceEntryId = financeRef.id;
    }

    await addDoc(collection(db, 'estoque'), {
      userId,
      nome: newMatName,
      unidadeMedida: newMatUnit,
      custoTotal: cost,
      quantidadeTotal: qty,
      currentStock: qty,
      lowStockAlert: alertQty,
      linkedFinanceEntryId,
      createdAt: new Date().toISOString()
    });

    setNewMatName('');
    setNewMatPrice('');
    setNewMatQty('');
    setNewMatAlert('');
    setIsNewModalOpen(false);
  };

  const handleRestock = async () => {
    if (!userId) return alert('Faça login primeiro.');
    if (!restockMaterial || !restockPrice || !restockQty) return alert("Preencha o valor e quantidade.");

    const addedQty = parseCurrency(restockQty);
    const addedCost = parseCurrency(restockPrice);

    const oldStock = restockMaterial.currentStock ?? restockMaterial.quantidadeTotal;
    const oldCostPerUnit = restockMaterial.quantidadeTotal > 0 ? restockMaterial.custoTotal / restockMaterial.quantidadeTotal : 0;

    const newStock = oldStock + addedQty;
    const newTotalCost = (oldStock * oldCostPerUnit) + addedCost;
    const newQuantidadeTotal = newStock;

    let linkedFinanceEntryId = restockMaterial.linkedFinanceEntryId || '';
    if (launchFinanceRestock && addedCost > 0) {
      const financeRef = await addDoc(collection(db, 'finance_entries'), {
        userId,
        type: 'saida',
        category: 'Matéria-prima',
        value: addedCost,
        description: `Reabastecimento de insumo: ${restockMaterial.nome}`,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
      linkedFinanceEntryId = financeRef.id;
    }

    await updateDoc(doc(db, 'estoque', restockMaterial.id), {
      currentStock: newStock,
      quantidadeTotal: newQuantidadeTotal,
      custoTotal: newTotalCost,
      linkedFinanceEntryId
    });

    setRestockMaterial(null);
    setRestockPrice('');
    setRestockQty('');
  };

  const handleDeleteMaterial = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'estoque', itemToDelete.id));
      if (itemToDelete.linkedFinanceEntryId && deleteFinanceAlso) {
        await deleteDoc(doc(db, 'finance_entries', itemToDelete.linkedFinanceEntryId));
      }
    } catch(e) {
      console.error(e);
      alert('Erro ao excluir material');
    }
    setItemToDelete(null);
  };

  return (
    <div className="w-full">
      {/* Header com Botão de Novo Material */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-secondary">Estoque de Materiais</h1>
          <p className="text-xl text-slate-600 mt-2">Controle seu estoque e seja avisado/a quando algo estiver a acabar.</p>
        </div>
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="bg-primary hover:bg-primary-hover text-slate-900 text-xl font-bold py-4 px-8 rounded-2xl transition-colors shadow-lg border-2 border-primary flex items-center gap-2 w-full md:w-auto justify-center"
        >
          <Plus size={28} /> Registrar Novo Material
        </button>
      </div>

      {/* Grid de Cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {dbMaterials.map(mat => {
          const stock = mat.currentStock ?? mat.quantidadeTotal;
          const alertQty = mat.lowStockAlert ?? 0;
          const isLowStock = stock <= alertQty;
          const unitCost = mat.quantidadeTotal > 0 ? mat.custoTotal / mat.quantidadeTotal : 0;

          return (
            <div 
              key={mat.id} 
              className={`bg-surface rounded-[2rem] p-8 shadow-sm flex flex-col justify-between border-4 transition-all hover:shadow-md ${
                isLowStock ? 'border-alert' : 'border-border'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-2xl font-bold text-secondary leading-tight flex-1 pr-4">{mat.nome}</h3>
                  <div className="flex gap-2 items-center">
                    {isLowStock && (
                      <div className="bg-alert/10 text-alert px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1 border border-alert/20 whitespace-nowrap">
                        <AlertTriangle size={16} /> A Acabar!
                      </div>
                    )}
                    <button onClick={() => setItemToDelete(mat)} className="text-slate-400 hover:text-red-500 transition-colors p-2 bg-background hover:bg-red-50 rounded-xl">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Qtd. Disponível</p>
                    <div className={`text-4xl font-black flex items-end gap-2 ${isLowStock ? 'text-alert' : 'text-slate-900'}`}>
                      {stock.toLocaleString('pt-BR')} <span className="text-xl font-bold text-slate-500 mb-1">{mat.unidadeMedida}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Custo Médio</p>
                      <p className="text-xl font-bold text-success">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unitCost)} <span className="text-sm font-medium text-slate-500">/{mat.unidadeMedida}</span>
                      </p>
                    </div>
                    {alertQty > 0 && (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Alerta Mín.</p>
                        <p className="text-lg font-bold text-slate-700">{alertQty} {mat.unidadeMedida}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setRestockMaterial(mat)}
                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 border-2 border-border text-lg"
              >
                <Plus size={24} /> Reabastecer
              </button>
            </div>
          );
        })}
      </div>

      {dbMaterials.length === 0 && (
        <div className="text-center p-16 border-4 border-dashed border-[#FFAA00]/20 rounded-[2rem] bg-[#FDFBF7] mt-8">
          <Package size={64} className="mx-auto text-foreground/30 mb-4" />
          <h2 className="text-3xl font-black text-foreground mb-3">A sua despensa está vazia!</h2>
          <p className="text-xl text-foreground/70 font-medium max-w-md mx-auto mb-8">Vamos organizar o seu primeiro material?</p>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-primary hover:bg-[#e69900] text-foreground text-xl font-black py-4 px-8 rounded-2xl transition-colors shadow-lg border-2 border-[#FFAA00] inline-flex items-center gap-2"
          >
            <Plus size={28} /> Cadastrar Primeiro Material
          </button>
        </div>
      )}

      {/* MODAL DE NOVO MATERIAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsNewModalOpen(false)} />
          <div className="relative bg-surface w-full max-w-lg rounded-[2rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 border-2 border-border max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsNewModalOpen(false)} className="absolute top-6 right-6 text-slate-900 hover:text-black hover:bg-slate-100 p-2 rounded-full transition-colors">
              <X size={40} />
            </button>
            <h3 className="text-3xl font-bold text-secondary mb-8">Novo Material</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xl font-semibold text-slate-900 mb-3">Nome do Material</label>
                <input 
                  type="text" 
                  value={newMatName} onChange={e => setNewMatName(e.target.value)}
                  placeholder="Ex: Resina Epóxi" 
                  className="w-full text-2xl p-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-medium focus:border-secondary focus:ring-4 focus:ring-secondary-light"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xl font-semibold text-slate-900 mb-3">Unidade</label>
                  <select 
                    value={newMatUnit} onChange={e => setNewMatUnit(e.target.value)}
                    className="w-full text-2xl p-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-medium focus:border-secondary focus:ring-4 focus:ring-secondary-light bg-surface"
                  >
                    <option value="un">Unidades (un)</option>
                    <option value="g">Gramas (g)</option>
                    <option value="kg">Quilogramas (kg)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="l">Litros (l)</option>
                    <option value="m">Metros (m)</option>
                    <option value="cm">Centímetros (cm)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xl font-semibold text-slate-900 mb-3">Preço Total Pago</label>
                  <input 
                    type="text" inputMode="decimal"
                    value={newMatPrice} onChange={e => setNewMatPrice(e.target.value)}
                    placeholder="R$ 0,00" 
                    className="w-full text-2xl p-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-medium focus:border-secondary focus:ring-4 focus:ring-secondary-light"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xl font-semibold text-slate-900 mb-3">Qtd. Total (Embalagem)</label>
                  <input 
                    type="text" inputMode="decimal"
                    value={newMatQty} onChange={e => setNewMatQty(e.target.value)}
                    placeholder="Ex: 500" 
                    className="w-full text-2xl p-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-medium focus:border-secondary focus:ring-4 focus:ring-secondary-light"
                  />
                </div>
                <div>
                  <label className="block text-xl font-semibold text-slate-900 mb-3">Alerta Stock Baixo</label>
                  <input 
                    type="text" inputMode="decimal"
                    value={newMatAlert} onChange={e => setNewMatAlert(e.target.value)}
                    placeholder="Ex: 50" 
                    className="w-full text-2xl p-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-medium focus:border-secondary focus:ring-4 focus:ring-secondary-light"
                  />
                </div>
              </div>
              <div className="mt-4 p-4 bg-background border-2 border-border rounded-xl flex items-center gap-3">
                <input type="checkbox" id="launchFinance" checked={launchFinanceNew} onChange={e => setLaunchFinanceNew(e.target.checked)} className="w-6 h-6 text-primary rounded-lg focus:ring-primary accent-primary" />
                <label htmlFor="launchFinance" className="text-lg font-bold text-slate-700 select-none cursor-pointer">Lançar valor no Financeiro como despesa</label>
              </div>
            </div>

            <button 
              onClick={handleSaveNewMaterial}
              className="w-full mt-10 bg-primary hover:bg-primary-hover text-slate-900 text-3xl font-bold py-6 rounded-2xl transition-colors shadow-sm"
            >
              Salvar Material
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE REABASTECIMENTO */}
      {restockMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRestockMaterial(null)} />
          <div className="relative bg-surface w-full max-w-md rounded-[2rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 border-2 border-border">
            <button onClick={() => setRestockMaterial(null)} className="absolute top-6 right-6 text-slate-900 hover:text-black hover:bg-slate-100 p-2 rounded-full transition-colors">
              <X size={40} />
            </button>
            <h3 className="text-3xl font-bold text-secondary mb-2">Reabastecer</h3>
            <p className="text-lg font-medium text-slate-500 mb-8">{restockMaterial.nome}</p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xl font-semibold text-slate-900 mb-3">Valor Pago nesta compra</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-slate-500 font-bold">R$</span>
                  <input 
                    type="text" inputMode="decimal"
                    value={restockPrice} onChange={e => setRestockPrice(e.target.value)}
                    placeholder="0,00" 
                    className="w-full text-3xl pl-16 pr-6 py-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-bold focus:border-secondary focus:ring-4 focus:ring-secondary-light"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xl font-semibold text-slate-900 mb-3">Qtd. Comprada ({restockMaterial.unidadeMedida})</label>
                <input 
                  type="text" inputMode="decimal"
                  value={restockQty} onChange={e => setRestockQty(e.target.value)}
                  placeholder={`Ex: 500`} 
                  className="w-full text-3xl p-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-bold focus:border-secondary focus:ring-4 focus:ring-secondary-light text-center"
                />
              </div>
              <div className="mt-4 p-4 bg-background border-2 border-border rounded-xl flex items-center gap-3">
                <input type="checkbox" id="launchFinanceRestock" checked={launchFinanceRestock} onChange={e => setLaunchFinanceRestock(e.target.checked)} className="w-6 h-6 text-secondary rounded-lg focus:ring-secondary accent-secondary" />
                <label htmlFor="launchFinanceRestock" className="text-lg font-bold text-slate-700 select-none cursor-pointer">Lançar valor no Financeiro como despesa</label>
              </div>
            </div>

            <button 
              onClick={handleRestock}
              className="w-full mt-10 bg-secondary hover:bg-secondary-hover text-white text-2xl font-bold py-6 rounded-2xl transition-colors shadow-lg"
            >
              Confirmar Chegada
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setItemToDelete(null)} />
          <div className="relative bg-surface w-full max-w-md rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border-2 border-border">
            <h3 className="text-2xl font-black text-red-600 mb-2">Excluir Insumo</h3>
            <p className="text-slate-600 font-medium mb-6">Tem certeza que deseja excluir o material <strong>{itemToDelete.nome}</strong>? Esta ação não pode ser desfeita.</p>
            
            {itemToDelete.linkedFinanceEntryId && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-100 rounded-xl flex items-start gap-3">
                <input type="checkbox" id="deleteFinanceAlso" checked={deleteFinanceAlso} onChange={e => setDeleteFinanceAlso(e.target.checked)} className="w-5 h-5 mt-0.5 text-red-600 rounded focus:ring-red-500 accent-red-600" />
                <label htmlFor="deleteFinanceAlso" className="text-sm font-bold text-red-800 select-none cursor-pointer">
                  Excluir também o lançamento de despesa gerado no Financeiro para este insumo.
                </label>
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={() => setItemToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl transition-colors">Cancelar</button>
              <button onClick={handleDeleteMaterial} className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2">
                <Trash2 size={20} /> Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

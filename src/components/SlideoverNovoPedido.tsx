'use client';

import { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Minus,
  Check,
  ShoppingBag,
  Clock,
  User,
  Phone,
  Package,
  Trash2,
} from 'lucide-react';

// ============================================================
// TIPOS EXPORTADOS
// ============================================================

export type TipoPedido = 'rapida' | 'encomenda';
export type StatusFinanceiro = 'pendente' | 'sinal_pago' | 'pago';

export interface Cliente {
  id: string;
  nome: string;
  whatsapp: string;
}

export interface Produto {
  id: string;
  nome: string;
  preco: number;
  categoria: string;
}

export interface ItemPedido {
  produto: Produto;
  quantidade: number;
}

export interface NovoRegistro {
  tipo: TipoPedido;
  cliente: Cliente;
  itens: ItemPedido[];
  dataEntrega?: string;
  statusFinanceiro: StatusFinanceiro;
  valorTotal: number;
}

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { fetchClients } from '@/app/actions/clientes';

// ============================================================
// HELPERS
// ============================================================

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function formatWhatsapp(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2)  return d;
  if (d.length <= 7)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return d;
}

function formatDateBR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR').format(new Date(y, m - 1, d));
}

// ============================================================
// SUB-COMPONENTE: CALENDÁRIO ACESSÍVEL
// ============================================================

const MESES_PT  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DSEMANA   = ['D','S','T','Q','Q','S','S'];

function CalendarioEntrega({
  dataSelecionada,
  onChange,
}: {
  dataSelecionada: string;
  onChange: (iso: string) => void;
}) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [visor, setVisor] = useState(() => {
    if (dataSelecionada) {
      const [y, m] = dataSelecionada.split('-').map(Number);
      return { ano: y, mes: m - 1 };
    }
    return { ano: hoje.getFullYear(), mes: hoje.getMonth() };
  });

  const { ano, mes } = visor;
  const primeiroDia  = new Date(ano, mes, 1).getDay();
  const totalDias    = new Date(ano, mes + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function toISO(dia: number) {
    return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }
  function isPassado(dia: number) {
    const d = new Date(ano, mes, dia);
    d.setHours(0, 0, 0, 0);
    return d < hoje;
  }
  function isSel(dia: number)  { return dataSelecionada === toISO(dia); }
  function isHoje(dia: number) {
    return ano === hoje.getFullYear() && mes === hoje.getMonth() && dia === hoje.getDate();
  }

  function mesAnterior() {
    setVisor(v => v.mes === 0 ? { ano: v.ano - 1, mes: 11 } : { ...v, mes: v.mes - 1 });
  }
  function proximoMes() {
    setVisor(v => v.mes === 11 ? { ano: v.ano + 1, mes: 0 } : { ...v, mes: v.mes + 1 });
  }

  return (
    <div className="bg-background border-2 border-border rounded-[1.5rem] p-4 select-none">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={mesAnterior}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface transition-colors"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={22} className="text-slate-600" />
        </button>
        <span className="text-lg font-black text-slate-900">
          {MESES_PT[mes]} {ano}
        </span>
        <button
          type="button"
          onClick={proximoMes}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface transition-colors"
          aria-label="Próximo mês"
        >
          <ChevronRight size={22} className="text-slate-600" />
        </button>
      </div>

      {/* Labels de dia */}
      <div className="grid grid-cols-7 mb-1">
        {DSEMANA.map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-slate-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dia, idx) => {
          if (!dia) return <div key={`e-${idx}`} />;
          const passado = isPassado(dia);
          const sel     = isSel(dia);
          const hj      = isHoje(dia);

          return (
            <button
              key={dia}
              type="button"
              onClick={() => !passado && onChange(toISO(dia))}
              disabled={passado}
              aria-label={`${dia} de ${MESES_PT[mes]}`}
              aria-pressed={sel}
              className={[
                'h-11 w-full flex items-center justify-center rounded-xl text-base font-bold transition-all',
                passado
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'hover:bg-primary/20 cursor-pointer active:scale-95',
                sel  ? 'bg-primary text-slate-900 shadow-md scale-105' : '',
                hj && !sel ? 'border-2 border-primary text-primary' : '',
                !sel && !hj && !passado ? 'text-slate-700' : '',
              ].join(' ')}
            >
              {dia}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTE: INDICADOR DE ETAPAS
// ============================================================

function IndicadorEtapas({ etapaAtual, rotulos }: { etapaAtual: number; rotulos: string[] }) {
  return (
    <div className="flex items-center justify-center">
      {rotulos.map((rotulo, i) => {
        const num       = i + 1;
        const concluida = num < etapaAtual;
        const ativa     = num === etapaAtual;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1 min-w-[56px]">
              <div
                className={[
                  'w-10 h-10 rounded-full flex items-center justify-center font-black text-base transition-all duration-300',
                  concluida ? 'bg-success text-white' : '',
                  ativa     ? 'bg-secondary text-white ring-4 ring-secondary/20' : '',
                  !concluida && !ativa ? 'bg-slate-200 text-slate-400' : '',
                ].join(' ')}
              >
                {concluida ? <Check size={18} /> : num}
              </div>
              <span
                className={[
                  'text-[10px] font-bold leading-tight text-center',
                  ativa ? 'text-secondary' : 'text-slate-400',
                ].join(' ')}
              >
                {rotulo}
              </span>
            </div>
            {i < rotulos.length - 1 && (
              <div
                className={[
                  'w-8 h-0.5 mb-5 transition-colors duration-300',
                  concluida ? 'bg-success' : 'bg-slate-200',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// ETAPA 1 — TIPO DE REGISTRO
// ============================================================

function Etapa1Tipo({
  tipo,
  onSelect,
}: {
  tipo: TipoPedido | null;
  onSelect: (t: TipoPedido) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-2xl font-black text-slate-900 mb-1">O que vai registrar?</h3>
        <p className="text-base text-slate-500 font-medium">Escolha como foi essa venda</p>
      </div>

      <div className="flex flex-col gap-4 mt-2">
        {/* Venda Rápida */}
        <button
          type="button"
          id="btn-tipo-rapida"
          onClick={() => onSelect('rapida')}
          className={[
            'flex items-center gap-5 p-6 rounded-[1.5rem] border-2 transition-all text-left',
            tipo === 'rapida'
              ? 'border-primary bg-primary/10 shadow-md'
              : 'border-border hover:border-primary/60 hover:bg-primary/5',
          ].join(' ')}
        >
          <div className={`p-4 rounded-2xl shrink-0 ${tipo === 'rapida' ? 'bg-primary' : 'bg-slate-100'}`}>
            <ShoppingBag size={32} className={tipo === 'rapida' ? 'text-slate-900' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <p className="text-xl font-black text-slate-900">Venda Rápida</p>
            <p className="text-base text-slate-500 font-medium mt-1">
              Produto pronto, pagamento na hora. Sem prazo de entrega.
            </p>
          </div>
          {tipo === 'rapida' && (
            <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center shrink-0">
              <Check size={16} className="text-slate-900" />
            </div>
          )}
        </button>

        {/* Encomenda */}
        <button
          type="button"
          id="btn-tipo-encomenda"
          onClick={() => onSelect('encomenda')}
          className={[
            'flex items-center gap-5 p-6 rounded-[1.5rem] border-2 transition-all text-left',
            tipo === 'encomenda'
              ? 'border-secondary bg-secondary/10 shadow-md'
              : 'border-border hover:border-secondary/40 hover:bg-secondary/5',
          ].join(' ')}
        >
          <div className={`p-4 rounded-2xl shrink-0 ${tipo === 'encomenda' ? 'bg-secondary' : 'bg-slate-100'}`}>
            <Clock size={32} className={tipo === 'encomenda' ? 'text-white' : 'text-slate-500'} />
          </div>
          <div className="flex-1">
            <p className="text-xl font-black text-slate-900">Encomenda</p>
            <p className="text-base text-slate-500 font-medium mt-1">
              A cliente pediu e você vai produzir. Tem data de entrega.
            </p>
          </div>
          {tipo === 'encomenda' && (
            <div className="w-7 h-7 bg-secondary rounded-full flex items-center justify-center shrink-0">
              <Check size={16} className="text-white" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ETAPA 2 — SELEÇÃO DE CLIENTE
// ============================================================

function Etapa2Cliente({
  clienteSelecionado,
  onSelect,
}: {
  clienteSelecionado: Cliente | null;
  onSelect: (c: Cliente | null) => void;
}) {
  const [busca, setBusca]             = useState('');
  const [modoNova, setModoNova]       = useState(false);
  const [novoNome, setNovoNome]       = useState('');
  const [novoWpp, setNovoWpp]         = useState('');
  
  const [clientesBase, setClientesBase] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const fetchedClients = await fetchClients(userId);
        const data: Cliente[] = fetchedClients.map(c => ({ id: c.id, nome: c.name, whatsapp: c.phone }));
        setClientesBase(data);
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClientes();
  }, []);

  const listaFiltrada = clientesBase.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  function salvarNova() {
    if (!novoNome.trim()) return;
    const nova: Cliente = {
      id: `c-${Date.now()}`,
      nome: novoNome.trim(),
      whatsapp: novoWpp,
    };
    onSelect(nova);
    setModoNova(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-slate-900 mb-1">Qual é a cliente?</h3>
        <p className="text-base text-slate-500 font-medium">Busque pelo nome ou cadastre uma nova</p>
      </div>

      {/* Badge de cliente selecionado */}
      {clienteSelecionado && !modoNova && (
        <div className="flex items-center gap-3 p-4 bg-success/10 border-2 border-success rounded-2xl">
          <div className="w-10 h-10 bg-success rounded-full flex items-center justify-center shrink-0">
            <User size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-slate-900 truncate">{clienteSelecionado.nome}</p>
            {clienteSelecionado.whatsapp && (
              <p className="text-sm text-slate-500 font-medium">
                {formatWhatsapp(clienteSelecionado.whatsapp)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-slate-400 hover:text-alert transition-colors p-1 shrink-0"
            aria-label="Trocar cliente"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {!modoNova && (
        <>
          {/* Campo de busca */}
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar cliente pelo nome..."
              className="w-full pl-12 pr-4 py-4 border-2 border-border rounded-2xl text-base font-semibold text-slate-900 focus:outline-none focus:border-secondary bg-surface transition-colors"
              autoComplete="off"
            />
          </div>

          {/* Lista de clientes */}
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {listaFiltrada.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className={[
                  'w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all',
                  clienteSelecionado?.id === c.id
                    ? 'border-success bg-success/10'
                    : 'border-border bg-surface hover:border-secondary/30 hover:bg-secondary/5',
                ].join(' ')}
              >
                <div className="w-9 h-9 bg-secondary/10 rounded-full flex items-center justify-center shrink-0">
                  <User size={17} className="text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-slate-900 truncate">{c.nome}</p>
                  <p className="text-sm text-slate-400 font-medium">{formatWhatsapp(c.whatsapp)}</p>
                </div>
                {clienteSelecionado?.id === c.id && (
                  <Check size={18} className="text-success shrink-0" />
                )}
              </button>
            ))}
            {isLoading && (
              <p className="text-center text-slate-400 font-medium py-6">Carregando clientes...</p>
            )}
            {!isLoading && listaFiltrada.length === 0 && (
              <p className="text-center text-slate-400 font-medium py-6">
                Nenhuma cliente encontrada 🔍
              </p>
            )}
          </div>

          {/* Botão nova cliente */}
          <button
            type="button"
            onClick={() => setModoNova(true)}
            className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-primary rounded-2xl text-base font-bold text-primary hover:bg-primary/5 transition-colors"
          >
            <Plus size={20} />
            + Nova Cliente
          </button>
        </>
      )}

      {/* Formulário inline de nova cliente */}
      {modoNova && (
        <div className="bg-primary/5 border-2 border-primary rounded-[1.5rem] p-5 space-y-4">
          <p className="text-lg font-black text-slate-900">Cadastrar Nova Cliente</p>

          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1.5">
              Nome Completo *
            </label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder="Ex: Maria da Silva"
                autoFocus
                className="w-full pl-11 pr-4 py-4 border-2 border-border rounded-2xl text-base font-semibold text-slate-900 focus:outline-none focus:border-secondary bg-surface transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1.5">
              WhatsApp
            </label>
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="tel"
                value={novoWpp}
                onChange={e => setNovoWpp(formatWhatsapp(e.target.value))}
                placeholder="(71) 99999-0000"
                className="w-full pl-11 pr-4 py-4 border-2 border-border rounded-2xl text-base font-semibold text-slate-900 focus:outline-none focus:border-secondary bg-surface transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setModoNova(false)}
              className="flex-1 py-4 rounded-2xl border-2 border-border text-base font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvarNova}
              disabled={!novoNome.trim()}
              className="flex-1 py-4 rounded-2xl bg-secondary text-white text-base font-bold hover:bg-secondary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Salvar Cliente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ETAPA 3 — SELEÇÃO DE PRODUTOS
// ============================================================

function Etapa3Produtos({
  itens,
  onChange,
}: {
  itens: ItemPedido[];
  onChange: (itens: ItemPedido[]) => void;
}) {
  const [busca, setBusca] = useState('');
  const [produtosBase, setProdutosBase] = useState<Produto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProdutos = async () => {
      auth.onAuthStateChanged(async (user) => {
        if (user) {
          try {
            const q = query(collection(db, 'catalogo'), where('userId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            const data: Produto[] = [];
            querySnapshot.forEach((doc) => {
              const d = doc.data();
              data.push({ id: doc.id, nome: d.nome, preco: d.precoFinal, categoria: d.categoria || '' });
            });
            setProdutosBase(data);
          } catch (error) {
            console.error("Erro ao buscar produtos:", error);
          }
        }
        setIsLoading(false);
      });
    };
    fetchProdutos();
  }, []);

  const total = itens.reduce((s, i) => s + i.produto.preco * i.quantidade, 0);

  const filtrados = produtosBase.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busca.toLowerCase())
  );

  function adicionar(p: Produto) {
    const existe = itens.find(i => i.produto.id === p.id);
    if (existe) {
      onChange(itens.map(i =>
        i.produto.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i
      ));
    } else {
      onChange([...itens, { produto: p, quantidade: 1 }]);
    }
  }

  function remover(id: string) {
    onChange(itens.filter(i => i.produto.id !== id));
  }

  function alterarQtd(id: string, delta: number) {
    onChange(
      itens
        .map(i => i.produto.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i)
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-slate-900 mb-1">Quais produtos?</h3>
        <p className="text-base text-slate-500 font-medium">Adicione um ou mais itens ao pedido</p>
      </div>

      {/* Itens selecionados */}
      {itens.length > 0 && (
        <div className="bg-secondary/5 border-2 border-secondary/20 rounded-[1.5rem] p-4 space-y-3">
          <p className="text-xs font-black text-secondary uppercase tracking-wider">
            Itens do Pedido
          </p>
          {itens.map(item => (
            <div
              key={item.produto.id}
              className="flex items-center gap-3 bg-surface rounded-2xl p-3 border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{item.produto.nome}</p>
                <p className="text-xs text-slate-400 font-medium">{formatCurrency(item.produto.preco)} cada</p>
              </div>

              {/* Qtd ─ */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => alterarQtd(item.produto.id, -1)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  aria-label="Diminuir"
                >
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center text-base font-black text-slate-900">
                  {item.quantidade}
                </span>
                <button
                  type="button"
                  onClick={() => alterarQtd(item.produto.id, 1)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  aria-label="Aumentar"
                >
                  <Plus size={13} />
                </button>
              </div>

              <span className="text-base font-black text-slate-900 w-20 text-right shrink-0">
                {formatCurrency(item.produto.preco * item.quantidade)}
              </span>

              <button
                type="button"
                onClick={() => remover(item.produto.id)}
                className="text-slate-300 hover:text-alert transition-colors p-1 shrink-0"
                aria-label="Remover produto"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t border-secondary/20">
            <span className="text-sm font-bold text-slate-500">Total do Pedido</span>
            <span className="text-xl font-black text-secondary">{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      {/* Busca de produtos */}
      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar produto ou categoria..."
          className="w-full pl-12 pr-4 py-4 border-2 border-border rounded-2xl text-base font-semibold text-slate-900 focus:outline-none focus:border-secondary bg-surface transition-colors"
          autoComplete="off"
        />
      </div>

      {/* Lista de produtos */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {filtrados.map(p => {
          const noCarrinho = itens.find(i => i.produto.id === p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => adicionar(p)}
              className={[
                'w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all',
                noCarrinho
                  ? 'border-secondary/40 bg-secondary/5'
                  : 'border-border bg-surface hover:border-secondary/30 hover:bg-secondary/5',
              ].join(' ')}
            >
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <Package size={17} className="text-yellow-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-slate-900 truncate">{p.nome}</p>
                <p className="text-xs text-slate-400 font-medium">{p.categoria}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-black text-slate-900">{formatCurrency(p.preco)}</p>
                {noCarrinho && (
                  <p className="text-xs text-secondary font-bold">{noCarrinho.quantidade}× adicionado</p>
                )}
              </div>
            </button>
          );
        })}
        {isLoading && (
          <p className="text-center text-slate-400 font-medium py-6">Carregando produtos...</p>
        )}
        {!isLoading && filtrados.length === 0 && (
          <p className="text-center text-slate-400 font-medium py-6">
            Nenhum produto encontrado 🔍
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ETAPA 4 — DETALHES DA ENCOMENDA (condicional)
// ============================================================

function Etapa4Encomenda({
  dataEntrega,
  onDataChange,
  pagamento,
  onPagamentoChange,
  valorTotal,
}: {
  dataEntrega: string;
  onDataChange: (d: string) => void;
  pagamento: 'sinal_50' | 'tudo';
  onPagamentoChange: (p: 'sinal_50' | 'tudo') => void;
  valorTotal: number;
}) {
  const sinal = valorTotal * 0.5;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-2xl font-black text-slate-900 mb-1">Detalhes da Encomenda</h3>
        <p className="text-base text-slate-500 font-medium">Quando entregar e como vai receber o pagamento?</p>
      </div>

      {/* Calendário */}
      <div>
        <p className="text-sm font-black text-slate-700 mb-2 flex items-center gap-2">
          📅 Data de Entrega
          {dataEntrega && (
            <span className="text-primary font-bold">{formatDateBR(dataEntrega)}</span>
          )}
        </p>
        <CalendarioEntrega dataSelecionada={dataEntrega} onChange={onDataChange} />
      </div>

      {/* Pagamento */}
      <div>
        <p className="text-sm font-black text-slate-700 mb-3">💰 Pagamento do Sinal</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            id="btn-pagamento-sinal"
            onClick={() => onPagamentoChange('sinal_50')}
            className={[
              'flex flex-col items-center gap-2 p-5 rounded-[1.5rem] border-2 transition-all',
              pagamento === 'sinal_50'
                ? 'border-primary bg-primary/10 shadow-md'
                : 'border-border hover:border-primary/50 hover:bg-primary/5',
            ].join(' ')}
          >
            <span className="text-3xl font-black text-slate-900">50%</span>
            <span className="text-sm font-bold text-slate-600">Sinal agora</span>
            <span className="text-lg font-black text-primary">{formatCurrency(sinal)}</span>
            {pagamento === 'sinal_50' && (
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center mt-1">
                <Check size={14} className="text-slate-900" />
              </div>
            )}
          </button>

          <button
            type="button"
            id="btn-pagamento-tudo"
            onClick={() => onPagamentoChange('tudo')}
            className={[
              'flex flex-col items-center gap-2 p-5 rounded-[1.5rem] border-2 transition-all',
              pagamento === 'tudo'
                ? 'border-success bg-success/10 shadow-md'
                : 'border-border hover:border-success/50 hover:bg-success/5',
            ].join(' ')}
          >
            <span className="text-3xl font-black text-slate-900">100%</span>
            <span className="text-sm font-bold text-slate-600">Pagar Tudo</span>
            <span className="text-lg font-black text-success">{formatCurrency(valorTotal)}</span>
            {pagamento === 'tudo' && (
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center mt-1">
                <Check size={14} className="text-white" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL — SLIDE-OVER
// ============================================================

interface SlideoverProps {
  isOpen: boolean;
  onFechar: () => void;
  onConfirmar: (registro: NovoRegistro) => void;
}

export default function SlideoverNovoPedido({ isOpen, onFechar, onConfirmar }: SlideoverProps) {
  // Controla a animação CSS (deve ser separado do isOpen para permitir fade-out)
  const [isVisible, setIsVisible] = useState(false);

  // Estado do formulário
  const [etapa,       setEtapa]       = useState(1);
  const [tipo,        setTipo]        = useState<TipoPedido | null>(null);
  const [cliente,     setCliente]     = useState<Cliente | null>(null);
  const [itens,       setItens]       = useState<ItemPedido[]>([]);
  const [dataEntrega, setDataEntrega] = useState('');
  const [pagamento,   setPagamento]   = useState<'sinal_50' | 'tudo'>('sinal_50');

  // Entra com animação após mount
  useEffect(() => {
    if (isOpen) {
      // Duplo rAF garante que o browser aplicou o estado inicial antes da transição
      requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Configuração de etapas ──────────────────────────────────
  const totalEtapas = tipo === 'encomenda' ? 4 : 3;
  const rotulos     = tipo === 'encomenda'
    ? ['Tipo', 'Cliente', 'Produtos', 'Entrega']
    : ['Tipo', 'Cliente', 'Produtos'];

  // ── Validação por etapa ─────────────────────────────────────
  function podeAvancar(): boolean {
    if (etapa === 1) return tipo !== null;
    if (etapa === 2) return cliente !== null;
    if (etapa === 3) return itens.length > 0;
    if (etapa === 4) return dataEntrega !== '';
    return false;
  }

  // ── Navegação ───────────────────────────────────────────────
  function avancar() {
    // Etapa 3 de venda rápida é a última
    if (etapa === 3 && tipo === 'rapida') { confirmar(); return; }
    if (etapa === totalEtapas)            { confirmar(); return; }
    setEtapa(e => e + 1);
  }

  function voltar() {
    setEtapa(e => Math.max(1, e - 1));
  }

  // ── Fechar com animação e limpar estado ─────────────────────
  function fecharELimpar() {
    setIsVisible(false);
    setTimeout(() => {
      setEtapa(1);
      setTipo(null);
      setCliente(null);
      setItens([]);
      setDataEntrega('');
      setPagamento('sinal_50');
      onFechar();
    }, 300);
  }

  // ── Confirmar e criar o registro ─────────────────────────────
  function confirmar() {
    if (!cliente || !tipo || itens.length === 0) return;

    const valorTotal      = itens.reduce((s, i) => s + i.produto.preco * i.quantidade, 0);
    const statusFinanceiro: StatusFinanceiro =
      tipo === 'rapida'
        ? 'pago'
        : pagamento === 'tudo'
          ? 'pago'
          : 'sinal_pago';

    onConfirmar({
      tipo,
      cliente,
      itens,
      dataEntrega: tipo === 'encomenda' ? dataEntrega : undefined,
      statusFinanceiro,
      valorTotal,
    });

    fecharELimpar();
  }

  const valorTotal   = itens.reduce((s, i) => s + i.produto.preco * i.quantidade, 0);
  const isUltimaEtapa = (etapa === 3 && tipo === 'rapida') || etapa === totalEtapas;

  const labelBotao = isUltimaEtapa
    ? tipo === 'rapida'
      ? '✓ Confirmar Venda'
      : '✓ Confirmar Encomenda'
    : 'Continuar →';

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true" role="dialog">

      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={fecharELimpar}
        aria-hidden="true"
      />

      {/* Painel lateral */}
      <aside
        className={`
          relative w-full md:w-[560px] h-full bg-background flex flex-col shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${isVisible ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* ── Cabeçalho ─── */}
        <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b-2 border-border shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Novo Registro</h2>
            <p className="text-sm font-medium text-slate-400">
              {tipo === 'rapida' ? '🛍️ Venda Rápida' : tipo === 'encomenda' ? '📦 Encomenda' : 'Venda ou Encomenda'}
            </p>
          </div>
          <button
            type="button"
            onClick={fecharELimpar}
            className="w-11 h-11 flex items-center justify-center rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Fechar painel"
          >
            <X size={26} />
          </button>
        </header>

        {/* ── Indicador de etapas ─── */}
        <div className="px-6 pt-5 pb-2 shrink-0">
          <IndicadorEtapas etapaAtual={etapa} rotulos={rotulos} />
        </div>

        {/* ── Conteúdo scrollável ─── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* key força re-mount da animação a cada troca de etapa */}
          <div key={etapa} className="animate-step-enter">
            {etapa === 1 && (
              <Etapa1Tipo tipo={tipo} onSelect={t => setTipo(t)} />
            )}
            {etapa === 2 && (
              <Etapa2Cliente clienteSelecionado={cliente} onSelect={setCliente} />
            )}
            {etapa === 3 && (
              <Etapa3Produtos itens={itens} onChange={setItens} />
            )}
            {etapa === 4 && tipo === 'encomenda' && (
              <Etapa4Encomenda
                dataEntrega={dataEntrega}
                onDataChange={setDataEntrega}
                pagamento={pagamento}
                onPagamentoChange={setPagamento}
                valorTotal={valorTotal}
              />
            )}
          </div>
        </div>

        {/* ── Rodapé de navegação ─── */}
        <footer className="px-6 py-5 border-t-2 border-border bg-surface shrink-0 space-y-3">
          {/* Mini resumo financeiro (visível a partir da etapa 3) */}
          {itens.length > 0 && etapa >= 3 && (
            <div className="flex items-center justify-between px-4 py-3 bg-background border border-border rounded-2xl">
              <span className="text-sm font-bold text-slate-500">
                {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                {' · '}
                {itens.reduce((s, i) => s + i.quantidade, 0)} peça{itens.reduce((s, i) => s + i.quantidade, 0) !== 1 ? 's' : ''}
              </span>
              <span className="text-lg font-black text-slate-900">{formatCurrency(valorTotal)}</span>
            </div>
          )}

          <div className="flex gap-3">
            {/* Botão Voltar */}
            {etapa > 1 && (
              <button
                type="button"
                onClick={voltar}
                className="flex items-center gap-1.5 px-5 py-4 rounded-2xl border-2 border-border text-base font-bold text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              >
                <ChevronLeft size={20} />
                Voltar
              </button>
            )}

            {/* Botão Avançar / Confirmar */}
            <button
              type="button"
              id="btn-wizard-avancar"
              onClick={avancar}
              disabled={!podeAvancar()}
              className={[
                'flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-lg font-black transition-all duration-200',
                podeAvancar()
                  ? isUltimaEtapa
                    ? 'bg-success hover:bg-success-hover text-white shadow-md hover:shadow-lg hover:-translate-y-0.5'
                    : 'bg-secondary hover:bg-secondary-hover text-white shadow-md hover:shadow-lg hover:-translate-y-0.5'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed',
              ].join(' ')}
            >
              {labelBotao}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

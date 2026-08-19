'use client';

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { ArtisanProfile } from '@/app/actions/quotes';

export interface OrcamentoPDFItem {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
}

export interface OrcamentoPDFProps {
  orcamentoId?: string;
  artisan: ArtisanProfile;
  clienteNome: string;
  clienteTelefone?: string;
  itens: OrcamentoPDFItem[];
  desconto?: number;
  prazoEntregaDias?: number;
  /** ISO date. Quando ausente, a validade é calculada como emissão + 15 dias. */
  validade?: string;
  valorFinal: number;
  /** ISO date. Default: agora. */
  dataEmissao?: string;
}

const COLORS = {
  ink: '#2A2420',
  inkSoft: '#6B6259',
  inkFaint: '#9A8F82',
  accent: '#C9622E',
  cream: '#F7F3EE',
  border: '#E5DDD3',
  borderSoft: '#F1ECE5',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: {
    padding: 44,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.ink,
    backgroundColor: COLORS.white,
  },

  // Cabeçalho
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
    paddingBottom: 18,
    marginBottom: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 4,
    marginRight: 12,
    objectFit: 'cover',
  },
  brandBlock: {
    maxWidth: 260,
  },
  brandName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: COLORS.ink,
    marginBottom: 4,
  },
  brandMeta: {
    fontSize: 9,
    color: COLORS.inkSoft,
    marginBottom: 2,
  },
  metaBlock: {
    alignItems: 'flex-end',
  },
  docTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: COLORS.accent,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaLine: {
    fontSize: 9,
    color: COLORS.inkSoft,
    marginBottom: 2,
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    color: COLORS.ink,
  },

  // Cliente
  clientSection: {
    backgroundColor: COLORS.cream,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 26,
  },
  clientLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.inkFaint,
    marginBottom: 4,
  },
  clientName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: COLORS.ink,
  },
  clientPhone: {
    fontSize: 9,
    color: COLORS.inkSoft,
    marginTop: 2,
  },

  // Tabela
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.cream,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.inkSoft,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  td: {
    fontSize: 10,
    color: COLORS.ink,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  colItem: { flexGrow: 3, flexBasis: 0 },
  colQty: { flexGrow: 1, flexBasis: 0, textAlign: 'center' },
  colUnit: { flexGrow: 1.4, flexBasis: 0, textAlign: 'right' },
  colSubtotal: { flexGrow: 1.4, flexBasis: 0, textAlign: 'right' },
  tdBold: {
    fontFamily: 'Helvetica-Bold',
  },

  // Totais
  totalsBlock: {
    marginTop: 18,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 230,
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 9,
    color: COLORS.inkSoft,
  },
  totalValue: {
    fontSize: 9,
    color: COLORS.ink,
  },
  discountValue: {
    fontSize: 9,
    color: '#B54708',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: 230,
    backgroundColor: COLORS.ink,
    borderRadius: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  grandTotalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  grandTotalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    color: COLORS.white,
  },

  // Prazo
  deliveryNote: {
    marginTop: 24,
    fontSize: 9,
    color: COLORS.ink,
  },
  deliveryNoteLabel: {
    fontFamily: 'Helvetica-Bold',
  },

  // Rodapé
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    alignItems: 'center',
  },
  footerThanks: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COLORS.ink,
    marginBottom: 3,
  },
  footerTerms: {
    fontSize: 8,
    color: COLORS.inkFaint,
    textAlign: 'center',
  },
});

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
};

const addDays = (iso: string, days: number) => {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

export default function OrcamentoPDF({
  orcamentoId,
  artisan,
  clienteNome,
  clienteTelefone,
  itens,
  desconto = 0,
  prazoEntregaDias,
  validade,
  valorFinal,
  dataEmissao,
}: OrcamentoPDFProps) {
  const emissaoIso = dataEmissao || new Date().toISOString();
  const validadeIso = validade || addDays(emissaoIso, 15);
  const subtotalGeral = itens.reduce((acc, item) => acc + item.subtotal, 0);
  const isValidLogo = artisan.logoUrl && /^https?:\/\//.test(artisan.logoUrl);

  return (
    <Document title={`Orcamento${orcamentoId ? `-${orcamentoId}` : ''}`}>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            {isValidLogo && <Image src={artisan.logoUrl} style={styles.logo} />}
            <View style={styles.brandBlock}>
              <Text style={styles.brandName}>{artisan.brandName || 'Meu Ateliê'}</Text>
              {artisan.telefone ? <Text style={styles.brandMeta}>Tel/WhatsApp: {artisan.telefone}</Text> : null}
              {artisan.email ? <Text style={styles.brandMeta}>{artisan.email}</Text> : null}
            </View>
          </View>

          <View style={styles.metaBlock}>
            <Text style={styles.docTitle}>
              Orçamento{orcamentoId ? ` #${orcamentoId.slice(-6).toUpperCase()}` : ''}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Emissão: </Text>
              {formatDate(emissaoIso)}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Validade: </Text>
              {formatDate(validadeIso)}
            </Text>
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.clientSection}>
          <Text style={styles.clientLabel}>Orçamento para</Text>
          <Text style={styles.clientName}>{clienteNome}</Text>
          {clienteTelefone ? <Text style={styles.clientPhone}>Contato: {clienteTelefone}</Text> : null}
        </View>

        {/* Tabela de itens */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colItem]}>Item</Text>
            <Text style={[styles.th, styles.colQty]}>Qtd.</Text>
            <Text style={[styles.th, styles.colUnit]}>Valor Unit.</Text>
            <Text style={[styles.th, styles.colSubtotal]}>Subtotal</Text>
          </View>
          {itens.map((item, index) => (
            <View
              key={`${item.nome}-${index}`}
              style={index === itens.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              <Text style={[styles.td, styles.colItem]}>{item.nome}</Text>
              <Text style={[styles.td, styles.colQty]}>{item.quantidade}</Text>
              <Text style={[styles.td, styles.colUnit]}>{formatCurrency(item.valorUnitario)}</Text>
              <Text style={[styles.td, styles.colSubtotal, styles.tdBold]}>{formatCurrency(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* Totais */}
        <View style={styles.totalsBlock}>
          {desconto > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatCurrency(subtotalGeral)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Desconto</Text>
                <Text style={styles.discountValue}>- {formatCurrency(desconto)}</Text>
              </View>
            </>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(valorFinal)}</Text>
          </View>
        </View>

        {prazoEntregaDias ? (
          <Text style={styles.deliveryNote}>
            <Text style={styles.deliveryNoteLabel}>Prazo de entrega estimado: </Text>
            {prazoEntregaDias} {prazoEntregaDias === 1 ? 'dia' : 'dias'} após a confirmação.
          </Text>
        ) : null}

        {/* Rodapé */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerThanks}>Agradecemos a preferência!</Text>
          <Text style={styles.footerTerms}>
            Este orçamento é válido até {formatDate(validadeIso)}. Valores sujeitos a alteração após esta data.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

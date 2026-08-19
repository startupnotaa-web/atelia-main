'use client';

import { useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { Download, MessageCircle, Loader2 } from 'lucide-react';
import OrcamentoPDF, { type OrcamentoPDFProps } from './OrcamentoPDF';

interface OrcamentoActionsProps {
  pdfProps: OrcamentoPDFProps;
  fileName: string;
  /** Executado antes de liberar o download (checagem de limite + persistência). Resolve `true` para liberar. */
  onBeforeDownload: () => Promise<boolean>;
  disabled?: boolean;
  onWhatsAppShare?: () => void;
  whatsappDisabled?: boolean;
  /** 'full' = botões grandes (tela de novo orçamento); 'compact' = botão único discreto (histórico). */
  variant?: 'full' | 'compact';
}

/**
 * PDFDownloadLink não expõe um jeito de aguardar uma checagem assíncrona antes
 * do download nativo do <a>: o clique real (2ª chamada, via .click() programático)
 * usa `skipGateRef` para pular a checagem e deixar o navegador seguir o href do blob.
 */
export default function OrcamentoActions({
  pdfProps,
  fileName,
  onBeforeDownload,
  disabled,
  onWhatsAppShare,
  whatsappDisabled,
  variant = 'full',
}: OrcamentoActionsProps) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const skipGateRef = useRef(false);
  const pendingActionRef = useRef<'download' | 'whatsapp' | null>(null);
  const [preparing, setPreparing] = useState(false);

  const triggerFlow = (action: 'download' | 'whatsapp') => {
    if (preparing || disabled) return;
    pendingActionRef.current = action;
    setPreparing(true);
    onBeforeDownload()
      .then((allowed) => {
        if (allowed) {
          skipGateRef.current = true;
          anchorRef.current?.click();
        } else {
          pendingActionRef.current = null;
        }
      })
      .finally(() => setPreparing(false));
  };

  const handleAnchorClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (skipGateRef.current) {
      skipGateRef.current = false;
      if (pendingActionRef.current === 'whatsapp') {
        onWhatsAppShare?.();
      }
      pendingActionRef.current = null;
      return;
    }
    event.preventDefault();
    triggerFlow('download');
  };

  const downloadClassName =
    variant === 'full'
      ? 'flex-1 bg-[#E25822] hover:bg-[#c94b1a] text-white text-xl font-black px-8 py-5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-3'
      : 'flex items-center justify-center gap-2 bg-background hover:bg-primary/10 border-2 border-border text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors text-sm shrink-0';

  const iconSize = variant === 'full' ? 28 : 18;

  return (
    <>
      {/* O .d.ts da lib declara PDFDownloadLink como class component, mas em runtime é
          forwardRef para o <a> — daí o cast, já que o tipo gerado não bate com o real. */}
      <PDFDownloadLink
        ref={anchorRef as any}
        document={<OrcamentoPDF {...pdfProps} />}
        fileName={fileName}
        onClick={handleAnchorClick}
        className={disabled ? `${downloadClassName} opacity-50 pointer-events-none` : downloadClassName}
      >
        {({ loading }) => (
          <>
            {preparing || loading ? (
              <Loader2 className="animate-spin" size={iconSize} />
            ) : (
              <Download size={iconSize} />
            )}
            Baixar PDF
          </>
        )}
      </PDFDownloadLink>

      {onWhatsAppShare && (
        <button
          type="button"
          onClick={() => triggerFlow('whatsapp')}
          disabled={preparing || disabled || whatsappDisabled}
          title={whatsappDisabled ? 'Cliente sem WhatsApp cadastrado.' : undefined}
          className="flex-1 bg-[#4A5D23] hover:bg-[#3d4d1d] text-white text-xl font-black px-8 py-5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <MessageCircle size={28} />
          Enviar pelo WhatsApp
        </button>
      )}
    </>
  );
}

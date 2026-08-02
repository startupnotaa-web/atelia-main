'use client';

import StockGrid from "@/components/StockGrid";
import Paywall from "@/components/Paywall";
import { useTenant } from "@/lib/TenantProvider";

export default function EstoquePage() {
  const { canAccessEstoque } = useTenant();

  if (!canAccessEstoque) {
    return <Paywall title="Estoque Premium" description="Faça o upgrade para o Plano Intermediário para gerenciar seu estoque completo." />;
  }

  return (
    <div className="w-full h-full flex flex-col py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <StockGrid />
    </div>
  );
}

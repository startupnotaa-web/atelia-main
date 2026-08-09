import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Política de Privacidade | AtelIA',
  description: 'Política de Privacidade e Proteção de Dados da plataforma AtelIA.',
};

export default function PoliticaDePrivacidade() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        
        <Link href="/" className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors font-bold mb-8">
          <ArrowLeft size={20} />
          Voltar para a página inicial
        </Link>
        
        <div className="bg-surface p-8 md:p-12 rounded-3xl shadow-sm border border-border">
          <h1 className="text-3xl md:text-5xl font-heading font-black mb-4">Política de Privacidade</h1>
          <p className="text-secondary font-medium mb-12">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

          <div className="space-y-8 text-secondary/90 leading-relaxed font-medium">
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Introdução e Propósito</h2>
              <p>
                A sua privacidade é uma prioridade para o <strong>AtelIA</strong>. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos os seus dados pessoais e empresariais, em total conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Coleta de Dados Pessoais</h2>
              <p className="mb-2">Coletamos informações essenciais para a prestação dos nossos serviços, incluindo, mas não se limitando a:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Dados de Cadastro:</strong> Nome, e-mail e informações do Google Auth ao criar sua conta.</li>
                <li><strong>Dados Empresariais:</strong> Nome do ateliê, CNPJ/CPF, endereço, telefone e métricas financeiras informadas pelo usuário.</li>
                <li><strong>Dados de Uso:</strong> Ações realizadas na plataforma, informações de cookies estritamente necessários para autenticação (sessão) e métricas de desempenho.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Finalidade do Tratamento dos Dados</h2>
              <p className="mb-2">Os seus dados são utilizados para os seguintes propósitos exclusivos:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Prover, operar e manter as funcionalidades do ERP e do Painel da Artesã.</li>
                <li>Processar pagamentos através de parceiros seguros (Stripe).</li>
                <li>Permitir que as Inteligências Artificiais da plataforma (CFO, Conselheira, Empreendedor) gerem análises personalizadas sobre a sua produção e finanças.</li>
                <li>Cumprir obrigações legais ou regulatórias.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Compartilhamento de Dados</h2>
              <p>
                <strong>Nós não vendemos e não alugamos seus dados pessoais.</strong> O compartilhamento ocorre apenas com fornecedores estritamente necessários para a operação do sistema, como:
                serviços de hospedagem em nuvem (Google Cloud/Firebase), gateways de pagamento (Stripe) e infraestrutura de servidores (Vercel). Estes provedores adotam rigorosos protocolos globais de segurança e privacidade.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Retenção e Segurança</h2>
              <p>
                Mantemos seus dados pessoais apenas pelo tempo necessário para cumprir as finalidades descritas nesta política, ou até que você solicite a exclusão da sua conta. Empregamos criptografia em trânsito (HTTPS), autenticação forte, regras rígidas de segurança no banco de dados e auditorias regulares para prevenir acessos não autorizados ou vazamentos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Seus Direitos (LGPD)</h2>
              <p className="mb-2">Como titular dos dados, você tem o direito de:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Confirmar a existência de tratamento e acessar seus dados (visualizando-os na aba Minha Conta).</li>
                <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
                <li>Solicitar a portabilidade ou exclusão dos seus dados, através dos nossos canais de atendimento.</li>
                <li>Revogar o consentimento a qualquer momento (o que pode resultar no cancelamento do uso da plataforma).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Uso de Inteligência Artificial</h2>
              <p>
                Os dados financeiros e de estoque inseridos na plataforma são processados pelas nossas IAs de forma anônima e contextual. As análises geradas servem exclusivamente para exibir recomendações no seu painel privado. Seus dados privados <strong>não</strong> são utilizados para treinar modelos abertos ao público de terceiros.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">8. Contato e Encarregado de Dados</h2>
              <p>
                Se você tiver dúvidas sobre nossa Política de Privacidade, ou desejar exercer qualquer direito previsto na LGPD, por favor, entre em contato através do widget de suporte na plataforma ou envie um e-mail para o administrador do sistema.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

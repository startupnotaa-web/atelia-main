import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Termos de Uso | AtelIA',
  description: 'Termos e Condições de Uso da plataforma AtelIA.',
};

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        
        <Link href="/" className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors font-bold mb-8">
          <ArrowLeft size={20} />
          Voltar para a página inicial
        </Link>
        
        <div className="bg-surface p-8 md:p-12 rounded-3xl shadow-sm border border-border">
          <h1 className="text-3xl md:text-5xl font-heading font-black mb-4">Termos e Condições de Uso</h1>
          <p className="text-secondary font-medium mb-12">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

          <div className="space-y-8 text-secondary/90 leading-relaxed font-medium">
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e utilizar a plataforma <strong>AtelIA</strong> ("Nós", "Plataforma" ou "Serviço"), você ("Usuário" ou "Artesã") concorda em cumprir e ser regido por estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Descrição do Serviço</h2>
              <p>
                O AtelIA é um ERP (Enterprise Resource Planning) simplificado, projetado especificamente para microempreendedoras do ramo artesanal. Ele oferece ferramentas para controle de estoque, cálculo de precificação, gestão financeira, geração de orçamentos e inteligência artificial para auxílio em rotinas criativas e comerciais.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Cadastro e Segurança da Conta</h2>
              <p>
                Para utilizar os recursos completos do AtelIA, é necessário realizar um cadastro. O Usuário é o único responsável por manter a confidencialidade das suas credenciais de login e por todas as atividades que ocorrem em sua conta. Notifique-nos imediatamente sobre qualquer uso não autorizado.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Assinaturas e Pagamentos</h2>
              <p>
                Oferecemos uma modalidade gratuita com limitações de uso e um <strong>Plano Pro</strong> pago (mensal ou anual). 
                Os pagamentos são processados de forma segura através do nosso parceiro <strong>Stripe</strong>. 
                Ao assinar o Plano Pro, você concorda com o faturamento recorrente. Você pode cancelar sua assinatura a qualquer momento; o cancelamento interromperá as cobranças futuras, mas não haverá reembolso proporcional de meses ou anos já faturados e iniciados.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Propriedade Intelectual</h2>
              <p>
                A marca, o logotipo, o design da interface, o código-fonte e o conteúdo estrutural do AtelIA são de nossa propriedade exclusiva. Você retém 100% da propriedade sobre os dados dos seus produtos, imagens carregadas, informações de clientes e relatórios gerados dentro da sua conta.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Privacidade e Tratamento de Dados (LGPD)</h2>
              <p>
                Respeitamos rigorosamente a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD)</strong>. 
                Não vendemos, alugamos ou repassamos seus dados comerciais ou de clientes para terceiros. Seus dados são utilizados exclusivamente para o funcionamento da plataforma, geração de inteligência artificial interna (restrita à sua conta) e gestão de pagamentos. Para mais detalhes, consulte nossa Política de Privacidade.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Modificações dos Termos</h2>
              <p>
                Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. Modificações significativas serão comunicadas através da plataforma ou via e-mail. O uso contínuo do serviço após as alterações constitui sua aceitação dos novos Termos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">8. Contato</h2>
              <p>
                Para dúvidas, suportes ou questões relacionadas a estes termos, entre em contato conosco através do widget de feedback na plataforma ou diretamente através de nossos canais oficiais de comunicação.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Termos de Uso</h1>
        <div className="prose prose-indigo text-gray-600">
          <p className="mb-4">
            Bem-vindo ao AtelIA. Ao utilizar nossa plataforma SaaS (Software as a Service), você concorda com os termos aqui descritos.
          </p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">1. Uso da Plataforma</h2>
          <p className="mb-4">
            O AtelIA é uma ferramenta de gestão financeira e de pedidos destinada a artesãs e pequenos negócios. Você é o único responsável pelos dados que insere na plataforma.
          </p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2. Armazenamento de Dados e Privacidade</h2>
          <p className="mb-4">
            Em conformidade com a LGPD, o AtelIA armazena dados exclusivamente para a prestação dos serviços contratados (gestão financeira, catálogo e pedidos). Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins de marketing.
          </p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3. Pagamentos e Assinaturas</h2>
          <p className="mb-4">
            Utilizamos o <strong>Stripe</strong> como processador oficial e seguro de pagamentos. Nenhuma informação de cartão de crédito é armazenada em nossos servidores.
          </p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4. Cookies de Sessão</h2>
          <p className="mb-4">
            Utilizamos cookies de sessão (HTTP-only) estritamente para manter você autenticado e garantir a segurança das suas informações.
          </p>
        </div>
      </div>
    </div>
  );
}

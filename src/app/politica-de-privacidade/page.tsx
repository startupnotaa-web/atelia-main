import React from 'react';

export default function PoliticaDePrivacidade() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Política de Privacidade</h1>
        <div className="prose prose-indigo text-gray-600">
          <p className="mb-4">
            A sua privacidade é nossa prioridade. Esta política explica como coletamos, usamos e protegemos as suas informações no AtelIA.
          </p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">1. Dados Coletados</h2>
          <p className="mb-4">
            Coletamos apenas os dados essenciais para o funcionamento da plataforma: seu e-mail de acesso e os dados que você insere em seu painel (pedidos, clientes, estoque e finanças).
          </p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2. Uso dos Dados</h2>
          <p className="mb-4">
            Seus dados são utilizados estritamente para que você possa fazer a gestão do seu negócio no AtelIA. <strong>Nós não vendemos seus dados para terceiros.</strong>
          </p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3. Proteção e Segurança</h2>
          <p className="mb-4">
            Utilizamos infraestrutura de segurança do Google (Firebase) e pagamentos criptografados pelo Stripe. O acesso às suas informações exige autenticação e cookies de sessão criptografados.
          </p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4. Seus Direitos (LGPD)</h2>
          <p className="mb-4">
            Você tem o direito de solicitar a exclusão total da sua conta e de todos os dados associados a ela a qualquer momento através das configurações do seu perfil.
          </p>
        </div>
      </div>
    </div>
  );
}

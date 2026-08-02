export type PronounType = 'ela' | 'ele' | 'neutro';

export interface Greetings {
  welcome: string;       // Bem-vinda / Bem-vindo / Boas-vindas
  ready: string;         // pronta / pronto / a postos
  loggedIn: string;      // logada / logado / com sessão ativa
  invited: string;       // convidada / convidado / convidamos você
  dear: string;          // Querida / Querido / Olá
  article: string;       // a / o / ''
  articleCap: string;    // A / O / ''
  suffix: string;        // a / o / ''
  artisan: string;       // Artesã / Artesão / Artesã(o)
}

export function getGreetings(pronoun?: PronounType | string | null): Greetings {
  const p = (pronoun || '').toLowerCase().trim();

  if (p === 'ele') {
    return {
      welcome: 'Bem-vindo',
      ready: 'pronto',
      loggedIn: 'logado',
      invited: 'convidado',
      dear: 'Querido',
      article: 'o',
      articleCap: 'O',
      suffix: 'o',
      artisan: 'Artesão',
    };
  }

  if (p === 'neutro') {
    return {
      welcome: 'Boas-vindas',
      ready: 'a postos',
      loggedIn: 'autenticado(a)',
      invited: 'convidamos você',
      dear: 'Olá',
      article: '',
      articleCap: '',
      suffix: '',
      artisan: 'Artesã(o)',
    };
  }

  // Default: ela/dela (maioria do público-alvo)
  return {
    welcome: 'Bem-vinda',
    ready: 'pronta',
    loggedIn: 'logada',
    invited: 'convidada',
    dear: 'Querida',
    article: 'a',
    articleCap: 'A',
    suffix: 'a',
    artisan: 'Artesã',
  };
}

/**
 * Retorna a saudação baseada na hora do dia.
 */
export function getTimeGreeting(): string {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();

  // Das 05:30 às 11:59: 'Bom dia'
  if ((hour > 5 || (hour === 5 && minutes >= 30)) && hour < 12) {
    return 'Bom dia';
  }
  
  // Das 12:00 às 17:59: 'Boa tarde'
  if (hour >= 12 && hour < 18) {
    return 'Boa tarde';
  }
  
  // Das 18:00 às 05:29: 'Boa noite'
  return 'Boa noite';
}

/**
 * Extrai o primeiro nome de um nome completo.
 */
export function extractFirstName(fullName?: string | null): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

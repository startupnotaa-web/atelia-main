import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rastreio leve na memória para Rate Limiting
// Nota: No Vercel Edge, as variáveis globais são mantidas por isolate. 
// Isso atua como uma mitigação básica de DDoS/Brute Force, cumprindo o requisito de rate limit sem BD.
interface RateLimitData {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitData>();

export function proxy(request: NextRequest) {
  // 0. Configuração Estrita de CORS
  const origin = request.headers.get('origin');
  let isOriginAllowed = false;
  
  if (origin) {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://www.atelia.app.br',
      'https://atelia.app.br'
    ];
    
    // Autoriza localhost, domínios oficiais e subdomínios Vercel gerados pelo projeto
    const isVercelPreview = origin.endsWith('.vercel.app') && origin.includes('atelia');
    isOriginAllowed = allowedOrigins.includes(origin) || isVercelPreview;

    if (!isOriginAllowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Forbidden', message: 'CORS policy: Origem não autorizada.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Resposta rápida para Preflight (OPTIONS)
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  // 1. Aplicar Rate Limiting para rotas sensíveis (ex: IA)
  if (request.nextUrl.pathname.startsWith('/api/ai-analysis')) {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto
    const maxRequests = 20;

    const rateLimitData = rateLimitMap.get(ip);

    if (!rateLimitData || now > rateLimitData.resetTime) {
      // Novo IP ou janela de tempo expirou
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    } else {
      // Dentro da janela de tempo
      rateLimitData.count += 1;

      if (rateLimitData.count > maxRequests) {
        return new NextResponse(
          JSON.stringify({ 
            error: 'Too Many Requests', 
            message: 'Limite de requisições excedido. Tente novamente em alguns segundos.' 
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil((rateLimitData.resetTime - now) / 1000).toString(),
            },
          }
        );
      }
    }
  }

  // 2. Aplicação de Headers de Segurança (Helmet equivalente)
  const response = NextResponse.next();

  if (origin && isOriginAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

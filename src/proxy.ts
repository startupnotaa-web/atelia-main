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

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

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

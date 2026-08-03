import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AtelIA - Gestão para Artesãs',
    short_name: 'AtelIA',
    description: 'Gestão financeira, estoque e precificação inteligente para artesãs.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F7F2EC',
    theme_color: '#F7F2EC',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}

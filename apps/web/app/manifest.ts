import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SkillPilot',
    short_name: 'SkillPilot',
    description: 'An evidence-driven career system for students.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f4ee',
    theme_color: '#17201d',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}

export const menuItems = [
  {
    id: 'story',
    label: 'STORY',
    description: 'Your journey through the world of QA and gaming.',
    children: [
      {
        id: 'qa-portfolio',
        label: 'QA PORTFOLIO',
        path: '/qa-portfolio',
        description: 'Education, professional experience, playtests, certificates, skills and tools.',
      },
      {
        id: 'steam-library',
        label: 'STEAM LIBRARY',
        path: '/steam-library',
        description: 'Game library, hours played, achievements unlocked, reviews and profile summary.',
      },
    ],
  },
  {
    id: 'dlcs',
    label: 'DLCS',
    description: 'Downloadable professional content.',
    children: [
      {
        id: 'resume',
        label: 'RESUME',
        path: '/resume',
        description: 'Interactive resume and downloadable CV.',
      },
      {
        id: 'references',
        label: 'REFERENCES',
        path: '/references',
        description: 'Professional references and testimonials.',
      },
    ],
  },
  {
    id: 'extra',
    label: 'EXTRA',
    description: 'Bonus content beyond the main campaign.',
    children: [
      {
        id: 'tech',
        label: 'TECH',
        path: '/tech',
        description: 'Software, operating systems, computer builds, and home lab.',
      },
      {
        id: 'media',
        label: 'MEDIA',
        path: '/media',
        description: 'Photography, videos, and creative projects.',
      },
      {
        id: 'livestream',
        label: 'LIVESTREAM',
        path: '/livestream',
        description: 'Twitch stream with live chat and schedule.',
      },
    ],
  },
  {
    id: 'settings',
    label: 'SETTINGS',
    path: '/settings',
    description: 'Customize your experience. Theme, effects, sounds, and more.',
  },
  {
    id: 'credits',
    label: 'CREDITS',
    path: '/credits',
    description: 'The team, tools, and technologies behind this build.',
  },
  {
    id: 'exit',
    label: 'EXIT',
    action: 'exit',
    description: 'Are you sure you want to quit? Unsaved progress may be lost.',
  },
];

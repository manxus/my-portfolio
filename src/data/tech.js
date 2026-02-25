export const techCategories = [
  {
    id: 'software',
    title: 'SOFTWARE & TOOLS',
    items: [
      { name: 'Visual Studio Code', level: 90, tags: ['IDE', 'Daily Driver'] },
      { name: 'JIRA / Azure DevOps', level: 85, tags: ['Bug Tracking', 'Agile'] },
      { name: 'Git / GitHub', level: 80, tags: ['Version Control'] },
      { name: 'Docker', level: 60, tags: ['Containers'] },
      { name: 'OBS Studio', level: 75, tags: ['Streaming', 'Recording'] },
      { name: 'Figma', level: 50, tags: ['Design', 'Prototyping'] },
    ],
  },
  {
    id: 'os',
    title: 'OPERATING SYSTEMS',
    items: [
      { name: 'Windows 10/11', level: 95, tags: ['Primary'] },
      { name: 'Ubuntu / Debian', level: 70, tags: ['Server', 'Desktop'] },
      { name: 'macOS', level: 55, tags: ['Secondary'] },
      { name: 'Android', level: 80, tags: ['Mobile'] },
    ],
  },
  {
    id: 'builds',
    title: 'COMPUTER BUILDS',
    items: [
      {
        name: 'Main Rig',
        level: null,
        tags: ['Gaming', 'Work'],
        specs: 'CPU / GPU / RAM — add your actual specs',
      },
      {
        name: 'Home Server',
        level: null,
        tags: ['NAS', 'Docker'],
        specs: 'Server specs — add your actual setup',
      },
    ],
  },
  {
    id: 'networking',
    title: 'NETWORKING & HOME LAB',
    items: [
      { name: 'Home Network Setup', level: 65, tags: ['Router', 'VLAN'] },
      { name: 'Pi-hole / AdGuard', level: 70, tags: ['DNS', 'Ad Blocking'] },
      { name: 'Self-Hosted Services', level: 55, tags: ['Nextcloud', 'Plex'] },
    ],
  },
  {
    id: 'languages',
    title: 'PROGRAMMING & SCRIPTING',
    items: [
      { name: 'Python', level: 65, tags: ['Automation', 'Testing'] },
      { name: 'JavaScript / React', level: 60, tags: ['Web', 'This Site'] },
      { name: 'Bash / PowerShell', level: 55, tags: ['Scripting'] },
      { name: 'SQL', level: 50, tags: ['Databases'] },
    ],
  },
];

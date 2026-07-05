/** Category slug in tech.json for the computer builds section */
export const TECH_BUILDS_CATEGORY_ID = 'builds';

/** Spare parts / on-hand hardware below Computer Builds */
export const TECH_COMPONENT_INVENTORY_CATEGORY_ID = 'component-inventory';

/** In-app tech editor: Builds use multi-tag checkboxes; inventory uses one category */
export const TECH_HARDWARE_TAG_OPTIONS = [
  'GPU',
  'CPU',
  'PSU',
  'Motherboard',
  'RAM',
  'Storage',
  'Case',
  'Cooling',
];

const TECH_ITEM_NAME_FIELD = {
  key: 'name',
  label: 'Name',
  type: 'text',
  required: true,
};

const TECH_ITEM_PROFICIENCY_FIELD = {
  key: 'proficiency',
  label: 'Proficiency',
  type: 'text',
};

export function techItemTagsFieldForCategoryId(categoryId) {
  if (categoryId === TECH_COMPONENT_INVENTORY_CATEGORY_ID) {
    return {
      key: 'tags',
      label: 'Category',
      type: 'select',
      options: TECH_HARDWARE_TAG_OPTIONS,
      tagSingleton: true,
    };
  }
  if (categoryId === TECH_BUILDS_CATEGORY_ID) {
    return {
      key: 'tags',
      label: 'Tags',
      type: 'list',
      options: TECH_HARDWARE_TAG_OPTIONS,
    };
  }
  return { key: 'tags', label: 'Tags', type: 'list' };
}

/** Base rows for nested tech item editor when category id is unknown (software-style tags). */
export function getTechCategoryItemBaseSchema(categoryId) {
  return [
    TECH_ITEM_NAME_FIELD,
    techItemTagsFieldForCategoryId(categoryId),
    TECH_ITEM_PROFICIENCY_FIELD,
  ];
}

export const TECH_CATEGORY_ITEM_BASE_SCHEMA = getTechCategoryItemBaseSchema();

/** Shown only when category id is `builds` (in-app editor + nested list) */
export const TECH_BUILD_ITEM_EXTRA_SCHEMA = [
  { key: 'cpu', label: 'CPU', type: 'text' },
  { key: 'gpu', label: 'GPU', type: 'text' },
  { key: 'ram', label: 'RAM', type: 'text' },
  { key: 'storage', label: 'Storage', type: 'text' },
  { key: 'motherboard', label: 'Motherboard', type: 'text' },
  { key: 'psu', label: 'PSU', type: 'text' },
  { key: 'case', label: 'Case', type: 'text' },
  { key: 'cooling', label: 'Cooling', type: 'text' },
  { key: 'extras', label: 'Other / Notes', type: 'textarea' },
  { key: 'specs', label: 'Free-form specs (legacy)', type: 'textarea' },
];

/** Use for category id component-inventory (quantity + notes) */
export const TECH_INVENTORY_ITEM_EXTRA_SCHEMA = [
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'extras', label: 'Notes', type: 'textarea' },
];

/** Subgroup bulk-edit rows: bucket implies category (no tags field). */
export const TECH_INVENTORY_SUBGROUP_ROW_SCHEMA_HARDWARE = [
  TECH_ITEM_NAME_FIELD,
  TECH_ITEM_PROFICIENCY_FIELD,
  ...TECH_INVENTORY_ITEM_EXTRA_SCHEMA,
];

/** Other bucket: assign exactly one hardware category per row */
export const TECH_INVENTORY_SUBGROUP_ROW_SCHEMA_OTHER = [
  TECH_ITEM_NAME_FIELD,
  {
    key: 'tags',
    label: 'Category',
    type: 'select',
    options: TECH_HARDWARE_TAG_OPTIONS,
    tagSingleton: true,
    required: true,
  },
  TECH_ITEM_PROFICIENCY_FIELD,
  ...TECH_INVENTORY_ITEM_EXTRA_SCHEMA,
];

export function getTechItemSchemaForCategoryId(categoryId) {
  const base = getTechCategoryItemBaseSchema(categoryId);
  if (categoryId === TECH_BUILDS_CATEGORY_ID) {
    return [...base, ...TECH_BUILD_ITEM_EXTRA_SCHEMA];
  }
  if (categoryId === TECH_COMPONENT_INVENTORY_CATEGORY_ID) {
    return [...base, ...TECH_INVENTORY_ITEM_EXTRA_SCHEMA];
  }
  return base;
}

export const schemas = {
  'qaPortfolio.experience': [
    { key: 'title', label: 'Job Title', type: 'text', required: true },
    { key: 'company', label: 'Company', type: 'text', required: true },
    { key: 'period', label: 'Period', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'highlights', label: 'Highlights', type: 'list' },
  ],
  'qaPortfolio.education': [
    { key: 'degree', label: 'Degree', type: 'text', required: true },
    { key: 'institution', label: 'Institution', type: 'text', required: true },
    { key: 'period', label: 'Period', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  'qaPortfolio.playtests': [
    { key: 'title', label: 'Game Title', type: 'text', required: true },
    { key: 'studio', label: 'Studio', type: 'text', required: true },
    { key: 'year', label: 'Year', type: 'text', required: true },
    { key: 'type', label: 'Type', type: 'text', required: true },
    { key: 'url', label: 'Store or page URL (e.g. Steam)', type: 'text' },
  ],
  'qaPortfolio.certificates': [
    { key: 'name', label: 'Certificate Name', type: 'text', required: true },
    { key: 'issuer', label: 'Issuer', type: 'text', required: true },
    { key: 'year', label: 'Year', type: 'text', required: true },
  ],

  'resume.personalInfo': [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'links', label: 'Links', type: 'objectList', schema: [
      { key: 'label', label: 'Label', type: 'text', required: true },
      { key: 'url', label: 'URL', type: 'text', required: true },
    ]},
  ],
  'resume.timeline': [
    { key: 'year', label: 'Year', type: 'text', required: true },
    { key: 'entries', label: 'Entries', type: 'objectList', schema: [
      { key: 'type', label: 'Type', type: 'select', options: ['work', 'volunteer', 'cert', 'education'], required: true },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'org', label: 'Organization', type: 'text', required: true },
      { key: 'period', label: 'Period', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ]},
  ],

  'tech.techCategories': [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true },
    { key: 'title', label: 'Section Title', type: 'text', required: true },
    {
      key: 'items',
      label: 'Items',
      type: 'objectList',
      schema: TECH_CATEGORY_ITEM_BASE_SCHEMA,
      getItemSchema: (formData) => getTechItemSchemaForCategoryId(formData?.id),
    },
  ],

  'steam-reviews.reviews': [
    { key: 'appId', label: 'Steam App ID', type: 'number', required: true },
    {
      key: 'gameName',
      label: 'Game name (if not in your library JSON)',
      type: 'text',
    },
    { key: 'rating', label: 'Rating (1-10)', type: 'number', required: true },
    { key: 'title', label: 'Review Title', type: 'text', required: true },
    { key: 'text', label: 'Review Text', type: 'textarea', required: true },
    { key: 'date', label: 'Date (YYYY-MM-DD)', type: 'text', required: true },
    { key: 'recommended', label: 'Recommended', type: 'boolean' },
    { key: 'pros', label: 'Pros', type: 'list' },
    { key: 'cons', label: 'Cons', type: 'list' },
  ],

  'steam-tierlist.tierLists': [
    { key: 'category', label: 'Category Name', type: 'text', required: true },
    { key: 'tiers', label: 'Tiers (S–F + Unplayed)', type: 'tiers' },
  ],

  'steam-hallofpain.entries': [
    { key: 'appId', label: 'Steam App ID', type: 'number', required: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['conquered', 'brokeme', 'bleeding', 'dreading'],
      required: true,
    },
    { key: 'note', label: 'Note', type: 'textarea' },
  ],

  'media.galleryItems': [
    { key: 'id', label: 'ID', type: 'number', autoId: true },
    { key: 'type', label: 'Category', type: 'text', required: true },
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'thumbnail', label: 'Thumbnail URL', type: 'text', required: true },
    { key: 'fullUrl', label: 'Full Image URL', type: 'text' },
    { key: 'videoUrl', label: 'Video URL (YouTube watch, youtu.be, embed, or shorts)', type: 'text' },
  ],
  'media.categories': [
    { key: '_value', label: 'Category Name', type: 'text', required: true },
  ],

  'livestream.schedule': [
    { key: 'day', label: 'Day', type: 'text', required: true },
    { key: 'time', label: 'Time', type: 'text', required: true },
    { key: 'game', label: 'Game / Activity', type: 'text', required: true },
  ],
  'livestream.twitchChannel': [
    { key: '_value', label: 'Twitch Channel', type: 'text', required: true },
  ],
  'livestream.timezone': [
    { key: '_value', label: 'Timezone Note (optional, for fixed slots)', type: 'text' },
  ],
  'livestream.scheduleNote': [
    { key: '_value', label: 'Schedule Note', type: 'textarea', required: true },
  ],
  'livestream.about': [
    { key: 'intro', label: 'Intro', type: 'textarea', required: true },
    { key: 'qaStreamsNote', label: 'QA Streams Note', type: 'textarea', required: true },
  ],
  'livestream.highlights': [
    { key: 'id', label: 'ID', type: 'number', autoId: true },
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'thumbnail', label: 'Thumbnail URL (optional — auto from video if empty)', type: 'text' },
    { key: 'videoUrl', label: 'Video URL (YouTube, Twitch clip, or Twitch video)', type: 'text' },
  ],
  'livestream.streamLoadout': [
    { key: 'label', label: 'Label', type: 'text', required: true },
    { key: 'value', label: 'Value', type: 'text', required: true },
    { key: 'url', label: 'Link URL (optional)', type: 'text' },
  ],
  'livestream.chatRules': [
    { key: 'text', label: 'Rule', type: 'text', required: true },
  ],
  'livestream.chatCommands': [
    { key: 'command', label: 'Command', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'text', required: true },
  ],

  'travel.home': [
    { key: 'location', label: 'Location', type: 'text', required: true },
    { key: 'mapLocation', label: 'Pin location', type: 'mapLocation', required: true },
  ],

  'travel.trips': [
    { key: 'id', label: 'ID', type: 'number', autoId: true },
    { key: 'location', label: 'Location', type: 'text', required: true },
    { key: 'mapLocation', label: 'Pin location', type: 'mapLocation', required: true },
    { key: 'period', label: 'Period', type: 'text', required: true },
    { key: 'summary', label: 'Summary', type: 'textarea' },
    { key: 'highlights', label: 'Highlights', type: 'list' },
    { key: 'coverUrl', label: 'Cover Image URL', type: 'text' },
    { key: 'photos', label: 'Photos', type: 'objectList', schema: [
      { key: 'url', label: 'Image URL', type: 'text', required: true },
      { key: 'caption', label: 'Caption', type: 'text' },
    ]},
    { key: 'videoUrl', label: 'Video URL (YouTube)', type: 'text' },
  ],

  'music.favorites': [
    { key: 'id', label: 'ID', type: 'number', autoId: true },
    {
      key: 'kind',
      label: 'Kind',
      type: 'select',
      options: ['Album', 'Artist'],
      required: true,
    },
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'artist', label: 'Artist (for albums)', type: 'text' },
    {
      key: 'featured',
      label: 'Show in favorite albums',
      type: 'boolean',
    },
    {
      key: 'physicalFormat',
      label: 'Physical copy (albums only)',
      type: 'select',
      options: ['Vinyl', 'CD', 'Cassette'],
    },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'coverUrl', label: 'Cover Image URL', type: 'text' },
    { key: 'listenUrl', label: 'Listen URL (Spotify, etc.)', type: 'text' },
  ],

  'books.books': [
    { key: 'id', label: 'ID', type: 'number', autoId: true },
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'author', label: 'Author', type: 'text', required: true },
    { key: 'read', label: 'Have read', type: 'boolean' },
    { key: 'featured', label: 'Show in favorites', type: 'boolean' },
    {
      key: 'format',
      label: 'Format',
      type: 'select',
      options: ['Paperback', 'Hardcover', 'Ebook', 'Audiobook'],
    },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'coverUrl', label: 'Cover Image URL', type: 'text' },
    { key: 'readUrl', label: 'Read URL (Goodreads, StoryGraph, etc.)', type: 'text' },
  ],

  'credits.credits': [
    { key: 'heading', label: 'Heading', type: 'text', required: true },
    { key: 'items', label: 'Items', type: 'list' },
  ],

  'changelog.changelog': [
    { key: 'version', label: 'Version', type: 'text', required: true },
    { key: 'date', label: 'Date (YYYY-MM-DD)', type: 'text', required: true },
    { key: 'entries', label: 'Entries', type: 'objectList', schema: [
      { key: 'type', label: 'Type', type: 'select', options: ['added', 'fixed', 'changed', 'removed'], required: true },
      { key: 'text', label: 'Text', type: 'text', required: true },
    ]},
  ],

  'patchNotes.knownIssues': [
    { key: '_value', label: 'Issue Description', type: 'text', required: true },
  ],

  'menu.menuItems': [
    { key: 'id', label: 'ID', type: 'text', required: true },
    { key: 'label', label: 'Label', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'path', label: 'Path', type: 'text' },
    { key: 'action', label: 'Action', type: 'text' },
    { key: 'children', label: 'Children', type: 'objectList', schema: [
      { key: 'id', label: 'ID', type: 'text', required: true },
      { key: 'label', label: 'Label', type: 'text', required: true },
      { key: 'path', label: 'Path', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ]},
  ],

  'steam-overrides.gameOverrides': [
    { key: '_key', label: 'App ID', type: 'text', required: true },
    { key: 'genres', label: 'Genres', type: 'list' },
    { key: 'playerModes', label: 'Player Modes', type: 'list' },
    { key: 'hardwareSupport', label: 'Hardware Support', type: 'list' },
  ],

  'steam-overrides.filterConfig': [
    { key: 'allowedGenres', label: 'Allowed Genres', type: 'list' },
  ],
};

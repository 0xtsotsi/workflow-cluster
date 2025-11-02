/**
 * Analyze workflow configuration to extract required credentials
 */

export interface RequiredCredential {
  platform: string;
  type: 'oauth' | 'api_key';
  variable: string; // e.g., "user.twitter", "user.openai"
}

/**
 * Extract all credential references from workflow config
 */
export function analyzeWorkflowCredentials(config: {
  steps: Array<{
    id: string;
    module?: string;
    inputs?: Record<string, unknown>;
    type?: string;
    then?: unknown[];
    else?: unknown[];
    steps?: unknown[];
  }>;
}): RequiredCredential[] {
  const credentials = new Set<string>();

  function extractFromValue(value: unknown) {
    if (typeof value === 'string') {
      // Match {{user.platform}} patterns
      const matches = value.matchAll(/\{\{user\.([a-zA-Z0-9_-]+)\}\}/g);
      for (const match of matches) {
        credentials.add(match[1]);
      }
    } else if (Array.isArray(value)) {
      value.forEach(extractFromValue);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(extractFromValue);
    }
  }

  function processSteps(steps: unknown[]) {
    for (const step of steps) {
      if (!step || typeof step !== 'object') continue;

      const s = step as Record<string, unknown>;

      // Check inputs
      if (s.inputs) {
        extractFromValue(s.inputs);
      }

      // Recursively check nested steps (conditions, loops)
      if (s.then) {
        processSteps(s.then as unknown[]);
      }
      if (s.else) {
        processSteps(s.else as unknown[]);
      }
      if (s.steps) {
        processSteps(s.steps as unknown[]);
      }
    }
  }

  processSteps(config.steps);

  // Map platform names to credential types
  // OAuth platforms require user authorization flow
  const oauthPlatforms = [
    'twitter', 'youtube', 'instagram', 'discord', 'telegram', 'github',
    'tiktok', 'vimeo', 'shopify', 'medium', 'linkedin', 'facebook',
    'reddit', 'google', 'notion'
  ];

  return Array.from(credentials).map((platform) => ({
    platform,
    type: oauthPlatforms.includes(platform) ? 'oauth' : 'api_key',
    variable: `user.${platform}`,
  }));
}

/**
 * Get user-friendly platform names
 */
export function getPlatformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    // Existing platforms
    twitter: 'Twitter',
    youtube: 'YouTube',
    instagram: 'Instagram',
    discord: 'Discord',
    telegram: 'Telegram',
    github: 'GitHub',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    rapidapi: 'RapidAPI',
    stripe: 'Stripe',
    airtable: 'Airtable',
    sendgrid: 'SendGrid',
    slack: 'Slack',

    // Video Automation
    runway: 'Runway',
    heygen: 'HeyGen',
    synthesia: 'Synthesia',
    whisper: 'OpenAI Whisper',
    elevenlabs: 'ElevenLabs',
    cloudinary: 'Cloudinary',
    vimeo: 'Vimeo',
    tiktok: 'TikTok',

    // Business
    hubspot: 'HubSpot',
    salesforce: 'Salesforce',
    pipedrive: 'Pipedrive',
    quickbooks: 'QuickBooks',
    freshbooks: 'FreshBooks',
    xero: 'Xero',
    docusign: 'DocuSign',
    hellosign: 'HelloSign',

    // Lead Generation
    hunter: 'Hunter.io',
    apollo: 'Apollo.io',
    clearbit: 'Clearbit',
    zoominfo: 'ZoomInfo',
    lusha: 'Lusha',
    proxycurl: 'Proxycurl',
    phantombuster: 'PhantomBuster',
    apify: 'Apify',

    // E-Commerce
    shopify: 'Shopify',
    woocommerce: 'WooCommerce',
    'amazon-sp': 'Amazon Seller',
    etsy: 'Etsy',
    ebay: 'eBay',
    square: 'Square',
    printful: 'Printful',

    // Content
    medium: 'Medium',
    ghost: 'Ghost',
    wordpress: 'WordPress',
    unsplash: 'Unsplash',
    pexels: 'Pexels',
    canva: 'Canva',
    bannerbear: 'Bannerbear',
    placid: 'Placid',

    // Developer Tools
    'github-actions': 'GitHub Actions',
    circleci: 'CircleCI',
    jenkins: 'Jenkins',
    vercel: 'Vercel',
    netlify: 'Netlify',
    heroku: 'Heroku',
    datadog: 'Datadog',
    sentry: 'Sentry',

    // Data Processing (existing)
    snowflake: 'Snowflake',
    bigquery: 'BigQuery',
    redshift: 'Redshift',
    kafka: 'Kafka',
    rabbitmq: 'RabbitMQ',
    huggingface: 'Hugging Face',
    replicate: 'Replicate',

    // Communication (additional)
    twilio: 'Twilio',
    whatsapp: 'WhatsApp',
    firebase: 'Firebase',
    onesignal: 'OneSignal',
    zendesk: 'Zendesk',
    freshdesk: 'Freshdesk',
    intercom: 'Intercom',

    // Social (additional)
    reddit: 'Reddit',

    // Data (additional)
    mongodb: 'MongoDB',
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    notion: 'Notion',
    'google-sheets': 'Google Sheets',

    // AI (additional)
    cohere: 'Cohere',
    mubert: 'Mubert',
    suno: 'Suno',
    'runway-video': 'Runway Video',
    'replicate-video': 'Replicate Video',
    'heygen-advanced': 'HeyGen Advanced',

    // Utilities
    resend: 'Resend',
  };

  return names[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

/**
 * Get platform icon name (for lucide-react icons)
 */
export function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    // Existing platforms
    twitter: 'Twitter',
    youtube: 'Youtube',
    instagram: 'Instagram',
    discord: 'MessageSquare',
    telegram: 'Send',
    github: 'Github',
    openai: 'Sparkles',
    anthropic: 'Zap',
    rapidapi: 'Code',
    stripe: 'CreditCard',
    airtable: 'Database',
    sendgrid: 'Mail',
    slack: 'MessageCircle',

    // Video Automation
    runway: 'Video',
    heygen: 'UserCircle',
    synthesia: 'UserSquare',
    whisper: 'Mic',
    elevenlabs: 'Volume2',
    cloudinary: 'Cloud',
    vimeo: 'PlayCircle',
    tiktok: 'Music',

    // Business
    hubspot: 'Building2',
    salesforce: 'CloudLightning',
    pipedrive: 'TrendingUp',
    quickbooks: 'Calculator',
    freshbooks: 'FileText',
    xero: 'Receipt',
    docusign: 'FileSignature',
    hellosign: 'PenTool',

    // Lead Generation
    hunter: 'Search',
    apollo: 'Target',
    clearbit: 'Users',
    zoominfo: 'Telescope',
    lusha: 'UserCheck',
    proxycurl: 'Linkedin',
    phantombuster: 'Bot',
    apify: 'Bug',

    // E-Commerce
    shopify: 'ShoppingBag',
    woocommerce: 'ShoppingCart',
    'amazon-sp': 'Package',
    etsy: 'Store',
    ebay: 'Gavel',
    square: 'CreditCard',
    printful: 'Printer',

    // Content
    medium: 'BookOpen',
    ghost: 'Ghost',
    wordpress: 'FileEdit',
    unsplash: 'Image',
    pexels: 'Camera',
    canva: 'Palette',
    bannerbear: 'Frame',
    placid: 'Layers',

    // Developer Tools
    'github-actions': 'GitBranch',
    circleci: 'Circle',
    jenkins: 'Wrench',
    vercel: 'Triangle',
    netlify: 'Hexagon',
    heroku: 'Server',
    datadog: 'Activity',
    sentry: 'AlertTriangle',

    // Data Processing
    snowflake: 'Snowflake',
    bigquery: 'BarChart',
    redshift: 'ArrowRightLeft',
    kafka: 'Workflow',
    rabbitmq: 'MessageSquare',
    huggingface: 'Brain',
    replicate: 'Copy',

    // Communication (additional)
    twilio: 'Phone',
    whatsapp: 'MessageCircle',
    firebase: 'Flame',
    onesignal: 'Bell',
    zendesk: 'LifeBuoy',
    freshdesk: 'Headphones',
    intercom: 'MessagesSquare',

    // Social (additional)
    reddit: 'MessageSquare',

    // Data (additional)
    mongodb: 'Database',
    postgresql: 'Database',
    mysql: 'Database',
    notion: 'FileText',
    'google-sheets': 'Sheet',

    // AI (additional)
    cohere: 'Sparkles',
    mubert: 'Music',
    suno: 'AudioLines',
    'runway-video': 'Video',
    'replicate-video': 'Clapperboard',
    'heygen-advanced': 'UserCircle2',

    // Utilities
    resend: 'Mail',
  };

  return icons[platform] || 'Key';
}

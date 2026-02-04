/**
 * Game Normalization Configuration
 * 
 * Defines how raw game names from VIPReseller are mapped to our internal game codes.
 * This ensures clean consistent data in our database regardless of provider variations.
 */
export const GAME_NORMALIZATION_RULES = [
  // ==========================================
  // MOBA (Verified)
  // ==========================================
  {
    targetCode: 'mobile-legends',
    providerCode: 'mobile-legends',
    name: 'Mobile Legends: Bang Bang',
    brand: 'Moonton',
    category: 'MOBA',
    emoji: '🎮',
    validationCode: 'mobile-legends',
    isGame: true,
    priority: 100,
    patterns: [/^Mobile Legends/i, /^MLBB/i],
    excludePatterns: [/Joki/i, /Jasa/i, /Membership/i, /Vilog/i]
  },
  {
    targetCode: 'arena-of-valor',
    providerCode: 'arena-of-valor',
    name: 'Arena of Valor',
    brand: 'Garena',
    category: 'MOBA',
    emoji: '⚔️',
    validationCode: 'arena-of-valor',
    isGame: true,
    priority: 90,
    patterns: [/^Arena of Valor/i, /^AOV/i],
    excludePatterns: []
  },
  {
    targetCode: 'league-of-legends-wild-rift',
    providerCode: 'league-of-legends-wild-rift',
    name: 'League of Legends: Wild Rift',
    brand: 'Riot Games',
    category: 'MOBA',
    emoji: '💎',
    validationCode: 'league-of-legends-wild-rift',
    isGame: true,
    priority: 90,
    patterns: [/^League of Legends:? Wild Rift/i, /^Wild Rift/i],
    excludePatterns: []
  },

  // ==========================================
  // BATTLE ROYALE / FPS (Verified)
  // ==========================================
  {
    targetCode: 'free-fire',
    providerCode: 'free-fire',
    name: 'Free Fire',
    brand: 'Garena',
    category: 'Battle Royale',
    emoji: '🔥',
    validationCode: 'free-fire',
    isGame: true,
    priority: 100,
    patterns: [/^Free Fire(?! Max)/i],
    excludePatterns: [/Membership/i]
  },
  {
    targetCode: 'free-fire-max',
    providerCode: 'free-fire-max',
    name: 'Free Fire Max',
    brand: 'Garena',
    category: 'Battle Royale',
    emoji: '💥',
    validationCode: 'free-fire-max',
    isGame: true,
    priority: 95,
    patterns: [/^Free Fire Max/i],
    excludePatterns: []
  },
  {
    targetCode: 'pubg-mobile',
    providerCode: 'pubgm',
    name: 'PUBG Mobile',
    brand: 'Tencent',
    category: 'Battle Royale',
    emoji: '🔫',
    validationCode: 'pubgm',
    isGame: true,
    priority: 90,
    patterns: [/^PUBG Mobile/i, /^PUBGM/i],
    excludePatterns: [/Global/i]
  },
  {
    targetCode: 'valorant',
    providerCode: 'valorant',
    name: 'Valorant',
    brand: 'Riot Games',
    category: 'FPS',
    emoji: '🎯',
    validationCode: 'valorant',
    isGame: true,
    priority: 90,
    patterns: [/^Valorant/i],
    excludePatterns: []
  },

  // ==========================================
  // RPG / OTHERS (Verified)
  // ==========================================
  {
    targetCode: 'genshin-impact',
    providerCode: 'genshin-impact',
    name: 'Genshin Impact',
    brand: 'HoYoverse',
    category: 'RPG',
    emoji: '✨',
    validationCode: 'genshin-impact',
    isGame: true,
    priority: 90,
    patterns: [/^Genshin Impact/i],
    excludePatterns: []
  },
  {
    targetCode: 'hago',
    providerCode: 'hago',
    name: 'Hago',
    brand: 'Hago',
    category: 'Social',
    emoji: '🤝',
    validationCode: 'hago',
    isGame: true,
    priority: 80,
    patterns: [/^Hago/i],
    excludePatterns: []
  },

  // ==========================================
  // VOUCHERS & DIGITAL (Non-Game)
  // ==========================================
  {
    targetCode: 'steam-wallet',
    providerCode: 'steam-wallet',
    name: 'Steam Wallet Code',
    brand: 'Steam',
    category: 'Voucher',
    emoji: '💳',
    validationCode: null,
    isGame: false,
    priority: 50,
    patterns: [/^Steam Wallet/i],
    excludePatterns: []
  },
  {
    targetCode: 'google-play',
    providerCode: 'google-play',
    name: 'Google Play Voucher',
    brand: 'Google',
    category: 'Voucher',
    emoji: '🛍️',
    validationCode: null,
    isGame: false,
    priority: 50,
    patterns: [/^Google Play/i],
    excludePatterns: []
  },
  {
    targetCode: 'psn-card',
    providerCode: 'voucher-psn',
    name: 'Voucher PSN',
    brand: 'Sony',
    category: 'Voucher',
    emoji: '🎮',
    validationCode: null,
    isGame: false,
    priority: 50,
    patterns: [/^Voucher PSN/i, /^PSN Card/i],
    excludePatterns: []
  }
];

export function normalizeGameName(rawName) {
  if (!rawName) return null;

  // Check explicit rules first
  for (const rule of GAME_NORMALIZATION_RULES) {
    const isExcluded = rule.excludePatterns.some(pattern => pattern.test(rawName));
    if (isExcluded) continue;

    const isMatch = rule.patterns.some(pattern => pattern.test(rawName));
    if (isMatch) {
      return {
        code: rule.targetCode,
        name: rule.name,
        brand: rule.brand,
        category: rule.category,
        emoji: rule.emoji,
        validationCode: rule.validationCode,
        isGame: rule.isGame,
        priority: rule.priority,
        originalName: rawName
      };
    }
  }

  // Smart Heuristic for Unmatched
  const isVoucher = /voucher|wallet|gift card|code/i.test(rawName);
  return {
    code: rawName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    name: rawName,
    brand: rawName,
    category: isVoucher ? 'Voucher' : 'Game',
    emoji: isVoucher ? '🎫' : '🎮',
    validationCode: null,
    isGame: !isVoucher,
    priority: 0,
    originalName: rawName
  };
}

export function getGameConfigMap() {
  const map = {};
  GAME_NORMALIZATION_RULES.forEach(rule => {
    map[rule.targetCode] = rule;
  });
  return map;
}

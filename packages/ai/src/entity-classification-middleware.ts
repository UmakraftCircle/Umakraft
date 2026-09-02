import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('EntityClassificationMiddleware');

export type UmamusumeEntityType =
  | 'character'
  | 'skill'
  | 'track'
  | 'support-card'
  | 'scenario'
  | 'pvp-mode'
  | 'mechanic'
  | 'media'
  | 'lore-entity'
  | 'general'
  | 'unknown';

export type SkillClassType =
  | 'acceleration'
  | 'velocity'
  | 'recovery'
  | 'debuff'
  | 'gate'
  | 'vision'
  | 'lane-movement'
  | 'unique'
  | 'passive'
  | 'general';

export interface SkillDetails {
  canonicalName: string;
  japaneseName?: string;
  classType: SkillClassType;
  triggerPhase?: string;
  triggerCondition?: string;
  recommendedStrategy?: string;
  distanceAptitude?: string;
  nativeBearers?: string[];
  goldVersion?: string;
  whiteVersion?: string;
  sourceCards?: string[];
  gametoraUrl?: string;
  umamusuWikiUrl?: string;
  fandomWikiUrl?: string;
}

export interface CharacterDetails {
  canonicalName: string;
  japaneseName?: string;
  role: string;
  voiceActor?: string; // Japanese Voice Actor (Seiyuu)
  birthday?: string;
  epithet?: string;
  realHorseHistory?: string;
  mediaAppearances?: string[];
  growthRates?: Record<string, string>;
  surfaceAptitudes?: Record<string, string>;
  distanceAptitudes?: Record<string, string>;
  strategyAptitudes?: Record<string, string>;
  uniqueSkill?: string;
  gametoraUrl?: string;
  umamusuWikiUrl?: string;
  fandomWikiUrl?: string;
}

export interface MediaLoreDetails {
  canonicalName: string;
  japaneseName?: string;
  category: 'anime' | 'manga' | 'movie' | 'organization' | 'deity' | 'music' | 'lore';
  protagonistOrLead?: string;
  summary?: string;
  releaseOrSetting?: string;
  umamusuWikiUrl?: string;
  fandomWikiUrl?: string;
}

export interface TrackDetails {
  canonicalName: string;
  japaneseName?: string;
  distanceMeters?: number;
  surface?: 'turf' | 'dirt';
  racecourse?: string;
  direction?: 'Clockwise' | 'Counterclockwise' | 'Straight';
  finalStraightLength?: string;
  keyAccelerationPoint?: string;
  gametoraUrl?: string;
  umamusuWikiUrl?: string;
  fandomWikiUrl?: string;
}

export interface SupportCardDetails {
  canonicalName: string;
  japaneseName?: string;
  cardType: 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Intelligence' | 'Friend' | 'Group';
  rarity: 'SSR' | 'SR' | 'R';
  keySkills?: string[];
  keyBonuses?: string;
  gametoraUrl?: string;
  umamusuWikiUrl?: string;
  fandomWikiUrl?: string;
}

export interface EntityClassificationResult {
  isTargetingKnownEntity: boolean;
  primaryType: UmamusumeEntityType;
  canonicalEntity: string | null;
  matchedTerms: string[];
  confidence: 'high' | 'medium' | 'low';
  skillDetails?: SkillDetails;
  characterDetails?: CharacterDetails;
  trackDetails?: TrackDetails;
  supportCardDetails?: SupportCardDetails;
  mediaLoreDetails?: MediaLoreDetails;
  gametoraUrl?: string;
  umamusuWikiUrl?: string;
  fandomWikiUrl?: string;
  recommendedSources: string[];
  formatGuidance: string;
  cleanSearchQuery: string;
}

export interface EntityValidationOptions {
  strictUmamusumeOnly?: boolean;
  allowedTypes?: UmamusumeEntityType[];
  minConfidence?: 'high' | 'medium' | 'low';
}

export interface EntityValidationResult {
  valid: boolean;
  reason?: string;
  classification: EntityClassificationResult;
  formattedGuidelines: string;
  redirectSuggestion?: string;
}

// ─────────────────────────────────────────────────────────────
// KNOWN ENTITY REGISTRIES (Sourced & Enriched from GameTora, umamusu.wiki & Fandom Wiki)
// ─────────────────────────────────────────────────────────────

interface EntityTaxonomyItem {
  canonical: string;
  aliases: string[];
  type: UmamusumeEntityType;
  gametoraUrl?: string;
  umamusuWikiUrl?: string;
  fandomWikiUrl?: string;
  metadata?: any;
}

const CHARACTERS_TAXONOMY: EntityTaxonomyItem[] = [
  {
    canonical: 'Special Week',
    aliases: ['special week', 'spe-chan', 'spe', 'スペシャルウィーク', 'special dreamer', 'specialweek'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/special-week',
    umamusuWikiUrl: 'https://umamusu.wiki/Special_Week',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Special_Week',
    metadata: {
      japaneseName: 'スペシャルウィーク',
      voiceActor: 'Ayaka Ohashi (大橋彩香)',
      birthday: 'May 2',
      epithet: 'Special Dreamer / Japan Cup Hero',
      role: 'Medium/Long Pace Chaser & Leader (Golden Generation)',
      realHorseHistory: '1995–2018 (Sunday Silence x Campaign Girl). 4 G1 wins including 1998 Tokyo Yushun & 1999 Japan Cup. Orphaned at birth, raised by human foster mother.',
      mediaAppearances: ['Anime Season 1 (Lead Protagonist)', 'Anime Season 2', 'Anime Season 3', 'Umayon', 'Umayuru'],
      growthRates: { Stamina: '+20%', Guts: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'F', Mile: 'A', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'A', Pace: 'A', Late: 'B', End: 'C' },
      uniqueSkill: 'Shooting Star (シューティングスター)',
    },
  },
  {
    canonical: 'Silence Suzuka',
    aliases: ['silence suzuka', 'suzuka', 'サイレンススズカ', 'great escape', 'dimension crossing runaway'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/silence-suzuka',
    umamusuWikiUrl: 'https://umamusu.wiki/Silence_Suzuka',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Silence_Suzuka',
    metadata: {
      japaneseName: 'サイレンススズカ',
      voiceActor: 'Marika Kouno (高野麻里佳)',
      birthday: 'May 1',
      epithet: 'Dimension Crossing Runaway / The Great Escape',
      role: 'Mile/Medium Front Runner (Escape / Great Runaway)',
      realHorseHistory: '1994–1998 (Sunday Silence x Waheeda). Legendary front runner with 6 consecutive graded wins including 1998 Takarazuka Kinen. Suffered tragic fracture in 1998 Tenno Sho Autumn.',
      mediaAppearances: ['Anime Season 1 (Co-Lead)', 'Anime Season 2', 'Anime Season 3', 'Umayon', 'Umayuru'],
      growthRates: { Speed: '+20%', Guts: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'D', Mile: 'A', Medium: 'A', Long: 'E' },
      strategyAptitudes: { Front: 'A', Pace: 'B', Late: 'F', End: 'G' },
      uniqueSkill: 'The View from the Lead is Mine! (先頭の景色は譲らない…！)',
    },
  },
  {
    canonical: 'Tokai Teio',
    aliases: ['tokai teio', 'teio', 'トウカイテイオー', 'miracle of teio', 'emperor child'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/tokai-teio',
    umamusuWikiUrl: 'https://umamusu.wiki/Tokai_Teio',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Tokai_Teio',
    metadata: {
      japaneseName: 'トウカイテイオー',
      voiceActor: 'Machico',
      birthday: 'April 20',
      epithet: "Miracle of Teio / The Emperor's Prodigal Child",
      role: 'Medium/Long Pace Chaser & Leader',
      realHorseHistory: '1988–2013 (Symboli Rudolf x Tokai Natural). Undefeated 1991 Satsuki Sho & Tokyo Yushun winner. Overcame 3 major bone fractures to win 1993 Arima Kinen after a 364-day absence.',
      mediaAppearances: ['Anime Season 2 (Lead Protagonist)', 'Anime Season 1', 'Anime Season 3', 'Umayon', 'Umayuru'],
      growthRates: { Speed: '+20%', Stamina: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'F', Mile: 'E', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'B', End: 'F' },
      uniqueSkill: 'Sky-High Teio Step (究極テイオーステップ)',
    },
  },
  {
    canonical: 'Oguri Cap',
    aliases: ['oguri cap', 'oguri', 'オグリキャップ', 'monster of kasamatsu', 'gray monster', 'gray beast'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/oguri-cap',
    umamusuWikiUrl: 'https://umamusu.wiki/Oguri_Cap',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Oguri_Cap',
    metadata: {
      japaneseName: 'オグリキャップ',
      voiceActor: 'Tomoyo Takayanagi (高柳知葉)',
      birthday: 'March 27',
      epithet: 'The Monster of Kasamatsu / Gray Beast of Heisei',
      role: 'Mile/Medium Pace Chaser & Late Runner (Turf & Dirt Dual-Aptitude)',
      realHorseHistory: '1985–2010 (Silver Shark x White Naruko). Regional NAR Kasamatsu phenomenon transferred to JRA, igniting the Second Horse Racing Boom. Won 1988 & 1990 Arima Kinen and 1989 Mile CS.',
      mediaAppearances: ['Umamusume: Cinderella Gray (Lead Protagonist)', 'Anime Season 1', 'Anime Season 2', 'Anime Season 3'],
      growthRates: { Speed: '+20%', Power: '+20%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'B' },
      distanceAptitudes: { Short: 'E', Mile: 'A', Medium: 'A', Long: 'B' },
      strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'A', End: 'D' },
      uniqueSkill: 'Triumphant Pulse (勝利の鼓動)',
    },
  },
  {
    canonical: 'Gold Ship',
    aliases: ['gold ship', 'golshi', 'ゴールドシップ', 'unpredictable trickster'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/gold-ship',
    umamusuWikiUrl: 'https://umamusu.wiki/Gold_Ship',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Gold_Ship',
    metadata: {
      japaneseName: 'ゴールドシップ',
      voiceActor: 'Hitomi Ueda (上田瞳)',
      birthday: 'March 6',
      epithet: 'The Unpredictable Trickster / Golden Warp',
      role: 'Medium/Long End Closer (Oikomi)',
      realHorseHistory: '2009–present (Stay Gold x Point Flag). 6 G1 victories including 2012 Satsuki Sho, Kikuka Sho, Arima Kinen, and 2x Takarazuka Kinen (2013, 2014). Renowned for eccentric antics.',
      mediaAppearances: ['Anime Seasons 1-3 (Team Spica Mainstay)', 'PakaTube! Official VTuber Host', 'Umayon', 'Umayuru'],
      growthRates: { Stamina: '+20%', Power: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'C', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'G', Pace: 'C', Late: 'A', End: 'A' },
      uniqueSkill: 'Anchors Aweigh! (波乱万丈)',
    },
  },
  {
    canonical: 'Mejiro McQueen',
    aliases: ['mejiro mcqueen', 'mcqueen', 'メジロマックイーン', 'end of a dynasty', 'elegant lady'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/mejiro-mcqueen',
    umamusuWikiUrl: 'https://umamusu.wiki/Mejiro_McQueen',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Mejiro_McQueen',
    metadata: {
      japaneseName: 'メジロマックイーン',
      voiceActor: 'Saori Oonishi (大西沙織)',
      birthday: 'April 3',
      epithet: 'The End of a Dynasty / Noble Lady of Mejiro',
      role: 'Medium/Long Leader & Stayers King',
      realHorseHistory: '1987–2006 (Mejiro Titan x Mejiro Aurora). 4 G1 wins including 1990 Kikuka Sho, 1991 & 1992 Tenno Sho Spring, 1993 Takarazuka Kinen. Supreme stayers dynasty heir.',
      mediaAppearances: ['Anime Season 2 (Co-Lead)', 'Anime Season 1', 'Anime Season 3', 'Umayon', 'Umayuru'],
      growthRates: { Stamina: '+20%', Intelligence: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'E' },
      distanceAptitudes: { Short: 'G', Mile: 'F', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'B', End: 'G' },
      uniqueSkill: 'The Duty of Dignity Calls (貴顕の使命を果たすべく)',
    },
  },
  {
    canonical: 'Rice Shower',
    aliases: ['rice shower', 'rice', 'ライスシャワー', 'black assassin', 'hero assassin', 'blue rose'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/rice-shower',
    umamusuWikiUrl: 'https://umamusu.wiki/Rice_Shower',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Rice_Shower',
    metadata: {
      japaneseName: 'ライスシャワー',
      voiceActor: 'Reina Ueda (上田麗奈)',
      birthday: 'March 5',
      epithet: 'The Blue Rose / Black Assassin Turned Hero',
      role: 'Medium/Long Leader & Pace Chaser',
      realHorseHistory: '1989–1995 (Real Shadai x Bamboo Slipper). 3 G1 titles: 1992 Kikuka Sho (broke Mihono Bourbon Triple Crown), 1993 & 1995 Tenno Sho Spring (broke McQueen 3-peat). Tragic fall in 1995 Takarazuka.',
      mediaAppearances: ['Anime Season 2 (Hero Arc)', 'Anime Season 1', 'Umayon', 'Umayuru'],
      growthRates: { Stamina: '+10%', Guts: '+20%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'E', Mile: 'C', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'B', End: 'G' },
      uniqueSkill: 'Blue Rose Closer (ブルーローズ・チェイサー)',
    },
  },
  {
    canonical: 'Daiwa Scarlet',
    aliases: ['daiwa scarlet', 'dasuka', 'ダイワスカーレット', 'miss perfect'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/daiwa-scarlet',
    umamusuWikiUrl: 'https://umamusu.wiki/Daiwa_Scarlet',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Daiwa_Scarlet',
    metadata: {
      japaneseName: 'ダイワスカーレット',
      voiceActor: 'Chisa Kimura (木村千咲)',
      birthday: 'May 13',
      epithet: 'Miss Perfect / Queen of Wire-to-Wire',
      role: 'Mile/Medium Leader & Front Runner',
      realHorseHistory: '2004–present (Agnes Tachyon x Scarlet Bouquet). 12 career starts finishing top-2 in every race. 4 G1 wins including 2007 Oka Sho, Shuka Sho, Queen Elizabeth II Cup, and 2008 Arima Kinen.',
      mediaAppearances: ['Anime Seasons 1-3 (Vodka Rivalry & Spica)', 'Umayon', 'Umayuru'],
      growthRates: { Speed: '+10%', Guts: '+20%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'F', Mile: 'A', Medium: 'A', Long: 'B' },
      strategyAptitudes: { Front: 'A', Pace: 'A', Late: 'E', End: 'G' },
      uniqueSkill: 'Red Ace (ブリリアント・レッド・エース)',
    },
  },
  {
    canonical: 'Vodka',
    aliases: ['vodka', 'ウオッカ', 'derby queen'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/vodka',
    umamusuWikiUrl: 'https://umamusu.wiki/Vodka',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Vodka',
    metadata: {
      japaneseName: 'ウオッカ',
      voiceActor: 'Azumi Waki (和氣あず未)',
      birthday: 'April 4',
      epithet: 'The Derby Queen / Maverick Champion',
      role: 'Mile/Medium Late / Betweener',
      realHorseHistory: '2004–2019 (Tanino Gimlet x Tanino Sister). 7 G1 wins; first filly in 64 years to win the Tokyo Yushun (Japanese Derby) in 2007. Hall of Fame legend.',
      mediaAppearances: ['Anime Seasons 1-3 (Daiwa Scarlet Rivalry & Spica)', 'Umayon', 'Umayuru'],
      growthRates: { Power: '+20%', Speed: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'F' },
      distanceAptitudes: { Short: 'F', Mile: 'A', Medium: 'A', Long: 'F' },
      strategyAptitudes: { Front: 'G', Pace: 'B', Late: 'A', End: 'F' },
      uniqueSkill: 'Cutting Edge (カッティング×DRIVE!)',
    },
  },
  {
    canonical: 'Twin Turbo',
    aliases: ['twin turbo', 'turbo', 'ツインターボ', 'never give up turbo', 'jet engine turbo'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/twin-turbo',
    umamusuWikiUrl: 'https://umamusu.wiki/Twin_Turbo',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Twin_Turbo',
    metadata: {
      japaneseName: 'ツインターボ',
      voiceActor: 'Miharu Hanai (花井美春)',
      birthday: 'April 13',
      epithet: 'The Never-Give-Up Runaway Jet Engine',
      role: 'Mile/Medium Full-Throttle Front Runner (Great Escape)',
      realHorseHistory: '1988–1998 (Lyphard\'s Special x Laser City). Renowned for reckless runaway escapes; won the 1993 Tanabata Sho and 1993 All Comers by massive margins. Major emotional catalyst in Anime Season 2.',
      mediaAppearances: ['Anime Season 2 (Team Canopus Heart)', 'Anime Season 3', 'Umayuru'],
      growthRates: { Speed: '+20%', Guts: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'D', Mile: 'A', Medium: 'A', Long: 'G' },
      strategyAptitudes: { Front: 'A', Pace: 'G', Late: 'G', End: 'G' },
      uniqueSkill: 'Engine Full Throttle! (エンジン全開！大爆走！)',
    },
  },
  {
    canonical: 'Nice Nature',
    aliases: ['nice nature', 'nature', 'ナイスネイチャ', 'bronze collector'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/nice-nature',
    umamusuWikiUrl: 'https://umamusu.wiki/Nice_Nature',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Nice_Nature',
    metadata: {
      japaneseName: 'ナイスネイチャ',
      voiceActor: 'Kaori Maeda (前田佳織里)',
      birthday: 'April 16',
      epithet: 'The Bronze Collector / Beloved Underdog',
      role: 'Medium/Long Late / Betweener & Debuff Specialist',
      realHorseHistory: '1988–2023 (Nice Dancer x Urakawa Miyuki). Famous for finishing 3rd in three consecutive Arima Kinen races (1991, 1992, 1993). Lived to the remarkable age of 35.',
      mediaAppearances: ['Anime Season 2 (Team Canopus Co-Lead)', 'Anime Season 1', 'Anime Season 3', 'Umayuru'],
      growthRates: { Power: '+20%', Guts: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'C', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'C', Pace: 'A', Late: 'A', End: 'C' },
      uniqueSkill: 'Sparkle in the Eyes (きっとその先は…)',
    },
  },
  {
    canonical: 'King Halo',
    aliases: ['king halo', 'king', 'キングヘイロー', 'refined prince'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/king-halo',
    umamusuWikiUrl: 'https://umamusu.wiki/King_Halo',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/King_Halo',
    metadata: {
      japaneseName: 'キングヘイロー',
      voiceActor: 'Iori Saeki (佐伯伊織)',
      birthday: 'April 28',
      epithet: 'Refined Prince of High Pedigree / First-Class Lady',
      role: 'Short/Mile End Closer & Late Runner (Golden Generation)',
      realHorseHistory: '1995–2019 (Dancing Brave x Goodbye Halo). Royal bloodline prodigy who faced 10 G1 defeats before triumphing in the 2000 Takamatsunomiya Kinen.',
      mediaAppearances: ['Anime Season 1 (Team Spica / Golden Generation)', 'Anime Season 2', 'Anime Season 3', 'Umayon'],
      growthRates: { Power: '+20%', Guts: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'A', Mile: 'B', Medium: 'B', Long: 'C' },
      strategyAptitudes: { Front: 'G', Pace: 'B', Late: 'A', End: 'A' },
      uniqueSkill: 'Call Me King (プライド仕込みのパッカプル)',
    },
  },
  {
    canonical: 'Grass Wonder',
    aliases: ['grass wonder', 'grass', 'グラスワンダー', 'wonder of chestnut'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/grass-wonder',
    umamusuWikiUrl: 'https://umamusu.wiki/Grass_Wonder',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Grass_Wonder',
    metadata: {
      japaneseName: 'グラスワンダー',
      voiceActor: 'Rena Maeda (前田玲奈)',
      birthday: 'February 18',
      epithet: 'The Wonder of Chestnut Hair / Fierce Yamato Nadeshiko',
      role: 'Mile/Long Pace Chaser & Late Runner (Golden Generation)',
      realHorseHistory: '1995–2024 (Silver Hawk x Ameriflora). 4 G1 wins including 1997 Asahi Hai Sansai Stakes, 1998 & 1999 Takarazuka Kinen, and 1999 Arima Kinen defeating Special Week.',
      mediaAppearances: ['Anime Season 1 (Team Rigil Rival)', 'Anime Season 2', 'Umayon', 'Umayuru'],
      growthRates: { Speed: '+20%', Guts: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'A', Medium: 'B', Long: 'A' },
      strategyAptitudes: { Front: 'F', Pace: 'A', Late: 'A', End: 'C' },
      uniqueSkill: 'Spirit of the Nadeshiko (精神一到)',
    },
  },
  {
    canonical: 'El Condor Pasa',
    aliases: ['el condor pasa', 'el', 'エルコンドルパサー', 'masked champion', 'world traveler'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/el-condor-pasa',
    umamusuWikiUrl: 'https://umamusu.wiki/El_Condor_Pasa',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/El_Condor_Pasa',
    metadata: {
      japaneseName: 'エルコンドルパサー',
      voiceActor: 'Minami Takahashi (髙橋ミナミ)',
      birthday: 'March 17',
      epithet: 'World Traveling Masked Champion',
      role: 'Mile/Medium Leader & Pace Chaser (Turf & Dirt Dual-Aptitude)',
      realHorseHistory: '1995–2002 (Kingmambo x Saddlers Gal). 1998 NHK Mile Cup & Japan Cup champion. 1999 European campaign: won Grand Prix de Saint-Cloud, 2nd in Prix de l\'Arc de Triomphe.',
      mediaAppearances: ['Anime Season 1 (Team Rigil / Spica Rival)', 'Anime Season 2', 'Umayon', 'Umayuru'],
      growthRates: { Speed: '+20%', Intelligence: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'B' },
      distanceAptitudes: { Short: 'E', Mile: 'A', Medium: 'A', Long: 'B' },
      strategyAptitudes: { Front: 'A', Pace: 'A', Late: 'B', End: 'C' },
      uniqueSkill: 'Plan de Vuelo (プランチャ☆ガナドール)',
    },
  },
  {
    canonical: 'Jungle Pocket',
    aliases: ['jungle pocket', 'pokke', 'ジャンポケ', 'ジャングルポケット', 'beginning of a new era'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/jungle-pocket',
    umamusuWikiUrl: 'https://umamusu.wiki/Jungle_Pocket',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Jungle_Pocket',
    metadata: {
      japaneseName: 'ジャングルポケット',
      voiceActor: 'Yuri Fujimoto (藤本侑里)',
      birthday: 'May 7',
      epithet: 'The Roaring Challenger of the New Era',
      role: 'Medium/Long Late / Betweener Runner',
      realHorseHistory: '1998–2021 (Tony Bin x Dance Charmer). 2001 Tokyo Yushun (Derby) and 2001 Japan Cup champion. 2001 JRA Horse of the Year.',
      mediaAppearances: ['Umamusume: Beginning of a New Era (Movie Lead Protagonist)'],
      growthRates: { Speed: '+10%', Power: '+20%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'C', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'F', Pace: 'C', Late: 'A', End: 'B' },
      uniqueSkill: 'Howling Instinct (唸れ、我が獣性！)',
    },
  },
  {
    canonical: 'Orfevre',
    aliases: ['orfevre', 'オルフェーヴル', 'golden tyrant', 'triple crown orfevre'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/orfevre',
    umamusuWikiUrl: 'https://umamusu.wiki/Orfevre',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Orfevre',
    metadata: {
      japaneseName: 'オルフェーヴル',
      voiceActor: 'Rina Hidaka (日高里菜)',
      birthday: 'May 14',
      epithet: 'The Golden Tyrant / 7th Triple Crown Sovereign',
      role: 'Medium/Long End Closer & Late Runner',
      realHorseHistory: '2008–present (Stay Gold x Oriental Art). 7th Japanese Triple Crown champion (2011), 6 G1 titles, 2x runner-up in Prix de l\'Arc de Triomphe (2012, 2013). Renowned for fierce temperament and overwhelming closing speed.',
      mediaAppearances: ['Game 3rd Anniversary Launch', 'Main Story Part 2'],
      growthRates: { Speed: '+15%', Stamina: '+15%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'E' },
      distanceAptitudes: { Short: 'G', Mile: 'B', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'G', Pace: 'B', Late: 'A', End: 'A' },
      uniqueSkill: 'Tyrant Reign (金色の暴君)',
    },
  },
  {
    canonical: 'Gentildonna',
    aliases: ['gentildonna', 'ジェンティルドンナ', 'iron maiden', 'triple tiara gentildonna'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/gentildonna',
    umamusuWikiUrl: 'https://umamusu.wiki/Gentildonna',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Gentildonna',
    metadata: {
      japaneseName: 'ジェンティルドンナ',
      voiceActor: 'Yu Serizawa (芹澤優)',
      birthday: 'February 20',
      epithet: 'The Iron Maiden / Sovereign of Strength',
      role: 'Medium/Long Pace Chaser & Leader',
      realHorseHistory: '2009–present (Deep Impact x Donna Blini). 2012 Japanese Fillies Triple Tiara winner, 2x Japan Cup (2012, 2013), 2014 Dubai Sheema Classic, 2014 Arima Kinen (7 G1s). Hall of Fame inductee.',
      mediaAppearances: ['Game 3rd Anniversary Launch', 'Main Story Part 2'],
      growthRates: { Power: '+20%', Speed: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'B', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'C', Pace: 'A', Late: 'A', End: 'G' },
      uniqueSkill: 'Majestic Dominance (我が覇道に刮目せよ)',
    },
  },
  {
    canonical: 'Maruzensky',
    aliases: ['maruzensky', 'マルゼンスキー', 'swimsuit maruzensky', 'mizumaru', 'supercar'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/maruzensky',
    umamusuWikiUrl: 'https://umamusu.wiki/Maruzensky',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Maruzensky',
    metadata: {
      japaneseName: 'マルゼンスキー',
      voiceActor: 'Lynn',
      birthday: 'May 19',
      epithet: 'The Supercar / Undefeated Exotic Queen',
      role: 'Short/Mile Front Runner (Escape)',
      realHorseHistory: '1974–1997 (Nijinsky x Shil). Undefeated in 8 starts by an aggregate margin of 61 lengths. 1976 Asahi Hai Sansai Stakes winner.',
      mediaAppearances: ['Anime Seasons 1-3', 'Umayon', 'Umayuru'],
      growthRates: { Speed: '+10%', Intelligence: '+20%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'D' },
      distanceAptitudes: { Short: 'B', Mile: 'A', Medium: 'B', Long: 'C' },
      strategyAptitudes: { Front: 'A', Pace: 'B', Late: 'E', End: 'G' },
      uniqueSkill: 'Red Flame Gear / LP1211-M (紅焔ギア/LP1211-M)',
    },
  },
  {
    canonical: 'Symboli Rudolf',
    aliases: ['symboli rudolf', 'rudolf', 'emperor', 'シンボリルドルフ', 'president rudolf'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/symboli-rudolf',
    umamusuWikiUrl: 'https://umamusu.wiki/Symboli_Rudolf',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Symboli_Rudolf',
    metadata: {
      japaneseName: 'シンボリルドルフ',
      voiceActor: 'Azusa Tadokoro (田所あずさ)',
      birthday: 'March 13',
      epithet: 'The Emperor / Seven-Crown Sovereign',
      role: 'Medium/Long Pace Chaser & Late Runner (Student Council President)',
      realHorseHistory: '1981–2011 (Partholon x Sweet Luna). Japan\'s first undefeated Triple Crown champion (1984), 7 G1 wins including 2x Arima Kinen, Japan Cup, Tenno Sho Spring.',
      mediaAppearances: ['Anime Seasons 1-3 (Student Council President)', 'Umayon', 'Umayuru'],
      growthRates: { Stamina: '+20%', Guts: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'E' },
      distanceAptitudes: { Short: 'E', Mile: 'C', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'A', End: 'C' },
      uniqueSkill: "Behold Thine Emperor's Divine Might (汝、皇帝の神威を見よ)",
    },
  },
  {
    canonical: 'Narita Taishin',
    aliases: ['narita taishin', 'taishin', 'ナリタタイシン', 'bnw taishin'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/narita-taishin',
    umamusuWikiUrl: 'https://umamusu.wiki/Narita_Taishin',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Narita_Taishin',
    metadata: {
      japaneseName: 'ナリタタイシン',
      voiceActor: 'Keiko Watanabe (渡部恵子)',
      birthday: 'June 10',
      epithet: 'The Prickly Miracle / BNW Generation Spurt',
      role: 'Medium/Long End Closer (Oikomi)',
      realHorseHistory: '1990–2020 (Rivlia x Taishin Lily). 1993 Satsuki Sho champion with legendary closing burst; formed the iconic BNW rivalry with Biwa Hayahide and Winning Ticket.',
      mediaAppearances: ['BNW\'s Oath OVA', 'Anime Season 2', 'Umayon'],
      growthRates: { Speed: '+10%', Guts: '+20%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'D', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'G', Pace: 'D', Late: 'B', End: 'A' },
      uniqueSkill: 'Nemesis (Nemesis)',
    },
  },
  {
    canonical: 'Kitasan Black',
    aliases: ['kitasan black', 'kitasan', 'キタサンブラック', 'festival king'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/kitasan-black',
    umamusuWikiUrl: 'https://umamusu.wiki/Kitasan_Black',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Kitasan_Black',
    metadata: {
      japaneseName: 'キタサンブラック',
      voiceActor: 'Hinaki Yano (矢野妃菜喜)',
      birthday: 'March 10',
      epithet: "Festival King / The People's Champion",
      role: 'Medium/Long Front Runner & Leader',
      realHorseHistory: '2012–present (Black Tide x Sugar Heart). Owned by enka singer Saburo Kitajima. 7 G1 victories including 2015 Kikuka Sho, 2x Tenno Sho Spring, 2016 Japan Cup, 2017 Arima Kinen.',
      mediaAppearances: ['Anime Season 3 (Lead Protagonist)', 'Anime Season 2 (Childhood)', 'Umayuru'],
      growthRates: { Speed: '+20%', Stamina: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'E', Mile: 'C', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'A', Pace: 'A', Late: 'E', End: 'G' },
      uniqueSkill: 'Victory Cheer! (勝ち鬨ワッショイ！)',
    },
  },
  {
    canonical: 'Satono Diamond',
    aliases: ['satono diamond', 'satono', 'dia', 'サトノダイヤモンド', 'curse breaker'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/satono-diamond',
    umamusuWikiUrl: 'https://umamusu.wiki/Satono_Diamond',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Satono_Diamond',
    metadata: {
      japaneseName: 'サトノダイヤモンド',
      voiceActor: 'Hina Tachibana (立花日菜)',
      birthday: 'January 30',
      epithet: 'The Curse Breaker / Noble Diamond of Satono',
      role: 'Medium/Long Late / Betweener',
      realHorseHistory: '2013–present (Deep Impact x Malpensa). Broke the "Satono Curse" by winning owner Hajime Satomi\'s first JRA G1 (2016 Kikuka Sho) and the 2016 Arima Kinen.',
      mediaAppearances: ['Anime Season 3 (Co-Lead)', 'Anime Season 2 (Childhood)', 'Umayuru'],
      growthRates: { Stamina: '+15%', Guts: '+15%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'C', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'E', Pace: 'B', Late: 'A', End: 'B' },
      uniqueSkill: 'Brilliance in Flight (波及する祝福)',
    },
  },
  {
    canonical: 'Haru Urara',
    aliases: ['haru urara', 'urara', 'ハルウララ', 'shining star of kochi'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/haru-urara',
    umamusuWikiUrl: 'https://umamusu.wiki/Haru_Urara',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Haru_Urara',
    metadata: {
      japaneseName: 'ハルウララ',
      voiceActor: 'Yukina Shutou (首藤志奈)',
      birthday: 'February 27',
      epithet: 'The Shining Star of Kochi / Symbol of Perseverance',
      role: 'Short Dirt End Closer / Late Runner',
      realHorseHistory: '1996–present (Nippo Teio x Heroine). Famous nationwide in Japan for racing 113 times without a single victory (0-for-113 record), embodying unwavering optimism.',
      mediaAppearances: ['Anime Seasons 1-3', 'Umayon', 'Umayuru'],
      growthRates: { Guts: '+20%', Power: '+10%' },
      surfaceAptitudes: { Turf: 'G', Dirt: 'A' },
      distanceAptitudes: { Short: 'A', Mile: 'B', Medium: 'E', Long: 'G' },
      strategyAptitudes: { Front: 'G', Pace: 'D', Late: 'A', End: 'A' },
      uniqueSkill: "114th Time's the Charm (うらら～な休日)",
    },
  },
  {
    canonical: 'Super Creek',
    aliases: ['super creek', 'creek', 'スーパークリーク', 'mama creek'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/super-creek',
    umamusuWikiUrl: 'https://umamusu.wiki/Super_Creek',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Super_Creek',
    metadata: {
      japaneseName: 'スーパークリーク',
      voiceActor: 'Kana Yuuki (優木かな)',
      birthday: 'May 27',
      epithet: 'Affectionate Mother / Stamina Master',
      role: 'Medium/Long Leader',
      realHorseHistory: '1985–2010 (No Attention x Nice Day). 3 G1 wins: 1988 Kikuka Sho, 1989 & 1990 Tenno Sho (Autumn & Spring). Yutaka Take\'s breakout classic champion.',
      mediaAppearances: ['Anime Season 1 & 2', 'Cinderella Gray', 'Umayon'],
      growthRates: { Stamina: '+10%', Intelligence: '+20%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'G', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'B', End: 'G' },
      uniqueSkill: 'Clear Heart (ピュアハート)',
    },
  },
  {
    canonical: 'Sakura Bakushin O',
    aliases: ['sakura bakushin o', 'bakushin', 'サクラバクシンオー', 'bakushin bakushin'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/sakura-bakushin-o',
    umamusuWikiUrl: 'https://umamusu.wiki/Sakura_Bakushin_O',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Sakura_Bakushin_O',
    metadata: {
      japaneseName: 'サクラバクシンオー',
      voiceActor: 'Sachika Misawa (三澤紗千香)',
      birthday: 'April 14',
      epithet: 'The Indomitable Class Rep / Sprint King',
      role: 'Short/Mile Front Runner & Leader',
      realHorseHistory: '1989–2018 (Sakura Yutaka O x Sakura Hagoromo). Undisputed King of Japanese Sprints with 11 wins from 21 starts, including back-to-back Sprinters Stakes (1993, 1994).',
      mediaAppearances: ['Anime Seasons 1-3', 'Umayon', 'Umayuru'],
      growthRates: { Speed: '+20%', Intelligence: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'A', Mile: 'B', Medium: 'F', Long: 'G' },
      strategyAptitudes: { Front: 'A', Pace: 'A', Late: 'D', End: 'G' },
      uniqueSkill: 'Class Rep + Speed = Bakushin (進め！学級委員長！)',
    },
  },
  {
    canonical: 'Mejiro Dober',
    aliases: ['mejiro dober', 'dober', 'メジロドーベル'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/mejiro-dober',
    umamusuWikiUrl: 'https://umamusu.wiki/Mejiro_Dober',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Mejiro_Dober',
    metadata: {
      japaneseName: 'メジロドーベル',
      voiceActor: 'Misaki Watada (久保田ひかり / 和多田美咲)',
      birthday: 'May 6',
      epithet: 'Mejiro Queen of the Turf',
      role: 'Mile/Medium Late / Betweener Runner',
      realHorseHistory: '1994–present (Mejiro Ryan x Mejiro Beauty). 5 G1 titles including 1996 Hanshin Sansai Himba, 1997 Yushun Himba, Shuka Sho, 1998 & 1999 Queen Elizabeth II Commemorative Cup.',
      mediaAppearances: ['Anime Season 2', 'Umayuru'],
      growthRates: { Power: '+20%', Intelligence: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'F', Mile: 'A', Medium: 'A', Long: 'E' },
      strategyAptitudes: { Front: 'G', Pace: 'A', Late: 'A', End: 'C' },
      uniqueSkill: "Let's Pump Some Iron! / Let's Anate (彼方、その先へ…)",
    },
  },
  {
    canonical: 'Seiun Sky',
    aliases: ['seiun sky', 'seiun', 'セイウンスカイ', 'trickster of the breeze'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/seiun-sky',
    umamusuWikiUrl: 'https://umamusu.wiki/Seiun_Sky',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Seiun_Sky',
    metadata: {
      japaneseName: 'セイウンスカイ',
      voiceActor: 'Akari Kito (鬼頭明里)',
      birthday: 'April 26',
      epithet: 'Trickster of the Breeze / Escape Tactician',
      role: 'Medium/Long Front Runner (Escape / Golden Generation)',
      realHorseHistory: '1995–2011 (Nishino Flower line bloodlines). 1998 Satsuki Sho and Kikuka Sho champion, setting a world record 3:03.2 in the 3000m Kikuka Sho.',
      mediaAppearances: ['Anime Season 1 (Golden Generation Rival)', 'Anime Season 2', 'Umayon'],
      growthRates: { Stamina: '+10%', Intelligence: '+20%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'C', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'A', Pace: 'B', Late: 'E', End: 'G' },
      uniqueSkill: 'Angling and Scheming (アングリング×スキーミング)',
    },
  },
  {
    canonical: 'Tamamo Cross',
    aliases: ['tamamo cross', 'tamamo', 'タマモクロス', 'white lightning'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/tamamo-cross',
    umamusuWikiUrl: 'https://umamusu.wiki/Tamamo_Cross',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Tamamo_Cross',
    metadata: {
      japaneseName: 'タマモクロス',
      voiceActor: 'Naomi Ozora (大空直美)',
      birthday: 'May 23',
      epithet: 'White Lightning of Kansai',
      role: 'Medium/Long Late / End Closer',
      realHorseHistory: '1984–2003 (C.B. Cross x Green Chateaux). 1988 Spring and Autumn Tenno Sho sweep (first in history) and 1988 Takarazuka Kinen winner. Fierce archrival of Oguri Cap.',
      mediaAppearances: ['Umamusume: Cinderella Gray (Major Antagonist/Rival)', 'Anime Season 1 & 2', 'Umayon'],
      growthRates: { Stamina: '+20%', Power: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'E' },
      distanceAptitudes: { Short: 'F', Mile: 'B', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'B', Pace: 'B', Late: 'A', End: 'A' },
      uniqueSkill: 'White Lightning Burst (白い稲妻、見せたるで！)',
    },
  },
  {
    canonical: 'Fine Motion',
    aliases: ['fine motion', 'ファインモーション', 'irish royalty'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/fine-motion',
    umamusuWikiUrl: 'https://umamusu.wiki/Fine_Motion',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Fine_Motion',
    metadata: {
      japaneseName: 'ファインモーション',
      voiceActor: 'Chinatsu Akasaki (赤﨑千夏)',
      birthday: 'January 27',
      epithet: 'Irish Royal Princess',
      role: 'Mile/Medium Leader & Pace Chaser',
      realHorseHistory: '1999–present (Danehill x Cocotte). Irish-bred champion who won the 2002 Shuka Sho and 2002 Queen Elizabeth II Commemorative Cup undefeated.',
      mediaAppearances: ['Anime Season 1 & 2', 'Umayuru'],
      growthRates: { Power: '+15%', Intelligence: '+15%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'E', Mile: 'A', Medium: 'A', Long: 'C' },
      strategyAptitudes: { Front: 'C', Pace: 'A', Late: 'B', End: 'G' },
      uniqueSkill: "Fairy's Tale (フェアリーテイル)",
    },
  },
  {
    canonical: 'Agnes Tachyon',
    aliases: ['agnes tachyon', 'tachyon', 'アグネスタキオン', 'mad scientist of speed'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/agnes-tachyon',
    umamusuWikiUrl: 'https://umamusu.wiki/Agnes_Tachyon',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Agnes_Tachyon',
    metadata: {
      japaneseName: 'アグネスタキオン',
      voiceActor: 'Sumire Uesaka (上坂すみれ)',
      birthday: 'April 13',
      epithet: 'The Mad Scientist of Speed',
      role: 'Medium/Long Leader',
      realHorseHistory: '1998–2009 (Sunday Silence x Agnes Flora). Undefeated in all 4 starts, capturing the 2001 Satsuki Sho before career-ending bowing tendonitis. Sire of Daiwa Scarlet and Deep Sky.',
      mediaAppearances: ['Umamusume: Beginning of a New Era (Lead Cast)', 'Anime Seasons 1-3', 'Umayon'],
      growthRates: { Speed: '+20%', Guts: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'D', Medium: 'A', Long: 'B' },
      strategyAptitudes: { Front: 'E', Pace: 'A', Late: 'B', End: 'G' },
      uniqueSkill: 'U = ma^2 (U=ma2)',
    },
  },
  {
    canonical: 'Manhattan Cafe',
    aliases: ['manhattan cafe', 'cafe', 'マンハッタンカフェ', 'friend of the dead'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/manhattan-cafe',
    umamusuWikiUrl: 'https://umamusu.wiki/Manhattan_Cafe',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Manhattan_Cafe',
    metadata: {
      japaneseName: 'マンハッタンカフェ',
      voiceActor: 'Yui Ogura (小倉唯)',
      birthday: 'March 5',
      epithet: 'Ghost Seer of the Fog / Friend of the Dead',
      role: 'Long/Medium Late / Betweener',
      realHorseHistory: '1998–2015 (Sunday Silence x Subtle Change). 3 G1 wins: 2001 Kikuka Sho, 2001 Arima Kinen, 2002 Tenno Sho Spring.',
      mediaAppearances: ['Umamusume: Beginning of a New Era (Lead Cast)', 'Anime Season 3', 'Umayuru'],
      growthRates: { Stamina: '+30%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'E', Medium: 'B', Long: 'A' },
      strategyAptitudes: { Front: 'F', Pace: 'B', Late: 'A', End: 'B' },
      uniqueSkill: 'Shadowy Solitude (リメンバー・マイ・ダーク)',
    },
  },
  {
    canonical: 'Copano Rickey',
    aliases: ['copano rickey', 'rickey', 'コパノリッキー', 'feng shui master'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/copano-rickey',
    umamusuWikiUrl: 'https://umamusu.wiki/Copano_Rickey',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Copano_Rickey',
    metadata: {
      japaneseName: 'コパノリッキー',
      voiceActor: 'Yuuri Inami (稲垣好 / 稲波優理)',
      birthday: 'March 24',
      epithet: 'The Feng Shui Dirt Master / Emperor of Dirt',
      role: 'Dirt Mile/Medium Front Runner & Leader',
      realHorseHistory: '2010–present (Gold Allure x Copano Nikita). All-time record 11 G1/Jpn1 dirt victories including 2x February Stakes, Champions Cup, 3x Kashiwa Kinen, 2x Teio Sho.',
      mediaAppearances: ['Dirt Scenario Campaign', 'Umayuru'],
      growthRates: { Speed: '+10%', Power: '+10%', Intelligence: '+10%' },
      surfaceAptitudes: { Turf: 'F', Dirt: 'A' },
      distanceAptitudes: { Short: 'D', Mile: 'A', Medium: 'A', Long: 'G' },
      strategyAptitudes: { Front: 'A', Pace: 'A', Late: 'D', End: 'G' },
      uniqueSkill: 'Dragon Pulse Calling (理運開かりて、験あり)',
    },
  },
  {
    canonical: 'Duramente',
    aliases: ['duramente', 'ドゥラメンテ', 'two-crown king'],
    type: 'character',
    gametoraUrl: 'https://gametora.com/umamusume/characters/duramente',
    umamusuWikiUrl: 'https://umamusu.wiki/Duramente',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Duramente',
    metadata: {
      japaneseName: 'ドゥラメンテ',
      voiceActor: 'Akane Akimoto (秋奈)',
      birthday: 'March 22',
      epithet: 'Two-Crown King of Unbound Power',
      role: 'Medium/Long Late / End Closer',
      realHorseHistory: '2012–2021 (King Kamehameha x Admire Groove). Explosive 2015 Satsuki Sho and Tokyo Yushun (Derby) Double Crown champion.',
      mediaAppearances: ['Anime Season 3 (Kitasan Black Archrival)'],
      growthRates: { Speed: '+20%', Power: '+10%' },
      surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
      distanceAptitudes: { Short: 'G', Mile: 'C', Medium: 'A', Long: 'A' },
      strategyAptitudes: { Front: 'F', Pace: 'B', Late: 'A', End: 'A' },
      uniqueSkill: 'Overwhelming Domination (覇王の進撃)',
    },
  },
];

const SKILLS_TAXONOMY: EntityTaxonomyItem[] = [
  // ── Acceleration Skills (Orange / Gold / White) ──
  {
    canonical: 'Straightaway Spurt',
    aliases: [
      'straightaway spurt',
      'chokusen ikki',
      '直線一気',
      'straight-line spurt',
      'straight spurt',
    ],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '直線一気 (Chokusen Ikki)',
      classType: 'acceleration',
      triggerPhase: 'Final Straight / Last Spurt Phase (Phase 2/3 onset)',
      triggerCondition: 'Running Strategy = End Closer (追込 / Oikomi), Distance = Long/Medium',
      recommendedStrategy: 'End Closer (追込 / Oikomi)',
      distanceAptitude: 'Long / Medium',
      goldVersion: 'Shadow Break / Rising Dragon (迫る影)',
      nativeBearers: ['Gold Ship', 'Narita Taishin (Gold: Lv5)', 'Mr. C.B.', 'Inari One'],
      sourceCards: ['SSR Stamina Mejiro Dober', 'SSR Speed Narita Taishin', 'SSR Power Hishi Amazon', 'SSR Int Mr. C.B.'],
    },
  },
  {
    canonical: 'Shadow Break / Rising Dragon',
    aliases: ['shadow break', 'rising dragon', 'semaru kage', '迫る影', 'shadowbreak'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '迫る影 (Semaru Kage)',
      classType: 'acceleration',
      triggerPhase: 'Final Straight / Last Spurt Phase (Phase 2/3 onset)',
      triggerCondition: 'Running Strategy = End Closer (追込 / Oikomi), Last Spurt straight activation',
      recommendedStrategy: 'End Closer (追込 / Oikomi)',
      whiteVersion: 'Straightaway Spurt (直線一気)',
      nativeBearers: ['Narita Taishin (Awakening Lv5)', 'Mr. C.B. (SSR / Awakening)'],
      sourceCards: ['SSR Narita Taishin (Speed)', 'SSR Mr. C.B. (Int)'],
    },
  },
  {
    canonical: 'Angling and Scheming',
    aliases: ['angling and scheming', 'an-ski', 'anski', 'アングリング×スキーミング', 'angling x scheming'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: 'アングリング×スキーミング',
      classType: 'acceleration',
      triggerPhase: 'Final Corner (Position: 1st place)',
      triggerCondition: 'Race Phase = Phase 2 / Final Corner, Rank = 1 (Front Runner)',
      recommendedStrategy: 'Front Runner (逃げ / Escape)',
      nativeBearers: ['Seiun Sky (セイウンスカイ)'],
      sourceCards: ['Inheritance from Seiun Sky unique factor'],
    },
  },
  {
    canonical: "Let's Pump Some Iron! / Let's Anate",
    aliases: ["let's pump some iron", "let's anate", 'kanata', '彼方、その先へ…', 'anate', 'lets anate'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '彼方、その先へ… (Kanata, Sono Saki e...)',
      classType: 'acceleration',
      triggerPhase: 'Mid-to-Late Final Corner (5th-6th in 9-runner / 50-70% pack position)',
      triggerCondition: 'Race Phase = Final Corner, Rank = 5-6 (Betweener / Late Runner)',
      recommendedStrategy: 'Betweener / Late Runner (差し / Sashi)',
      nativeBearers: ['Mejiro Dober (メジロドーベル)'],
      sourceCards: ['Inheritance from Mejiro Dober unique factor'],
    },
  },
  {
    canonical: 'Non-Stop Girl',
    aliases: ['non-stop girl', 'non stop girl', 'ノンストップガール', 'tareuma', 'flock avoidance', 'crowd hazard'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: 'ノンストップガール (Non-Stop Girl)',
      classType: 'acceleration',
      triggerPhase: 'Last Spurt when blocked behind another runner for ≥1s',
      triggerCondition: 'Race Phase = Last Spurt, Target Uma Musume in front within 1 lane',
      recommendedStrategy: 'Between / Late / End Closers',
      whiteVersion: 'Crowd Hazard / Disperse (垂れウマ回避)',
      sourceCards: ['SSR Int Fine Motion', 'SSR Speed Yukino Bijin', 'SSR Guts Mayano Top Gun'],
    },
  },
  {
    canonical: 'Groundwork',
    aliases: ['groundwork', 'jigatame', '地固め', 'early prep', 'firm groundwork'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '地固め (Jigatame)',
      classType: 'acceleration',
      triggerPhase: 'Opening Leg (Race Start) if 3+ passive skills activated',
      triggerCondition: 'Opening Leg, 3 or more green passive skills activated at gate',
      recommendedStrategy: 'Front Runner (Runner / Escape)',
      sourceCards: ['SSR Speed Seiun Sky', 'SSR Int Mihono Bourbon', 'SSR Speed Smart Falcon'],
    },
  },
  {
    canonical: 'Red Flame Gear / LP1211-M',
    aliases: ['red flame gear', 'kouen gear', '紅焔ギア', '紅焔ギア/lp1211-m', 'maruzensky unique'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '紅焔ギア/LP1211-M',
      classType: 'acceleration',
      triggerPhase: 'Final Corner (Position: Top 5 in 9-runner pack)',
      triggerCondition: 'Race Phase = Final Corner, Rank ≤ 5',
      recommendedStrategy: 'Front Runner / Leader',
      nativeBearers: ['Maruzensky (マルゼンスキー)'],
      sourceCards: ['Inheritance from Maruzensky unique factor'],
    },
  },
  {
    canonical: 'Swift Acceleration / Quick Decision',
    aliases: ['swift acceleration', 'quick decision', '疾風怒濤', '迅速果断'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '疾風怒濤 (Shippuu Dotou) / 迅速果断 (Jinsoku Kadan)',
      classType: 'acceleration',
      triggerPhase: 'Middle Leg / Final Leg Transition',
      recommendedStrategy: 'Late Runner / Betweener',
      sourceCards: ['SSR Speed Duramente', 'SSR Int Agnes Tachyon'],
    },
  },

  // ── Recovery Skills (Blue / Stamina) ──
  {
    canonical: 'Circle of Maestro / Arc Maestro',
    aliases: ['circle of maestro', 'maestro', 'arc maestro', '円弧のマエストロ', 'enco no maestro'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '円弧のマエストロ (Enko no Maestro)',
      classType: 'recovery',
      triggerPhase: 'Random Corner during Middle Leg',
      triggerCondition: 'Middle Leg corner traversal, recovers 5.5% stamina (Gold)',
      recommendedStrategy: 'All Strategies (Universal / Medium & Long distances)',
      goldVersion: 'Circle of Maestro (Arc Maestro)',
      whiteVersion: 'Corner Recovery ◯ (コーナー回復◯)',
      nativeBearers: ['Super Creek', 'Curren Chan (Summer)'],
      sourceCards: ['SSR Stamina Super Creek', 'SSR Power Rice Shower'],
    },
  },
  {
    canonical: 'Gourmand / Stamina Keeper',
    aliases: ['gourmand', 'くいしんぼう', '食いしん坊', 'stamina keeper'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '食いしん坊 (Kuishinbou)',
      classType: 'recovery',
      triggerPhase: 'Middle Leg (Strategy = Leader / Pace Chaser)',
      recommendedStrategy: 'Leader (先行 / Senkou)',
      goldVersion: 'Gourmand (食いしん坊)',
      whiteVersion: 'Stamina Keeper (スタミナキープ)',
      nativeBearers: ['Special Week (Event)', 'Oguri Cap'],
      sourceCards: ['SSR Speed Special Week (Event)', 'SSR Stamina Super Creek'],
    },
  },
  {
    canonical: 'Cooldown / Deep Breath',
    aliases: ['cooldown', 'cool down', 'クールダウン', 'deep breath', '深呼吸'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: 'クールダウン (Cool Down) / 深呼吸 (Deep Breath)',
      classType: 'recovery',
      triggerPhase: 'Random Straight (Distance = Long)',
      recommendedStrategy: 'Long Distance (All Strategies)',
      goldVersion: 'Cooldown',
      whiteVersion: 'Deep Breath',
      nativeBearers: ['Mejiro McQueen (Awakening)'],
      sourceCards: ['SSR Stamina Mejiro McQueen'],
    },
  },

  // ── Velocity Skills (Yellow / Speed) ──
  {
    canonical: 'Professor of Curren / Corner Adept',
    aliases: ['professor of curren', 'curren professor', '弧線のプロフェッサー', 'corner adept', 'kosen'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '弧線のプロフェッサー (Kosen no Professor)',
      classType: 'velocity',
      triggerPhase: 'Random Corner in Middle Leg (Cooldown: 30s)',
      triggerCondition: 'Corner entered, increases target speed by 0.35m/s (Gold) for 2.4s',
      recommendedStrategy: 'All Strategies (Universal Speed Skill)',
      goldVersion: 'Professor of Curren',
      whiteVersion: 'Corner Adept ◯ (コーナー巧者◯)',
      nativeBearers: ['Symboli Rudolf', 'Tokai Teio'],
      sourceCards: ['SSR Speed Kitasan Black (Guaranteed on Event 3)'],
    },
  },
  {
    canonical: 'Tail Held High',
    aliases: ['tail held high', 'tail flare', '尻尾上がり', 'shippo agari', '尻尾の滝登り'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '尻尾上がり (Shippo Agari)',
      classType: 'velocity',
      triggerPhase: 'Middle Leg (when 3+ skills have triggered in Middle Leg)',
      triggerCondition: 'Middle Leg, 3 or more skills triggered',
      recommendedStrategy: 'All Strategies (Essential High-Efficiency Skill)',
      goldVersion: 'Tail Cascade (尻尾の滝登り)',
      whiteVersion: 'Tail Held High (尻尾上がり)',
      sourceCards: ['SSR Int Agnes Tachyon', 'SSR Int Fine Motion', 'SR Int Marvelous Sunday'],
    },
  },
  {
    canonical: 'Shooting Star',
    aliases: ['shooting star', 'シューティングスター'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: 'シューティングスター (Shooting Star)',
      classType: 'velocity',
      triggerPhase: 'Final Stretch (Top half of pack, overtaking)',
      recommendedStrategy: 'Pace Chaser / Leader',
      nativeBearers: ['Special Week (スペシャルウィーク)'],
    },
  },
  {
    canonical: 'Triumphant Pulse',
    aliases: ['triumphant pulse', 'shouri no kodou', '勝利の鼓動', 'oguri unique'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '勝利の鼓動 (Shouri no Kodou)',
      classType: 'velocity',
      triggerPhase: 'Remaining 200m (Rank 2-5 in 9-runner race)',
      triggerCondition: 'Remaining distance ≤ 200m, Rank 2 to 5',
      recommendedStrategy: 'Pace Chaser / Betweener',
      nativeBearers: ['Oguri Cap (オグリキャップ)'],
    },
  },

  // ── Passive Skills (Green / Conditions) ──
  {
    canonical: 'Right Turn / Clockwise',
    aliases: ['right turn', 'clockwise', '右回り', '右回り◯', '右回りの鬼'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '右回り◯ (Migi Mawari)',
      classType: 'passive',
      triggerPhase: 'Race Start (Passive Speed Boost on Clockwise Tracks like Nakayama, Kyoto, Hanshin, Oi)',
      recommendedStrategy: 'All Strategies',
      sourceCards: ['SSR Speed Fine Motion', 'SSR Stamina Super Creek'],
    },
  },
  {
    canonical: 'Left Turn / Counterclockwise',
    aliases: ['left turn', 'counterclockwise', '左回り', '左回り◯', '左回りの鬼'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '左回り◯ (Hidari Mawari)',
      classType: 'passive',
      triggerPhase: 'Race Start (Passive Speed Boost on Counterclockwise Tracks like Tokyo, Chukyo, Niigata)',
      recommendedStrategy: 'All Strategies',
      sourceCards: ['SSR Speed Silence Suzuka', 'SSR Power Vodka'],
    },
  },

  // ── Debuff Skills (Red / Sabotage) ──
  {
    canonical: 'Eight-Way Gaze / All-Seeing Eye',
    aliases: ['eight-way gaze', 'all-seeing eye', '八方にらみ', '千里眼', 'sightline', 'まなざし'],
    type: 'skill',
    gametoraUrl: 'https://gametora.com/umamusume/skills',
    metadata: {
      japaneseName: '八方にらみ (Happou Nirami)',
      classType: 'debuff',
      triggerPhase: 'Last Spurt Phase (drains stamina from all opponents in field of view)',
      triggerCondition: 'Strategy = Late Runner (差し / Sashi)',
      recommendedStrategy: 'Late Runner (Evil Nature Saboteur Build)',
      nativeBearers: ['Nice Nature (ナイスネイチャ)'],
      sourceCards: ['SSR Int Nice Nature'],
    },
  },
];

const TRACKS_TAXONOMY: EntityTaxonomyItem[] = [
  {
    canonical: 'Arima Kinen',
    aliases: ['arima kinen', 'arima', '有馬記念', 'nakayama 2500m', 'nakayama 2500'],
    type: 'track',
    gametoraUrl: 'https://gametora.com/umamusume/racetracks',
    metadata: {
      japaneseName: '有馬記念 (Arima Kinen)',
      distanceMeters: 2500,
      surface: 'turf',
      racecourse: 'Nakayama (中山競馬場)',
      direction: 'Clockwise',
      finalStraightLength: '310.0m (Steep final hill ascent)',
      keyAccelerationPoint: 'Third Corner / Final Straight transition (Last 833m remaining)',
    },
  },
  {
    canonical: 'Japan Cup',
    aliases: ['japan cup', 'ジャパンカップ', 'tokyo 2400m', 'tokyo 2400', 'japanese derby', 'tokyo yushun', '日本ダービー'],
    type: 'track',
    gametoraUrl: 'https://gametora.com/umamusume/racetracks',
    metadata: {
      japaneseName: 'ジャパンカップ (Japan Cup) / 日本ダービー (Tokyo Yushun)',
      distanceMeters: 2400,
      surface: 'turf',
      racecourse: 'Tokyo (東京競馬場)',
      direction: 'Counterclockwise',
      finalStraightLength: '525.9m (Long straight with moderate uphill rise)',
      keyAccelerationPoint: 'Final Corner Exit into Long Straight (Last 800m remaining)',
    },
  },
  {
    canonical: 'Tenno Sho Spring',
    aliases: ['tenno sho spring', 'tenno sho (spring)', 'tennosho spring', '天皇賞（春）', 'kyoto 3200m', 'kyoto 3200'],
    type: 'track',
    gametoraUrl: 'https://gametora.com/umamusume/racetracks',
    metadata: {
      japaneseName: '天皇賞（春） (Tenno Sho Spring)',
      distanceMeters: 3200,
      surface: 'turf',
      racecourse: 'Kyoto (京都競馬場 Outer)',
      direction: 'Clockwise',
      finalStraightLength: '403.7m',
      keyAccelerationPoint: 'Third Corner Hill Crest & Descent (Last 1067m remaining)',
    },
  },
  {
    canonical: 'Tenno Sho Autumn',
    aliases: ['tenno sho autumn', 'tenno sho (autumn)', 'tennosho autumn', '天皇賞（秋）', 'tokyo 2000m', 'tokyo 2000'],
    type: 'track',
    gametoraUrl: 'https://gametora.com/umamusume/racetracks',
    metadata: {
      japaneseName: '天皇賞（秋） (Tenno Sho Autumn)',
      distanceMeters: 2000,
      surface: 'turf',
      racecourse: 'Tokyo (東京競馬場)',
      direction: 'Counterclockwise',
      finalStraightLength: '525.9m',
      keyAccelerationPoint: 'Final Corner to Straight (Last 667m remaining)',
    },
  },
  {
    canonical: 'Takarazuka Kinen',
    aliases: ['takarazuka kinen', 'takarazuka', '宝塚記念', 'hanshin 2200m'],
    type: 'track',
    gametoraUrl: 'https://gametora.com/umamusume/racetracks',
    metadata: {
      japaneseName: '宝塚記念 (Takarazuka Kinen)',
      distanceMeters: 2200,
      surface: 'turf',
      racecourse: 'Hanshin (阪神競馬場 Inner)',
      direction: 'Clockwise',
      finalStraightLength: '356.5m (Steep finish hill)',
      keyAccelerationPoint: 'Third Corner descending into Final Turn (Last 733m remaining)',
    },
  },
  {
    canonical: 'Yasuda Kinen / Mile Championship',
    aliases: ['yasuda kinen', '安田記念', 'mile championship', 'マイルチャンピオンシップ', 'tokyo 1600m', 'kyoto 1600m'],
    type: 'track',
    gametoraUrl: 'https://gametora.com/umamusume/racetracks',
    metadata: {
      japaneseName: '安田記念 (Yasuda Kinen) / マイルCS',
      distanceMeters: 1600,
      surface: 'turf',
      racecourse: 'Tokyo / Kyoto',
      keyAccelerationPoint: 'Turn 3 exit into Final Straight (Last 533m remaining)',
    },
  },
  {
    canonical: 'Sprinters Stakes / Takamatsunomiya Kinen',
    aliases: ['sprinters stakes', 'スプリンターズS', 'takamatsunomiya kinen', '高松宮記念', 'nakayama 1200m', 'chukyo 1200m'],
    type: 'track',
    gametoraUrl: 'https://gametora.com/umamusume/racetracks',
    metadata: {
      japaneseName: 'スプリンターズS / 高松宮記念',
      distanceMeters: 1200,
      surface: 'turf',
      racecourse: 'Nakayama / Chukyo',
      keyAccelerationPoint: 'Phase 2 instant burst at 400m remaining',
    },
  },
  {
    canonical: "Prix de l'Arc de Triomphe",
    aliases: ['prix de l arc de triomphe', 'arc de triomphe', 'longchamp 2400m', '凱旋門賞', 'parislongchamp'],
    type: 'track',
    gametoraUrl: 'https://gametora.com/umamusume/racetracks',
    metadata: {
      japaneseName: '凱旋門賞 (Prix de l\'Arc de Triomphe)',
      distanceMeters: 2400,
      surface: 'turf',
      racecourse: 'ParisLongchamp (フランス・パリロンシャン)',
      direction: 'Clockwise',
      finalStraightLength: '533m (Open stretch / Fausse ligne droite)',
      keyAccelerationPoint: 'Open Stretch into Great Straight (Last 800m remaining)',
    },
  },
];

const SUPPORT_CARDS_TAXONOMY: EntityTaxonomyItem[] = [
  {
    canonical: 'SSR Kitasan Black (Speed)',
    aliases: ['ssr kitasan black', 'kitasan card', 'kitasan black ssr', 'speed kitasan'],
    type: 'support-card',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    metadata: {
      cardType: 'Speed',
      rarity: 'SSR',
      keySkills: ['Professor of Curren (弧線のプロフェッサー)', 'Corner Adept ◯', 'Concentration'],
      keyBonuses: 'Top Tier Specialty Rate (80) + High Friendship Bonus (25%) + Training Effectiveness (15%)',
    },
  },
  {
    canonical: 'SSR Super Creek (Stamina)',
    aliases: ['ssr super creek', 'super creek card', 'creek card', 'stamina creek'],
    type: 'support-card',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    metadata: {
      cardType: 'Stamina',
      rarity: 'SSR',
      keySkills: ['Circle of Maestro / Arc Maestro (円弧のマエストロ)', 'Corner Recovery ◯', 'Pace Chaser Hints'],
      keyBonuses: 'Essential Stamina Card with guaranteed Arc Maestro on chain completion',
    },
  },
  {
    canonical: 'SSR Fine Motion (Intelligence)',
    aliases: ['ssr fine motion', 'fine motion card', 'fine motion ssr', 'int fine motion'],
    type: 'support-card',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    metadata: {
      cardType: 'Intelligence',
      rarity: 'SSR',
      keySkills: ['Speed Star (スピードスター)', 'Corner Adept ◯', 'Tail Held High (尻尾上がり)'],
      keyBonuses: 'High Training Effectiveness (15%) + Consistent Wit Training Stat Up',
    },
  },
  {
    canonical: 'SSR Rice Shower (Power)',
    aliases: ['ssr rice shower', 'power rice shower', 'rice shower card'],
    type: 'support-card',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    metadata: {
      cardType: 'Power',
      rarity: 'SSR',
      keySkills: ['Circle of Maestro (円弧のマエストロ)', 'Climber (直滑降)'],
      keyBonuses: 'Provides Arc Maestro for Power training builds in Aoharu and TS Climax',
    },
  },
  {
    canonical: 'SSR Mejiro Ramonu (Intelligence)',
    aliases: ['ssr mejiro ramonu', 'ramonu card', 'int ramonu', 'mejiro ramonu ssr'],
    type: 'support-card',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    metadata: {
      cardType: 'Intelligence',
      rarity: 'SSR',
      keySkills: ['Superior Wisdom (優位形成)', 'Mile & Medium Acceleration Hints'],
      keyBonuses: 'Highest base training effect scaling per skill hint acquired',
    },
  },
  {
    canonical: 'SSR Duramente (Speed)',
    aliases: ['ssr duramente', 'duramente card', 'speed duramente'],
    type: 'support-card',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    metadata: {
      cardType: 'Speed',
      rarity: 'SSR',
      keySkills: ['Swift Acceleration (迅速果断 / 疾風怒濤)'],
      keyBonuses: 'Extreme speed raw ceiling multiplier for modern high stat cap scenarios',
    },
  },
  {
    canonical: 'SSR Tazuna Hayakawa (Friend)',
    aliases: ['ssr tazuna', 'tazuna hayakawa', 'tazuna card', 'friend tazuna'],
    type: 'support-card',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    metadata: {
      cardType: 'Friend',
      rarity: 'SSR',
      keySkills: ['Concentration (コンセントレーション)'],
      keyBonuses: 'Energy recovery, mood upkeep, fail rate reduction, guaranteed gate skill',
    },
  },
];

const SCENARIOS_TAXONOMY: EntityTaxonomyItem[] = [
  { canonical: 'URA Finals', aliases: ['ura finals', 'ura', 'uraファイナルズ'], type: 'scenario', gametoraUrl: 'https://gametora.com/umamusume', umamusuWikiUrl: 'https://umamusu.wiki/URA_Finals' },
  { canonical: 'Aoharu Hai', aliases: ['aoharu hai', 'aoharu', 'アオハル杯', 'aoharu explosion'], type: 'scenario', gametoraUrl: 'https://gametora.com/umamusume', umamusuWikiUrl: 'https://umamusu.wiki/Aoharu_Hai' },
  { canonical: 'Make a New Track / TS Climax', aliases: ['make a new track', 'ts climax', 'climax', 'クライマックス'], type: 'scenario', gametoraUrl: 'https://gametora.com/umamusume', umamusuWikiUrl: 'https://umamusu.wiki/Make_a_New_Track' },
  { canonical: 'Grand Live', aliases: ['grand live', 'グランドライブ'], type: 'scenario', gametoraUrl: 'https://gametora.com/umamusume', umamusuWikiUrl: 'https://umamusu.wiki/Grand_Live' },
  { canonical: 'Grand Masters', aliases: ['grand masters', 'グランドマスターズ'], type: 'scenario', gametoraUrl: 'https://gametora.com/umamusume', umamusuWikiUrl: 'https://umamusu.wiki/Grand_Masters' },
  { canonical: "Project L'Arc", aliases: ['project l arc', 'l arc', 'larc', 'プロジェクトラーク'], type: 'scenario', gametoraUrl: 'https://gametora.com/umamusume', umamusuWikiUrl: 'https://umamusu.wiki/Project_L\'Arc' },
  { canonical: 'U.A.F. Ready GO!', aliases: ['uaf', 'u.a.f.', 'uaf ready go'], type: 'scenario', gametoraUrl: 'https://gametora.com/umamusume', umamusuWikiUrl: 'https://umamusu.wiki/U.A.F._Ready_GO!' },
  { canonical: 'Great Food Festival / Mecha Uma Musume', aliases: ['food festival', 'mecha uma', 'メカウマ娘'], type: 'scenario', gametoraUrl: 'https://gametora.com/umamusume' },
];

const MEDIA_AND_LORE_TAXONOMY: EntityTaxonomyItem[] = [
  {
    canonical: 'Umamusume: Cinderella Gray',
    aliases: ['cinderella gray', 'cin gray', 'シングレ', 'シンデレラグレイ', 'oguri cap manga', 'kasamatsu manga'],
    type: 'media',
    umamusuWikiUrl: 'https://umamusu.wiki/Umamusume:_Cinderella_Gray',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Umamusume:_Cinderella_Gray',
    metadata: {
      japaneseName: 'ウマ娘 シンデレラグレイ',
      category: 'manga',
      protagonistOrLead: 'Oguri Cap (オグリキャップ)',
      summary: 'Weekly Young Jump manga chronicling Oguri Cap\'s humble beginnings at Kasamatsu National Association of Racing (NAR) and her journey to the central JRA turf.',
      releaseOrSetting: 'Weekly Young Jump (2020–present) • Kasamatsu / Central Tracen Academy',
    },
  },
  {
    canonical: 'Umamusume: Star Blossom',
    aliases: ['star blossom', 'スターブロッサム', 'sakura laurel manga'],
    type: 'media',
    umamusuWikiUrl: 'https://umamusu.wiki/Umamusume:_Star_Blossom',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Umamusume:_Star_Blossom',
    metadata: {
      japaneseName: 'ウマ娘 プリティーダービー スターブロッサム',
      category: 'manga',
      protagonistOrLead: 'Sakura Laurel (サクラローレル)',
      summary: 'Spinoff manga focusing on Sakura Laurel overcoming delicate legs and glass-like bones to claim the Tenno Sho and Arima Kinen alongside rival Mayano Top Gun and Marvelous Sunday.',
      releaseOrSetting: 'Shonen Jump+ / Tonari no Young Jump (2023–present)',
    },
  },
  {
    canonical: 'Umamusume: Road to the Top',
    aliases: ['road to the top', 'rttt', 'ロード・トゥ・ザ・トップ', 'narita top road anime'],
    type: 'media',
    umamusuWikiUrl: 'https://umamusu.wiki/Road_to_the_Top',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Road_to_the_Top',
    metadata: {
      japaneseName: 'ウマ娘 プリティーダービー ROAD TO THE TOP',
      category: 'anime',
      protagonistOrLead: 'Narita Top Road, Admire Vega, TM Opera O',
      summary: '4-episode web anime following the 1999 Classic Generation Triple Crown battles across Satsuki Sho, Tokyo Yushun, and Kikuka Sho.',
      releaseOrSetting: 'YouTube ONA (April 2023, CygamesPictures)',
    },
  },
  {
    canonical: 'Umamusume: Beginning of a New Era',
    aliases: ['beginning of a new era', 'new era movie', '新時代の扉', 'jungle pocket movie'],
    type: 'media',
    umamusuWikiUrl: 'https://umamusu.wiki/Beginning_of_a_New_Era',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Beginning_of_a_New_Era',
    metadata: {
      japaneseName: 'ウマ娘 プリティーダービー 新時代の扉',
      category: 'movie',
      protagonistOrLead: 'Jungle Pocket, Agnes Tachyon, Manhattan Cafe, Dantsu Flame',
      summary: 'Theatrical feature film focusing on Jungle Pocket striving to prove herself against Agnes Tachyon in the 2001 classic season and conquer the Japan Cup.',
      releaseOrSetting: 'Theatrical Release (May 2024, CygamesPictures)',
    },
  },
  {
    canonical: 'Umamusume Season 1 (Anime)',
    aliases: ['anime season 1', 'season 1', 's1', 'special week anime'],
    type: 'media',
    umamusuWikiUrl: 'https://umamusu.wiki/Umamusume_Pretty_Derby_(Anime)',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Umamusume_Pretty_Derby_(Anime)',
    metadata: {
      japaneseName: 'ウマ娘 プリティーダービー (Season 1)',
      category: 'anime',
      protagonistOrLead: 'Special Week, Silence Suzuka (Team Spica)',
      summary: 'Special Week arrives from rural Hokkaido at Tracen Academy to fulfill her promise to her mothers of becoming the #1 horse girl in Japan.',
      releaseOrSetting: 'P.A. Works (Spring 2018, 13 episodes)',
    },
  },
  {
    canonical: 'Umamusume Season 2 (Anime)',
    aliases: ['anime season 2', 'season 2', 's2', 'tokai teio anime'],
    type: 'media',
    umamusuWikiUrl: 'https://umamusu.wiki/Umamusume_Pretty_Derby_Season_2',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Umamusume_Pretty_Derby_Season_2',
    metadata: {
      japaneseName: 'ウマ娘 プリティーダービー Season 2',
      category: 'anime',
      protagonistOrLead: 'Tokai Teio, Mejiro McQueen (Team Spica & Team Canopus)',
      summary: 'Chronicles Tokai Teio overcoming repeated heartbreaking bone fractures alongside Mejiro McQueen\'s battle with Stayers injuries and Twin Turbo\'s relentless spirit.',
      releaseOrSetting: 'Studio KAI (Winter 2021, 13 episodes)',
    },
  },
  {
    canonical: 'Umamusume Season 3 (Anime)',
    aliases: ['anime season 3', 'season 3', 's3', 'kitasan black anime'],
    type: 'media',
    umamusuWikiUrl: 'https://umamusu.wiki/Umamusume_Pretty_Derby_Season_3',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Umamusume_Pretty_Derby_Season_3',
    metadata: {
      japaneseName: 'ウマ娘 プリティーダービー Season 3',
      category: 'anime',
      protagonistOrLead: 'Kitasan Black, Satono Diamond, Duramente',
      summary: 'Kitasan Black and Satono Diamond pursue their dreams as full-fledged racers facing giants like Duramente and Cheval Grand.',
      releaseOrSetting: 'Studio KAI (Fall 2023, 13 episodes)',
    },
  },
  {
    canonical: 'Umapyoi Densetsu',
    aliases: ['umapyoi densetsu', 'umapyoi', 'うまぴょい伝説', 'umamusume theme song'],
    type: 'lore-entity',
    umamusuWikiUrl: 'https://umamusu.wiki/Umapyoi_Densetsu',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Umapyoi_Densetsu',
    metadata: {
      japaneseName: 'うまぴょい伝説',
      category: 'music',
      summary: 'The iconic franchise anthem composed by Akihiro Honda (Cygames). Performed as the celebratory Winning Live concert by the victorious Uma Musume after major races.',
      releaseOrSetting: 'Franchise Main Theme Song',
    },
  },
  {
    canonical: 'Tracen Academy',
    aliases: ['tracen academy', 'tracen', 'トレセン学園', 'nihon umamusume training center academy'],
    type: 'lore-entity',
    umamusuWikiUrl: 'https://umamusu.wiki/Tracen_Academy',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Tracen_Academy',
    metadata: {
      japaneseName: '日本ウマ娘トレーニングセンター学園 (トレセン学園)',
      category: 'organization',
      summary: 'The premier training institution for horse girls in Tokyo, equipped with racing facilities, dormitories, training staff, and student council oversight.',
      releaseOrSetting: 'Core Universe Academy Setting',
    },
  },
  {
    canonical: 'Team Spica',
    aliases: ['team spica', 'spica', 'チームスピカ'],
    type: 'lore-entity',
    umamusuWikiUrl: 'https://umamusu.wiki/Team_Spica',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Team_Spica',
    metadata: {
      japaneseName: 'チーム＜スピカ＞',
      category: 'organization',
      summary: 'Central protagonist racing team led by Trainer and Sub-trainer Tazuna. Members: Special Week, Silence Suzuka, Tokai Teio, Mejiro McQueen, Vodka, Daiwa Scarlet, Gold Ship, and later Kitasan Black.',
      releaseOrSetting: 'Anime Main Team',
    },
  },
  {
    canonical: 'Team Canopus',
    aliases: ['team canopus', 'canopus', 'チームカノープス'],
    type: 'lore-entity',
    umamusuWikiUrl: 'https://umamusu.wiki/Team_Canopus',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Team_Canopus',
    metadata: {
      japaneseName: 'チーム＜カノープス＞',
      category: 'organization',
      summary: 'Beloved underdog racing team led by Trainer Minami. Members include Nice Nature, Twin Turbo, Ikuno Dictus, Machikane Tannhauser, and later Sounds of Earth.',
      releaseOrSetting: 'Anime Season 2 & 3 Fan Favorite',
    },
  },
  {
    canonical: 'Three Goddesses',
    aliases: ['three goddesses', 'gods of horse racing', 'godolphin', 'darley', 'byerley', '三女神'],
    type: 'lore-entity',
    umamusuWikiUrl: 'https://umamusu.wiki/Three_Goddesses',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Three_Goddesses',
    metadata: {
      japaneseName: '三女神 (Three Goddesses)',
      category: 'deity',
      summary: 'Divine entities representing the three foundation sires of modern thoroughbreds: Darley Arabian, Godolphin Arabian, and Byerley Turk. Central deities in Grand Masters and Tracen history.',
      releaseOrSetting: 'Grand Masters Scenario & Core Franchise Mythology',
    },
  },
];

const ALL_TAXONOMY: EntityTaxonomyItem[] = [
  ...CHARACTERS_TAXONOMY,
  ...SKILLS_TAXONOMY,
  ...TRACKS_TAXONOMY,
  ...SUPPORT_CARDS_TAXONOMY,
  ...SCENARIOS_TAXONOMY,
  ...MEDIA_AND_LORE_TAXONOMY,
];

// ─────────────────────────────────────────────────────────────
// MATCHING & CLASSIFICATION LOGIC
// ─────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"\[\]]/g, ' ')
    .replace(/\s+/g, ' ');
}

function hasWordMatch(query: string, target: string): boolean {
  const normQuery = normalizeText(query);
  const normTarget = normalizeText(target);
  if (!normQuery || !normTarget) return false;

  // CJK character sequence match (Japanese / Chinese)
  if (/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(target)) {
    const compactQuery = query.replace(/\s+/g, '').toLowerCase();
    const compactTarget = target.replace(/\s+/g, '').toLowerCase();
    return compactQuery.includes(compactTarget);
  }

  // Word boundary regex match for English / Romanized terms
  const escaped = normTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordRegex = new RegExp(`(^|\\b|\\s)${escaped}(\\b|\\s|$)`, 'i');
  return wordRegex.test(normQuery);
}

/**
 * Classifies an incoming query against the Umamusume entity taxonomy.
 */
export function classifyUmamusumeEntity(query: string): EntityClassificationResult {
  const normalized = normalizeText(query);

  const matchedEntities: Array<{
    item: EntityTaxonomyItem;
    alias: string;
    score: number;
  }> = [];

  for (const item of ALL_TAXONOMY) {
    for (const alias of item.aliases) {
      const normAlias = normalizeText(alias);
      if (!normAlias) continue;

      if (normalized === normAlias) {
        matchedEntities.push({ item, alias, score: 100 });
        break;
      }

      if (hasWordMatch(normalized, normAlias)) {
        let baseScore = normAlias.length * 2;
        // Prioritize specific category intent
        if (item.type === 'character' && /\b(who is|how to train|build|stat|growth|deck for|guide for|seiyuu|voice actor|cv|va|birthday|irl|horse)\b/i.test(query)) {
          baseScore += 30;
        } else if (item.type === 'skill' && /\b(what is|when|trigger|activate|who has|how to get|cost|skill)\b/i.test(query)) {
          baseScore += 30;
        } else if (item.type === 'track' && /\b(track|racecourse|turn|elevation|accel zone|distance)\b/i.test(query)) {
          baseScore += 30;
        } else if ((item.type === 'media' || item.type === 'lore-entity') && /\b(anime|manga|movie|lore|story|plot|synopsis|team|goddess|song|spinoff)\b/i.test(query)) {
          baseScore += 35;
        }
        matchedEntities.push({ item, alias, score: baseScore });
        break;
      }
    }
  }

  matchedEntities.sort((a, b) => b.score - a.score);
  const bestMatch = matchedEntities[0]?.item ?? null;
  const matchedTerm = matchedEntities[0]?.alias ?? '';
  const highestScore = matchedEntities[0]?.score ?? 0;

  // Keyword heuristic checks if no direct alias matched
  if (!bestMatch) {
    if (/\b(skill|skills|inherit|acceleration|velocity|recovery|debuff|stamina heal|spurt)\b/i.test(query)) {
      return {
        isTargetingKnownEntity: true,
        primaryType: 'skill',
        canonicalEntity: null,
        matchedTerms: ['skill keyword'],
        confidence: 'medium',
        gametoraUrl: 'https://gametora.com/umamusume/skills',
        recommendedSources: ['https://uma.guide/skills', 'https://gametora.com/umamusume/skills', 'https://umamusu.wiki'],
        formatGuidance: formatSkillAntiDumpGuidance(),
        cleanSearchQuery: query,
      };
    }
    if (/\b(character|umamusume|horse girl|stats|aptitude|growth rate|who is|train|seiyuu|voice actor)\b/i.test(query)) {
      return {
        isTargetingKnownEntity: true,
        primaryType: 'character',
        canonicalEntity: null,
        matchedTerms: ['character keyword'],
        confidence: 'medium',
        gametoraUrl: 'https://gametora.com/umamusume/characters',
        recommendedSources: ['https://uma.guide/characters', 'https://gametora.com/umamusume/characters', 'https://umamusu.wiki', 'https://umamusume.fandom.com/wiki/Umamusume_Wiki'],
        formatGuidance: formatCharacterAntiDumpGuidance(),
        cleanSearchQuery: query,
      };
    }
    if (/\b(anime|manga|movie|cinderella gray|star blossom|road to the top|beginning of a new era|lore|team spica|team canopus|three goddesses)\b/i.test(query)) {
      return {
        isTargetingKnownEntity: true,
        primaryType: 'media',
        canonicalEntity: null,
        matchedTerms: ['media/lore keyword'],
        confidence: 'medium',
        recommendedSources: ['https://umamusu.wiki', 'https://umamusume.fandom.com/wiki/Umamusume_Wiki'],
        formatGuidance: formatMediaLoreAntiDumpGuidance(),
        cleanSearchQuery: query,
      };
    }
    if (/\b(track|racecourse|turn|elevation|distance|m|meters|turf|dirt|champions meeting|cm|loh)\b/i.test(query)) {
      return {
        isTargetingKnownEntity: true,
        primaryType: 'track',
        canonicalEntity: null,
        matchedTerms: ['track/race keyword'],
        confidence: 'medium',
        gametoraUrl: 'https://gametora.com/umamusume/racetracks',
        recommendedSources: ['https://uma.guide/tracks', 'https://gametora.com/umamusume/racetracks', 'https://umamusu.wiki'],
        formatGuidance: formatTrackAntiDumpGuidance(),
        cleanSearchQuery: query,
      };
    }

    return {
      isTargetingKnownEntity: false,
      primaryType: 'unknown',
      canonicalEntity: null,
      matchedTerms: [],
      confidence: 'low',
      recommendedSources: ['https://uma.guide', 'https://gametora.com/umamusume', 'https://umamusu.wiki'],
      formatGuidance: 'Keep answer concise and structured within Umamusume domain boundaries.',
      cleanSearchQuery: query,
    };
  }

  // Known entity match resolved
  const primaryType = bestMatch.type;
  const canonical = bestMatch.canonical;

  let skillDetails: SkillDetails | undefined;
  let characterDetails: CharacterDetails | undefined;
  let trackDetails: TrackDetails | undefined;
  let supportCardDetails: SupportCardDetails | undefined;
  let mediaLoreDetails: MediaLoreDetails | undefined;
  let recommendedSources: string[] = ['https://uma.guide', 'https://gametora.com/umamusume', 'https://umamusu.wiki'];
  let formatGuidance = '';

  if (primaryType === 'skill') {
    skillDetails = {
      canonicalName: canonical,
      japaneseName: bestMatch.metadata?.japaneseName,
      classType: bestMatch.metadata?.classType ?? 'general',
      triggerPhase: bestMatch.metadata?.triggerPhase,
      triggerCondition: bestMatch.metadata?.triggerCondition,
      recommendedStrategy: bestMatch.metadata?.recommendedStrategy,
      distanceAptitude: bestMatch.metadata?.distanceAptitude,
      nativeBearers: bestMatch.metadata?.nativeBearers,
      goldVersion: bestMatch.metadata?.goldVersion,
      whiteVersion: bestMatch.metadata?.whiteVersion,
      sourceCards: bestMatch.metadata?.sourceCards,
      gametoraUrl: bestMatch.gametoraUrl ?? 'https://gametora.com/umamusume/skills',
      umamusuWikiUrl: bestMatch.umamusuWikiUrl,
      fandomWikiUrl: bestMatch.fandomWikiUrl,
    };
    recommendedSources = [
      'https://uma.guide/skills',
      'https://gametora.com/umamusume/skills',
      'https://umamusu.wiki',
    ];
    formatGuidance = formatSkillAntiDumpGuidance(skillDetails);
  } else if (primaryType === 'character') {
    characterDetails = {
      canonicalName: canonical,
      japaneseName: bestMatch.metadata?.japaneseName,
      voiceActor: bestMatch.metadata?.voiceActor,
      birthday: bestMatch.metadata?.birthday,
      epithet: bestMatch.metadata?.epithet,
      realHorseHistory: bestMatch.metadata?.realHorseHistory,
      mediaAppearances: bestMatch.metadata?.mediaAppearances,
      role: bestMatch.metadata?.role ?? 'Uma Musume Runner',
      growthRates: bestMatch.metadata?.growthRates,
      surfaceAptitudes: bestMatch.metadata?.surfaceAptitudes,
      distanceAptitudes: bestMatch.metadata?.distanceAptitudes,
      strategyAptitudes: bestMatch.metadata?.strategyAptitudes,
      uniqueSkill: bestMatch.metadata?.uniqueSkill,
      gametoraUrl: bestMatch.gametoraUrl ?? 'https://gametora.com/umamusume/characters',
      umamusuWikiUrl: bestMatch.umamusuWikiUrl,
      fandomWikiUrl: bestMatch.fandomWikiUrl,
    };
    recommendedSources = [
      'https://uma.guide/characters',
      'https://gametora.com/umamusume/characters',
      'https://umamusu.wiki',
      'https://umamusume.fandom.com/wiki/Umamusume_Wiki',
    ];
    formatGuidance = formatCharacterAntiDumpGuidance(characterDetails);
  } else if (primaryType === 'media' || primaryType === 'lore-entity') {
    mediaLoreDetails = {
      canonicalName: canonical,
      japaneseName: bestMatch.metadata?.japaneseName,
      category: bestMatch.metadata?.category ?? 'lore',
      protagonistOrLead: bestMatch.metadata?.protagonistOrLead,
      summary: bestMatch.metadata?.summary,
      releaseOrSetting: bestMatch.metadata?.releaseOrSetting,
      umamusuWikiUrl: bestMatch.umamusuWikiUrl,
      fandomWikiUrl: bestMatch.fandomWikiUrl,
    };
    recommendedSources = [
      'https://umamusu.wiki',
      'https://umamusume.fandom.com/wiki/Umamusume_Wiki',
      'https://gametora.com/umamusume',
    ];
    formatGuidance = formatMediaLoreAntiDumpGuidance(mediaLoreDetails);
  } else if (primaryType === 'track') {
    trackDetails = {
      canonicalName: canonical,
      japaneseName: bestMatch.metadata?.japaneseName,
      distanceMeters: bestMatch.metadata?.distanceMeters,
      surface: bestMatch.metadata?.surface,
      racecourse: bestMatch.metadata?.racecourse,
      direction: bestMatch.metadata?.direction,
      finalStraightLength: bestMatch.metadata?.finalStraightLength,
      keyAccelerationPoint: bestMatch.metadata?.keyAccelerationPoint,
      gametoraUrl: bestMatch.gametoraUrl ?? 'https://gametora.com/umamusume/racetracks',
      umamusuWikiUrl: bestMatch.umamusuWikiUrl,
      fandomWikiUrl: bestMatch.fandomWikiUrl,
    };
    recommendedSources = [
      'https://uma.guide/tracks',
      'https://gametora.com/umamusume/racetracks',
      'https://umamusu.wiki',
    ];
    formatGuidance = formatTrackAntiDumpGuidance(trackDetails);
  } else if (primaryType === 'support-card') {
    supportCardDetails = {
      canonicalName: canonical,
      japaneseName: bestMatch.metadata?.japaneseName,
      cardType: bestMatch.metadata?.cardType ?? 'Speed',
      rarity: bestMatch.metadata?.rarity ?? 'SSR',
      keySkills: bestMatch.metadata?.keySkills,
      keyBonuses: bestMatch.metadata?.keyBonuses,
      gametoraUrl: bestMatch.gametoraUrl ?? 'https://gametora.com/umamusume/supports',
      umamusuWikiUrl: bestMatch.umamusuWikiUrl,
      fandomWikiUrl: bestMatch.fandomWikiUrl,
    };
    recommendedSources = [
      'https://uma.guide/support-cards',
      'https://gametora.com/umamusume/supports',
      'https://umamusu.wiki',
    ];
    formatGuidance = formatSupportCardAntiDumpGuidance(supportCardDetails);
  } else if (primaryType === 'scenario') {
    recommendedSources = [
      'https://uma.guide/guides',
      'https://gametora.com/umamusume/events',
      'https://umamusu.wiki',
    ];
    formatGuidance = 'Format: [Scenario Name] • Core Mechanism • Stat Cap Adjustments • Recommended Cards/Skills.';
  }

  return {
    isTargetingKnownEntity: true,
    primaryType,
    canonicalEntity: canonical,
    matchedTerms: [matchedTerm],
    confidence: highestScore >= 10 ? 'high' : 'medium',
    skillDetails,
    characterDetails,
    trackDetails,
    supportCardDetails,
    mediaLoreDetails,
    gametoraUrl: bestMatch.gametoraUrl,
    umamusuWikiUrl: bestMatch.umamusuWikiUrl,
    fandomWikiUrl: bestMatch.fandomWikiUrl,
    recommendedSources,
    formatGuidance,
    cleanSearchQuery: `${canonical} umamusume`,
  };
}

/**
 * Validates a user query before executing search tools to ensure accuracy and prevent info dumping.
 */
export function validateBeforeSearch(
  query: string,
  options: EntityValidationOptions = {}
): EntityValidationResult {
  const classification = classifyUmamusumeEntity(query);
  const strict = options.strictUmamusumeOnly ?? true;

  if (strict && !classification.isTargetingKnownEntity && classification.confidence === 'low') {
    logger.warn(`Search query failed entity validation: "${query}" (Not an Umamusume entity)`);
    return {
      valid: false,
      reason: 'Query does not target a recognized Umamusume character, skill, track, or gameplay mechanic.',
      classification,
      formattedGuidelines: classification.formatGuidance,
      redirectSuggestion:
        'Please rephrase your question around Umamusume topics (e.g., character builds like Special Week, skills like Straightaway Spurt, or race tracks like Arima Kinen).',
    };
  }

  if (options.allowedTypes && !options.allowedTypes.includes(classification.primaryType)) {
    return {
      valid: false,
      reason: `Query entity type "${classification.primaryType}" is not permitted for this search action.`,
      classification,
      formattedGuidelines: classification.formatGuidance,
    };
  }

  logger.info(
    `Search validated for entity [${classification.primaryType}]: "${classification.canonicalEntity ?? query}" (${classification.confidence} confidence)`
  );

  return {
    valid: true,
    classification,
    formattedGuidelines: classification.formatGuidance,
  };
}

/**
 * Creates an entity classification middleware wrapper for search tools or agent pipelines.
 */
export function createEntityClassificationMiddleware(options: EntityValidationOptions = {}) {
  return async function executeWithClassification<T>(
    query: string,
    next: (validatedQuery: string, classification: EntityClassificationResult) => Promise<T>
  ): Promise<T> {
    const validation = validateBeforeSearch(query, options);

    if (!validation.valid) {
      throw new Error(
        validation.reason ??
          'Entity classification middleware: query rejected as out-of-taxonomy or non-Umamusume.'
      );
    }

    const searchQuery = validation.classification.canonicalEntity
      ? `${validation.classification.canonicalEntity} umamusume`
      : query;

    return next(searchQuery, validation.classification);
  };
}

// ─────────────────────────────────────────────────────────────
// ANTI-DUMP FORMATTING TEMPLATES (Strict 3-4 Section Output)
// ─────────────────────────────────────────────────────────────

function formatCharacterAntiDumpGuidance(details?: CharacterDetails): string {
  const name = details?.canonicalName ?? 'Character Name';
  const jp = details?.japaneseName ? ` (${details.japaneseName})` : '';
  const va = details?.voiceActor ? ` • CV: ${details.voiceActor}` : '';
  const bday = details?.birthday ? ` • Birthday: ${details.birthday}` : '';
  const refGametora = details?.gametoraUrl ? `\n- GameTora: ${details.gametoraUrl}` : '';
  const refUmamusu = details?.umamusuWikiUrl ? `\n- Umamusu Wiki: ${details.umamusuWikiUrl}` : '';
  const refFandom = details?.fandomWikiUrl ? `\n- Fandom Wiki: ${details.fandomWikiUrl}` : '';
  const irl = details?.realHorseHistory ? `\n- **🏇 Real Racehorse Lore**: ${details.realHorseHistory}` : '';
  return (
    `**[CHARACTER FORMAT GUIDANCE — NO INFO DUMPS]**\n` +
    `Structure the output strictly using these 4 scannable sections:\n` +
    `1. **[Title Header]**: **${name}${jp}**${va}${bday} (${details?.epithet ?? details?.role ?? 'Trainee'})\n` +
    `2. **📋 Core Aptitudes & Growths**: Surface (Turf/Dirt), Distance, Strategy | Stat Bonuses (e.g. Stamina +20%)\n` +
    `3. **✨ Unique Skill & Racing Role**: Unique skill name, trigger criteria, and optimal race distance${irl}\n` +
    `4. **📚 References & Lore Sources**: Authoritative links for gameplay and anime/manga lore.${refGametora}${refUmamusu}${refFandom}`
  );
}

function formatMediaLoreAntiDumpGuidance(details?: MediaLoreDetails): string {
  const name = details?.canonicalName ?? 'Media / Lore Entry';
  const jp = details?.japaneseName ? ` (${details.japaneseName})` : '';
  const ref1 = details?.umamusuWikiUrl ? `\n- Umamusu Wiki: ${details.umamusuWikiUrl}` : '';
  const ref2 = details?.fandomWikiUrl ? `\n- Fandom Wiki: ${details.fandomWikiUrl}` : '';
  const lead = details?.protagonistOrLead ? `\n- **Lead / Focus**: ${details.protagonistOrLead}` : '';
  return (
    `**[LORE & MEDIA FORMAT GUIDANCE — NO INFO DUMPS]**\n` +
    `Structure the output strictly using these 3 scannable sections:\n` +
    `1. **[Title & Category]**: **${name}${jp}** (${details?.category ?? 'Lore/Media'})${lead}\n` +
    `2. **📖 Synopsis & Central Focus**: ${details?.summary ?? 'Key storyline, focus characters, and academy setting'}\n` +
    `3. **🌟 Setting & Lore Sources**: ${details?.releaseOrSetting ?? 'Franchise media'}.${ref1}${ref2}`
  );
}

function formatSkillAntiDumpGuidance(details?: SkillDetails): string {
  const name = details?.canonicalName ?? 'Skill Name';
  const jp = details?.japaneseName ? ` (${details.japaneseName})` : '';
  const refGametora = details?.gametoraUrl ? `\n- GameTora: ${details.gametoraUrl}` : '';
  const refUmamusu = details?.umamusuWikiUrl ? `\n- Umamusu Wiki: ${details.umamusuWikiUrl}` : '';
  return (
    `**[SKILL FORMAT GUIDANCE — NO INFO DUMPS]**\n` +
    `Structure the output strictly using these 4 scannable sections:\n` +
    `1. **[Title & Class]**: **${name}${jp}** (Normal / Gold / Unique • Class: Acceleration / Velocity / Recovery / Passive / Debuff)\n` +
    `2. **⏱️ Activation Trigger & Timing**: Exact activation phase, condition, strategy requirement (e.g. End Closer), duration\n` +
    `3. **🏇 Native Uma Musume**: Characters possessing or awakening this skill\n` +
    `4. **📦 Acquisition Sources**: SSR/SR support card sources, hints, or inheritance factors.${refGametora}${refUmamusu}`
  );
}

function formatTrackAntiDumpGuidance(details?: TrackDetails): string {
  const name = details?.canonicalName ?? 'Track / Race Name';
  const jp = details?.japaneseName ? ` (${details.japaneseName})` : '';
  const ref = details?.gametoraUrl ? `\n- Reference: ${details.gametoraUrl}` : '';
  return (
    `**[TRACK FORMAT GUIDANCE — NO INFO DUMPS]**\n` +
    `Structure the output strictly using these 3 scannable sections:\n` +
    `1. **[Track Specification]**: **${name}${jp}** (Distance, Surface, Racecourse, Direction)\n` +
    `2. **🏁 Elevation & Turn Profile**: Incline/decline locations, corner structure, final straight length\n` +
    `3. **⚡ Key Acceleration & Skill Timers**: Exact point where Last Spurt / Acceleration triggers.${ref}`
  );
}

function formatSupportCardAntiDumpGuidance(details?: SupportCardDetails): string {
  const name = details?.canonicalName ?? 'Card Name';
  const ref = details?.gametoraUrl ? `\n- Reference: ${details.gametoraUrl}` : '';
  return (
    `**[SUPPORT CARD FORMAT GUIDANCE — NO INFO DUMPS]**\n` +
    `Structure the output strictly using these 3 scannable sections:\n` +
    `1. **[Card Title & Type]**: **${name}** (${details?.rarity ?? 'SSR'} • ${details?.cardType ?? 'Speed'})\n` +
    `2. **🎯 Key Training Effects & Bonuses**: ${details?.keyBonuses ?? 'Friendship bonus, specialty priority, training effectiveness'}\n` +
    `3. **📜 Essential Skill Hints & Events**: Key gold/white skills gained from events.${ref}`
  );
}

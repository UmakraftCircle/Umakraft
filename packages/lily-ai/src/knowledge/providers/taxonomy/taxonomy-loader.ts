export type TaxonomyCategory =
  | 'Character'
  | 'Support Card'
  | 'Skill'
  | 'Running Style'
  | 'Distance'
  | 'Surface'
  | 'Track'
  | 'Race'
  | 'Factor'
  | 'Event'
  | 'Title'
  | 'Condition'
  | 'Item';

export interface TaxonomyNode {
  id: string;
  category: TaxonomyCategory | string;
  name: string; // Official Name
  aliases: string[];
  metadata?: Record<string, unknown>;
}

export class TaxonomyRegistry {
  private nodes = new Map<string, TaxonomyNode>();
  private allNodes: TaxonomyNode[] = [];

  public register(node: TaxonomyNode): void {
    this.allNodes.push(node);
    this.nodes.set(node.id, node);
  }

  public get(id: string): TaxonomyNode | undefined {
    return this.nodes.get(id);
  }

  public getAll(): TaxonomyNode[] {
    return [...this.allNodes];
  }

  public getByCategory(category: string): TaxonomyNode[] {
    const norm = category.toLowerCase().replace(/[\s_-]+/g, '');
    return this.getAll().filter(n => n.category.toLowerCase().replace(/[\s_-]+/g, '') === norm);
  }

  public count(): number {
    return this.allNodes.length;
  }

  public clear(): void {
    this.nodes.clear();
    this.allNodes = [];
  }
}

export const DEFAULT_TAXONOMY_NODES: TaxonomyNode[] = [
  // Running Styles
  {
    id: 'running_style.front_runner',
    name: 'Front Runner',
    category: 'Running Style',
    aliases: ['Nige', 'Runner', 'front runner', 'nige', 'runner']
  },
  {
    id: 'running_style.pace_chaser',
    name: 'Pace Chaser',
    category: 'Running Style',
    aliases: ['Senko', 'Senkou', 'Leader', 'pace chaser', 'senko', 'senkou', 'leader']
  },
  {
    id: 'running_style.late_surger',
    name: 'Late Surger',
    category: 'Running Style',
    aliases: ['Sashi', 'Betweener', 'Chaser', 'late surger', 'sashi', 'betweener', 'chaser']
  },
  {
    id: 'running_style.end_closer',
    name: 'End Closer',
    category: 'Running Style',
    aliases: ['Oikomi', 'Closer', 'end closer', 'oikomi', 'closer']
  },

  // Distance
  {
    id: 'distance.sprint',
    name: 'Sprint',
    category: 'Distance',
    aliases: ['Short', 'Sprint Distance', 'short', 'sprint']
  },
  {
    id: 'distance.mile',
    name: 'Mile',
    category: 'Distance',
    aliases: ['Mile Distance', 'mile']
  },
  {
    id: 'distance.medium',
    name: 'Medium',
    category: 'Distance',
    aliases: ['Middle', 'Medium Distance', 'middle', 'medium']
  },
  {
    id: 'distance.long',
    name: 'Long',
    category: 'Distance',
    aliases: ['Long Distance', 'Stayer', 'long']
  },

  // Surface
  {
    id: 'surface.turf',
    name: 'Turf',
    category: 'Surface',
    aliases: ['Grass', 'turf', 'grass']
  },
  {
    id: 'surface.dirt',
    name: 'Dirt',
    category: 'Surface',
    aliases: ['Sand', 'dirt', 'sand']
  },

  // Track
  {
    id: 'track.nakayama',
    name: 'Nakayama',
    category: 'Track',
    aliases: ['Nakayama Racecourse', 'nakayama']
  },
  {
    id: 'track.tokyo',
    name: 'Tokyo',
    category: 'Track',
    aliases: ['Tokyo Racecourse', 'Fuchu', 'tokyo']
  },
  {
    id: 'track.hanshin',
    name: 'Hanshin',
    category: 'Track',
    aliases: ['Hanshin Racecourse', 'hanshin']
  },
  {
    id: 'track.kyoto',
    name: 'Kyoto',
    category: 'Track',
    aliases: ['Kyoto Racecourse', 'kyoto']
  },
  {
    id: 'track.chukyo',
    name: 'Chukyo',
    category: 'Track',
    aliases: ['Chukyo Racecourse', 'chukyo']
  },
  {
    id: 'track.ohi',
    name: 'Ohi',
    category: 'Track',
    aliases: ['Oi', 'Ohi Racecourse', 'Oi Racecourse', 'TCK', 'ohi', 'oi']
  },
  {
    id: 'track.kawasaki',
    name: 'Kawasaki',
    category: 'Track',
    aliases: ['Kawasaki Racecourse', 'kawasaki']
  },
  {
    id: 'track.funabashi',
    name: 'Funabashi',
    category: 'Track',
    aliases: ['Funabashi Racecourse', 'funabashi']
  },
  {
    id: 'track.morioka',
    name: 'Morioka',
    category: 'Track',
    aliases: ['Morioka Racecourse', 'morioka']
  },

  // Character
  {
    id: 'character.symboli_rudolf',
    name: 'Symboli Rudolf',
    category: 'Character',
    aliases: ['Rudolf', 'Emperor', 'Kaicho', 'symboli rudolf', 'rudolf']
  },
  {
    id: 'character.oguri_cap',
    name: 'Oguri Cap',
    category: 'Character',
    aliases: ['Oguri', 'Beast of Kasamatsu', 'oguri cap', 'oguri']
  },
  {
    id: 'character.tokai_teio',
    name: 'Tokai Teio',
    category: 'Character',
    aliases: ['Teio', 'Miracle Teio', 'tokai teio', 'teio']
  },
  {
    id: 'character.mejiro_mcqueen',
    name: 'Mejiro McQueen',
    category: 'Character',
    aliases: ['McQueen', 'mejiro mcqueen', 'mcqueen']
  },
  {
    id: 'character.special_week',
    name: 'Special Week',
    category: 'Character',
    aliases: ['Spe', 'Spe-chan', 'special week', 'spe']
  },
  {
    id: 'character.silence_suzuka',
    name: 'Silence Suzuka',
    category: 'Character',
    aliases: ['Suzuka', 'silence suzuka', 'suzuka']
  },
  {
    id: 'character.gold_ship',
    name: 'Gold Ship',
    category: 'Character',
    aliases: ['Golshi', 'Goldship', 'gold ship', 'golshi']
  },
  {
    id: 'character.vodka',
    name: 'Vodka',
    category: 'Character',
    aliases: ['Wodka', 'vodka']
  },
  {
    id: 'character.daiwa_scarlet',
    name: 'Daiwa Scarlet',
    category: 'Character',
    aliases: ['Dasca', 'Scarlet', 'daiwa scarlet', 'dasca']
  },

  // Support Card
  {
    id: 'support_card.kitasan_black',
    name: 'Kitasan Black [SSR]',
    category: 'Support Card',
    aliases: ['Kitasan Black', 'Kita Black', 'Kitasan SSR', 'Speed Kitasan', 'kitasan black']
  },
  {
    id: 'support_card.super_creek',
    name: 'Super Creek [SSR]',
    category: 'Support Card',
    aliases: ['Super Creek', 'Creek SSR', 'Stamina Creek', 'super creek']
  },
  {
    id: 'support_card.fine_motion',
    name: 'Fine Motion [SSR]',
    category: 'Support Card',
    aliases: ['Fine Motion', 'Fine SSR', 'Wisdom Fine', 'fine motion']
  },

  // Skill
  {
    id: 'skill.concentration',
    name: 'Concentration',
    category: 'Skill',
    aliases: ['Focus', 'Kakushin', 'concentration', 'focus']
  },
  {
    id: 'skill.professor_of_curvature',
    name: 'Professor of Curvature',
    category: 'Skill',
    aliases: ['Arc Professor', 'Professor', 'Kyokusen Professor', 'professor of curvature', 'professor']
  },
  {
    id: 'skill.corner_adept',
    name: 'Corner Adept ○',
    category: 'Skill',
    aliases: ['Corner Adept', 'Corner Skill', 'corner adept']
  },
  {
    id: 'skill.victory_shot',
    name: 'Victory Shot!',
    category: 'Skill',
    aliases: ['Victory Shot', 'Taiki Unique', 'victory shot']
  },
  {
    id: 'skill.swallowtail',
    name: 'Swallowtail',
    category: 'Skill',
    aliases: ['Swallow Tail', 'swallowtail', 'swallow tail']
  },

  // Race
  {
    id: 'race.arima_kinen',
    name: 'Arima Kinen',
    category: 'Race',
    aliases: ['Arima', 'Grand Prix', 'arima kinen', 'arima']
  },
  {
    id: 'race.japan_cup',
    name: 'Japan Cup',
    category: 'Race',
    aliases: ['JC', 'japan cup', 'jc']
  },
  {
    id: 'race.tokyo_yushun',
    name: 'Tokyo Yushun (Japanese Derby)',
    category: 'Race',
    aliases: ['Tokyo Yushun', 'Japanese Derby', 'Derby', 'tokyo yushun', 'derby']
  },
  {
    id: 'race.tenno_sho_autumn',
    name: 'Tenno Sho (Autumn)',
    category: 'Race',
    aliases: ['Aki Ten', 'Autumn Tenno Sho', 'tenno sho autumn', 'akiten']
  },
  {
    id: 'race.tenno_sho_spring',
    name: 'Tenno Sho (Spring)',
    category: 'Race',
    aliases: ['Haru Ten', 'Spring Tenno Sho', 'tenno sho spring', 'haruten']
  },
  {
    id: 'race.takarazuka_kinen',
    name: 'Takarazuka Kinen',
    category: 'Race',
    aliases: ['Takarazuka', 'takarazuka kinen', 'takarazuka']
  },

  // Factor
  {
    id: 'factor.blue_speed',
    name: 'Speed Factor (Blue)',
    category: 'Factor',
    aliases: ['Speed Factor', 'Blue Speed', 'Blue Factor', 'speed factor', 'blue speed']
  },
  {
    id: 'factor.blue_stamina',
    name: 'Stamina Factor (Blue)',
    category: 'Factor',
    aliases: ['Stamina Factor', 'Blue Stamina', 'stamina factor', 'blue stamina']
  },
  {
    id: 'factor.blue_power',
    name: 'Power Factor (Blue)',
    category: 'Factor',
    aliases: ['Power Factor', 'Blue Power', 'power factor', 'blue power']
  },
  {
    id: 'factor.red_turf',
    name: 'Turf Factor (Red)',
    category: 'Factor',
    aliases: ['Turf Factor', 'Red Turf', 'turf factor', 'red turf']
  },
  {
    id: 'factor.red_sprint',
    name: 'Sprint Factor (Red)',
    category: 'Factor',
    aliases: ['Sprint Factor', 'Red Sprint', 'sprint factor', 'red sprint']
  },
  {
    id: 'factor.ura_finals',
    name: 'URA Finals Factor',
    category: 'Factor',
    aliases: ['URA Factor', 'URA Finals', 'ura factor', 'ura finals factor']
  },

  // Event
  {
    id: 'event.rudolf_event',
    name: 'Rudolf Event',
    category: 'Event',
    aliases: ['Rudolf', 'Symboli Rudolf Event', 'Emperor Event', 'Rudolf Secret', 'rudolf event', 'rudolf']
  },
  {
    id: 'event.aoharu_hai',
    name: 'Aoharu Hai',
    category: 'Event',
    aliases: ['Aoharu', 'Unity Cup', 'aoharu hai', 'aoharu']
  },
  {
    id: 'event.grand_live',
    name: 'Grand Live',
    category: 'Event',
    aliases: ['GrandLive', 'Our Grand Concert', 'grand live', 'grandlive']
  },
  {
    id: 'event.ura_finals',
    name: 'URA Finals Scenario',
    category: 'Event',
    aliases: ['URA Scenario', 'URA Finals', 'ura finals']
  },

  // Title
  {
    id: 'title.classic_triple_crown',
    name: 'Classic Triple Crown',
    category: 'Title',
    aliases: ['Triple Crown', 'Satsuki Derby Kikka', 'triple crown']
  },
  {
    id: 'title.spring_senior_triple_crown',
    name: 'Spring Senior Triple Crown',
    category: 'Title',
    aliases: ['Spring Triple Crown', 'spring triple crown']
  },
  {
    id: 'title.autumn_senior_triple_crown',
    name: 'Autumn Senior Triple Crown',
    category: 'Title',
    aliases: ['Autumn Triple Crown', 'autumn triple crown']
  },

  // Condition
  {
    id: 'condition.good_condition',
    name: 'Good Condition',
    category: 'Condition',
    aliases: ['Great Condition', 'Zekkouchou', 'Superb', 'good condition']
  },
  {
    id: 'condition.slump',
    name: 'Slump',
    category: 'Condition',
    aliases: ['Bad Condition', 'Fuchou', 'slump']
  },
  {
    id: 'condition.practice_poor',
    name: 'Practice Poor',
    category: 'Condition',
    aliases: ['Slacker', 'Practice Weak', 'practice poor']
  },
  {
    id: 'condition.skin_trouble',
    name: 'Skin Trouble',
    category: 'Condition',
    aliases: ['Rough Skin', 'Skin Condition', 'skin trouble']
  },
  {
    id: 'condition.night_owl',
    name: 'Night Owl',
    category: 'Condition',
    aliases: ['Insomnia', 'Sleep Deprived', 'night owl']
  },

  // Item
  {
    id: 'item.energy_drink',
    name: 'Energy Drink',
    category: 'Item',
    aliases: ['Stamina Potion', 'Energy Potion', 'energy drink']
  },
  {
    id: 'item.alarm_clock',
    name: 'Alarm Clock',
    category: 'Item',
    aliases: ['Clock', 'Retry Clock', 'alarm clock']
  },
  {
    id: 'item.carrot',
    name: 'Royal Carrot',
    category: 'Item',
    aliases: ['Carrot', 'Energy Carrot', 'royal carrot', 'carrot']
  },
  {
    id: 'item.parfait',
    name: 'Special Parfait',
    category: 'Item',
    aliases: ['Parfait', 'Mood Parfait', 'special parfait', 'parfait']
  }
];

export class TaxonomyLoader {
  /**
   * Loads taxonomy nodes into a TaxonomyRegistry.
   */
  public static load(nodes: TaxonomyNode[] = DEFAULT_TAXONOMY_NODES): TaxonomyRegistry {
    const registry = new TaxonomyRegistry();
    for (const node of nodes) {
      registry.register(node);
    }
    return registry;
  }

  /**
   * Loads taxonomy from Markdown table/bullet formatted text.
   */
  public static loadFromMarkdown(markdown: string): TaxonomyRegistry {
    const registry = new TaxonomyRegistry();
    const lines = markdown.split('\n');
    let currentCategory = 'General';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('#')) {
        currentCategory = trimmed.replace(/^#+\s*/, '').trim();
        continue;
      }

      // Format: - Name (aliases: a, b)
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const itemText = trimmed.replace(/^[-*]\s*/, '').trim();
        const aliasMatch = itemText.match(/^(.*?)\s*\((?:aliases|aka):\s*(.*?)\)$/i);
        if (aliasMatch) {
          const name = aliasMatch[1].trim();
          const aliases = aliasMatch[2].split(',').map(a => a.trim()).filter(Boolean);
          const id = `${currentCategory.toLowerCase().replace(/\s+/g, '_')}.${name.toLowerCase().replace(/\s+/g, '_')}`;
          registry.register({
            id,
            category: currentCategory,
            name,
            aliases
          });
        } else {
          const name = itemText;
          const id = `${currentCategory.toLowerCase().replace(/\s+/g, '_')}.${name.toLowerCase().replace(/\s+/g, '_')}`;
          registry.register({
            id,
            category: currentCategory,
            name,
            aliases: []
          });
        }
      }
    }

    return registry;
  }
}

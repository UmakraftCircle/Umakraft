export interface CharacterKnowledge {
  id: string;
  name: string;
  rarity: string;
  surfaceAptitude: string[];
  distanceAptitude: string[];
  runningStyleAptitude: string[];
  growthRates: {
    speed: number;
    stamina: number;
    power: number;
    guts: number;
    wisdom: number;
  };
}

export interface SkillKnowledge {
  id: string;
  name: string;
  description: string;
  rarity: string;
  category: string;
}

export interface SupportKnowledge {
  id: string;
  name: string;
  type: string;
}

export interface RaceKnowledge {
  name: string;
  track: string;
  distance: string;
  season: string;
}

export interface TrackKnowledge {
  track: string;
  distance: number;
  surface: string;
  turns: string;
}

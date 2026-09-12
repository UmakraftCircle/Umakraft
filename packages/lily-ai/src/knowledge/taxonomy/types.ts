export enum RunningStyle {
  FRONT_RUNNER = "Front Runner",
  PACE_CHASER = "Pace Chaser",
  LATE_SURGER = "Late Surger",
  END_CLOSER = "End Closer"
}

export enum Distance {
  SPRINT = "Sprint",
  MILE = "Mile",
  MEDIUM = "Medium",
  LONG = "Long"
}

export enum Surface {
  TURF = "Turf",
  DIRT = "Dirt"
}

export enum Track {
  NAKAYAMA = "Nakayama",
  TOKYO = "Tokyo",
  HANSHIN = "Hanshin",
  KYOTO = "Kyoto",
  CHUKYO = "Chukyo",
  OHI = "Ohi",
  KAWASAKI = "Kawasaki",
  FUNABASHI = "Funabashi",
  MORIOKA = "Morioka"
}

export interface TaxonomyEntity {
  id: string;
  canonical: string;
  type: 'running_style' | 'distance' | 'surface' | 'track' | 'character' | 'skill';
  aliases: string[];
}

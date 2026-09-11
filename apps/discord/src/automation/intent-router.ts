import { trainerMemoryStore } from './trainer-memory.js';

export type Intent =
  | 'fan_progress'
  | 'deficit_check'
  | 'surplus_check'
  | 'leaderboard_lookup'
  | 'milestone_status'
  | 'milestone_projection'
  | 'trainer_profile'
  | 'link_request'
  | 'help'
  | 'fan_gain'
  | 'leaderboard'
  | 'rank'
  | 'milestone'
  | 'fan_pace'
  | 'surplus_leaderboard'
  | 'deficit_leaderboard'
  | 'character_lookup'
  | 'skill_lookup'
  | 'support_card_lookup'
  | 'card_lookup'
  | 'training_advice'
  | 'training_lookup'
  | 'inheritance_advice'
  | 'inheritance_lookup'
  | 'scenario_help'
  | 'scenario_lookup'
  | 'build_review'
  | 'mechanics_explanation'
  | 'mechanics_lookup'
  | 'track_lookup'
  | 'latest_event'
  | 'banner_info'
  | 'patch_notes'
  | 'news'
  | 'greeting'
  | 'small_talk'
  | 'opinion'
  | 'joke'
  | 'casual_chat'
  | 'debug_why'
  | 'debug_stats'
  | 'chat';

export interface ClassifiedIntent {
  intent: Intent;
  confidence: number;
}

export interface IntentResult {
  intent: Intent;
  confidence: number; // 0.0 to 1.0 (e.g. 0.95 = 95%)
  intents: ClassifiedIntent[];
  needsClarification: boolean;
  clarificationPrompt?: string;
  rawContent: string;
}

/**
 * Detects user intent for Discord automation routing.
 * High confidence (>0.80) routes directly to native tools without requiring commands.
 */
export function classifyIntent(content: string, userId?: string): IntentResult {
  const rawContent = content.trim();
  const lower = rawContent.toLowerCase();

  if (!rawContent) {
    return {
      intent: 'chat',
      confidence: 0.0,
      intents: [{ intent: 'chat', confidence: 0.0 }],
      needsClarification: false,
      rawContent,
    };
  }

  const detectedIntents: ClassifiedIntent[] = [];

  // Check for Ambiguous Pronouns ("she", "her", "that build", "how is she doing")
  const ambiguousPronouns = ['she', 'her', 'how is she doing', 'what skills for her', 'rate her build', 'that build'];
  const containsAmbiguous = ambiguousPronouns.some((p) => lower.includes(p));

  if (containsAmbiguous && userId) {
    const workMem = trainerMemoryStore.getWorkingMemory(userId);
    const permMem = trainerMemoryStore.getPermanentMemory(userId);
    const characterContext = workMem.currentBuild || permMem.preferences.preferredCharacter;

    if (!characterContext) {
      return {
        intent: 'build_review',
        confidence: 0.5,
        intents: [{ intent: 'build_review', confidence: 0.5 }],
        needsClarification: true,
        clarificationPrompt:
          'Are you referring to Tokai Teio, your current build project, or another character? Let me know so I can give you exact advice! 🐎',
        rawContent,
      };
    }
  }

  // Exact slash command matching (100% confidence)
  if (lower.startsWith('/fan-gain')) detectedIntents.push({ intent: 'fan_gain', confidence: 1.0 });
  if (lower.startsWith('/fan-leaderboard')) detectedIntents.push({ intent: 'leaderboard_lookup', confidence: 1.0 });
  if (lower.startsWith('/rank')) detectedIntents.push({ intent: 'rank', confidence: 1.0 });
  if (lower.startsWith('/milestone')) detectedIntents.push({ intent: 'milestone_status', confidence: 1.0 });
  if (lower.startsWith('/pace') || lower.startsWith('/deficit') || lower.startsWith('/surplus')) detectedIntents.push({ intent: 'deficit_check', confidence: 1.0 });
  if (lower.startsWith('/link')) detectedIntents.push({ intent: 'link_request', confidence: 1.0 });
  if (lower.startsWith('/help')) detectedIntents.push({ intent: 'help', confidence: 1.0 });

  // 1. Surplus / Deficit Leaderboard keywords
  if (lower.includes('fan surplus leaderboard') || lower.includes('surplus leaderboard')) {
    detectedIntents.push({ intent: 'surplus_leaderboard', confidence: 0.95 });
  }
  if (lower.includes('fan deficit leaderboard') || lower.includes('deficit leaderboard')) {
    detectedIntents.push({ intent: 'deficit_leaderboard', confidence: 0.95 });
  }

  // 2. Deficit / Surplus / Pace
  if (lower.includes('am i behind') || lower.includes('deficit') || lower.includes('behind pace')) {
    detectedIntents.push({ intent: 'deficit_check', confidence: 0.95 });
  } else if (lower.includes('am i ahead') || lower.includes('surplus') || lower.includes('ahead of pace')) {
    detectedIntents.push({ intent: 'surplus_check', confidence: 0.95 });
  } else if (lower.includes('fan pace') || lower.includes('how am i doing this month') || lower.includes('my fans') || lower.includes('fan progress')) {
    detectedIntents.push({ intent: 'fan_progress', confidence: 0.95 });
  }

  // 3. Leaderboard
  if (lower.includes('where am i ranked') || lower.includes('leaderboard') || lower.includes('top trainers') || lower.includes('rankings')) {
    detectedIntents.push({ intent: 'leaderboard_lookup', confidence: 0.95 });
  }

  // 4. Milestone Status & Projection
  if (lower.includes('can i reach') || lower.includes('can i hit') || lower.includes('reach 300m') || lower.includes('reach milestone')) {
    detectedIntents.push({ intent: 'milestone_projection', confidence: 0.95 });
  } else if (lower.includes('milestone') || lower.includes('next goal')) {
    detectedIntents.push({ intent: 'milestone_status', confidence: 0.92 });
  }

  // 5. Trainer Profile & Link Request
  if (lower.includes('my profile') || lower.includes('trainer profile') || lower.includes('my stats')) {
    detectedIntents.push({ intent: 'trainer_profile', confidence: 0.92 });
  }
  if (lower.includes('link account') || lower.includes('request link') || lower.includes('link trainer')) {
    detectedIntents.push({ intent: 'link_request', confidence: 0.95 });
  }

  // 6. Umamusume Knowledge Intents
  if (lower.includes('skill') || lower.includes('what does ') || lower.includes('maestros') || lower.includes('concentration')) {
    detectedIntents.push({ intent: 'skill_lookup', confidence: 0.90 });
  }
  if (lower.includes('ssr') || lower.includes('support card') || lower.includes('card')) {
    detectedIntents.push({ intent: 'support_card_lookup', confidence: 0.90 });
  }
  if (lower.includes('who is ') || lower.includes('tell me about ') || lower.includes('tokai teio') || lower.includes('kitasan black')) {
    detectedIntents.push({ intent: 'character_lookup', confidence: 0.88 });
  }
  if (lower.includes('improve my') || lower.includes('build advice') || lower.includes('how to build') || lower.includes('rate my build')) {
    detectedIntents.push({ intent: 'build_review', confidence: 0.92 });
  }
  if (lower.includes('inherit') || lower.includes('parent')) {
    detectedIntents.push({ intent: 'inheritance_advice', confidence: 0.90 });
  }
  if (lower.includes('scenario') || lower.includes("l'arc") || lower.includes('uaf')) {
    detectedIntents.push({ intent: 'scenario_help', confidence: 0.90 });
  }
  if (lower.includes('mechanic') || lower.includes('acceleration')) {
    detectedIntents.push({ intent: 'mechanics_explanation', confidence: 0.88 });
  }

  // 7. Research Intents
  if (lower.includes('event') || lower.includes('latest event')) detectedIntents.push({ intent: 'latest_event', confidence: 0.88 });
  if (lower.includes('banner') || lower.includes('gacha banner')) detectedIntents.push({ intent: 'banner_info', confidence: 0.88 });
  if (lower.includes('patch') || lower.includes('update')) detectedIntents.push({ intent: 'patch_notes', confidence: 0.88 });
  if (lower.includes('news')) detectedIntents.push({ intent: 'news', confidence: 0.85 });

  // 8. Conversation Intents
  if (lower === 'hi' || lower === 'hello' || lower === 'hey' || lower.startsWith('good morning')) {
    detectedIntents.push({ intent: 'greeting', confidence: 0.95 });
  } else if (lower.includes('how are you') || lower.includes('whats up')) {
    detectedIntents.push({ intent: 'small_talk', confidence: 0.90 });
  } else if (lower.includes('joke') || lower.includes('tell me a joke')) {
    detectedIntents.push({ intent: 'joke', confidence: 0.95 });
  }

  // Debug Intents
  if (lower.includes('debug why')) detectedIntents.push({ intent: 'debug_why', confidence: 1.0 });
  if (lower.includes('debug stats')) detectedIntents.push({ intent: 'debug_stats', confidence: 1.0 });

  // Default fallback
  if (detectedIntents.length === 0) {
    detectedIntents.push({ intent: 'chat', confidence: 0.5 });
  }

  // Sort by highest confidence first
  detectedIntents.sort((a, b) => b.confidence - a.confidence);

  const primary = detectedIntents[0];

  return {
    intent: primary.intent,
    confidence: primary.confidence,
    intents: detectedIntents,
    needsClarification: false,
    rawContent,
  };
}


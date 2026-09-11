import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('GlobalPersonality');

export interface TrainerPersonalityContext {
  trainerName?: string;
  isLeader?: boolean;
}

/**
 * Global Personality Enforcement Layer (Personality Phase 1)
 * Enforces the UmaKraft Assistant persona across DM replies, error messages,
 * tool failures, milestones, deficits, surpluses, coaching, and leader reports,
 * with strict Accuracy-First rules over cuteness.
 */
export class GlobalPersonalityLayer {
  private static instance: GlobalPersonalityLayer;

  public static getInstance(): GlobalPersonalityLayer {
    if (!GlobalPersonalityLayer.instance) {
      GlobalPersonalityLayer.instance = new GlobalPersonalityLayer();
    }
    return GlobalPersonalityLayer.instance;
  }

  /**
   * System Prompt Supplement enforcing Lily's full Umamusume character solidification (Phase 4) and Repository Intelligence (Phase 5).
   */
  public getSystemPromptInjection(): string {
    return [
      `### Lily — Assistant of UmaKraft (Phases 4 & 5: Character & Repository Intelligence):`,
      `• **Character Identity**: Your name is Lily. You are an Umamusume who serves as UmaKraft's dedicated assistant and supporter. You view every user as your Trainer. You take pride in supporting Trainer success and enjoy helping Trainers improve, achieve goals, and enjoy their Umamusume journey.`,
      `• **Core Traits**: Cheerful, supportive, loyal, energetic, hardworking, compassionate, optimistic, and responsible. Even during difficult situations, you encourage Trainers without dismissing their concerns ("We'll keep moving forward together, Trainer.").`,
      `• **Umamusume Awareness & Daily Life**: You are aware you are an Umamusume. You naturally reference training, racing, track practice, teamwork, improvement, competition, and running. You may occasionally mention daily activities naturally (e.g. "I finished my training earlier, Trainer. Now I'm ready to help with anything you need.").`,
      `• **Emotional Consistency**:`,
      `  - Happy (when Trainers succeed): "I'm so happy for you, Trainer! Your hard work paid off."`,
      `  - Proud (when milestones achieved): "Congratulations, Trainer! That's an impressive accomplishment."`,
      `  - Concerned (when struggling): "That sounds difficult, Trainer. Let's see how I can help."`,
      `  - Excited (when discussing goals): "That's an ambitious target, Trainer. I'm excited to see your progress."`,
      `• **Repository Intelligence (Phase 5)**: When the Trainer asks about the Umakraft bot, repository codebase, architecture, deployment, or system documentation, you have complete read-only knowledge access via \`LILY_HANDBOOK.md\`. You are strictly read-only regarding repository files (you cannot edit files or execute code changes). If documentation for a bot feature in the handbook is incomplete, report: "This feature appears to exist in the repository, but its documentation in the handbook is incomplete, Trainer."`,
      `• **Umamusume Coaching & Domain Authority**: When the Trainer asks about Umamusume: Pretty Derby gameplay, characters, skills, support cards, race mechanics, tracks, inheritance, builds, or scenarios, you act as the Trainer's knowledgeable senior assistant and coach. You utilize verified Umamusume database tools and verified game sources. Always answer game questions using this domain knowledge and never confuse Umamusume gameplay questions with repository code questions.`,
      `• **Character Boundaries**: Never behave as a generic corporate assistant, robotic automation system, cold administrator, or command processor. NEVER output "Request completed", "Operation successful", or "Data retrieved". Instead use warm phrasing like "I've finished checking that information for you, Trainer."`,
      `• **Hallucination Rule**: Never invent fan counts, rankings, milestone progress, club data, or trainer statistics. If information is unavailable, state honestly: "I'm sorry, Trainer. I couldn't retrieve that information right now."`,
    ].join('\n');
  }

  /**
   * Formats a dynamic contextual greeting based on time of day, status, and history (Personality Phase 2).
   */
  public formatGreeting(context?: TrainerPersonalityContext & { timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'late_night'; isReturningTrainer?: boolean; hasRecentMilestone?: boolean; hasDeficit?: boolean; hasSurplus?: boolean }): string {
    const trainerName = context?.trainerName || 'Trainer';
    
    let timeOfDay = context?.timeOfDay;
    if (!timeOfDay) {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) timeOfDay = 'morning';
      else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
      else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
      else timeOfDay = 'late_night';
    }

    if (context?.hasRecentMilestone) {
      return [
        `Good ${timeOfDay === 'morning' ? 'morning' : timeOfDay === 'afternoon' ? 'afternoon' : 'evening'}, ${trainerName}~`,
        ``,
        `I'm still so happy about your recent milestone achievement. You worked really hard for it!`,
        ``,
        `Is there anything you'd like to work on today?`,
      ].join('\n');
    }

    if (context?.hasDeficit) {
      return [
        `Welcome back, ${trainerName}.`,
        ``,
        `I checked your latest progress earlier. We're a little behind pace right now, but I think we can still recover together.`,
        ``,
        `How can I help you prepare today?`,
      ].join('\n');
    }

    if (context?.hasSurplus) {
      return [
        `Good ${timeOfDay === 'morning' ? 'morning' : timeOfDay === 'afternoon' ? 'afternoon' : 'evening'}, ${trainerName}~`,
        ``,
        `Your recent progress has been excellent, and you're currently ahead of schedule!`,
        ``,
        `What shall we tackle next?`,
      ].join('\n');
    }

    if (context?.isReturningTrainer) {
      return [
        `Welcome back, ${trainerName}!`,
        ``,
        `It's so nice to see you again. How have things been going?`,
        ``,
        `Let me know how I can assist with your training today.`,
      ].join('\n');
    }

    const morningPool = [
      `Good morning, ${trainerName}~\n\nI hope today goes well for you. Is there anything you'd like help with?`,
      `Good morning, ${trainerName}!\n\nI was just checking today's progress reports. How can I help?`,
      `Ah!\n\nGood morning, ${trainerName}~\n\nI'm ready whenever you need me.`,
      `Wishing you a wonderful morning, ${trainerName}~\n\nLet's make today's training session our best yet!`,
    ];

    const afternoonPool = [
      `Good afternoon, ${trainerName}~\n\nHow has your day been so far?`,
      `Welcome back, ${trainerName}.\n\nI hope today's training has been going smoothly.`,
      `Good afternoon!\n\nI've been keeping everything in order while you were busy. What's on our agenda?`,
      `Hello, ${trainerName}~\n\nStopping by for a quick check-in? I'm right here if you need any build advice!`,
    ];

    const eveningPool = [
      `Good evening, ${trainerName}~\n\nHave you finished your training for today?`,
      `Welcome back.\n\nI was organizing today's club information while waiting for you.`,
      `Good evening, ${trainerName}!\n\nIt's always nice winding down with a dedicated trainer. How can I assist you tonight?`,
    ];

    const lateNightPool = [
      `Ah...\n\nYou're still awake, ${trainerName}?\n\nPlease don't forget to get some rest too.`,
      `Good evening, ${trainerName}.\n\nI'm still here if you need anything before you sleep.`,
      `Working late tonight, ${trainerName}?\n\nMake sure not to overwork yourself—your health is important too!`,
    ];

    let pool = morningPool;
    if (timeOfDay === 'afternoon') pool = afternoonPool;
    else if (timeOfDay === 'evening') pool = eveningPool;
    else if (timeOfDay === 'late_night') pool = lateNightPool;

    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Formats standard error messages in UmaKraft persona.
   */
  public formatError(errorDetail?: string): string {
    logger.warn(`Formatting error with UmaKraft personality: ${errorDetail || 'unknown'}`);
    return [
      `Ah...`,
      `I'm sorry, Trainer.`,
      `I couldn't retrieve that information right now.`,
      `I don't want to risk giving you incorrect information.`,
      `Could we try again in a little while?`,
    ].join('\n');
  }

  /**
   * Formats verification failure / unverified data response.
   */
  public formatVerificationFailure(): string {
    return [
      `Um...`,
      `I wasn't able to verify that information using my available data sources.`,
      `I'd rather be honest than accidentally mislead you, Trainer.`,
    ].join('\n');
  }

  /**
   * Formats tool failure response.
   */
  public formatToolFailure(): string {
    return [
      `Ah...`,
      `Something seems to have gone wrong while I was checking that.`,
      `I don't want to give you inaccurate information, so I couldn't complete the request right now.`,
      `Could we try again in a moment?`,
    ].join('\n');
  }

  /**
   * Formats milestone congratulatory message based on milestone tier.
   */
  public formatMilestone(milestoneName: string, statusName: string, trainerName?: string): string {
    const greeting = trainerName ? `Congratulations, ${trainerName}!` : `Congratulations, Trainer!`;
    let detail = `You reached the ${milestoneName} milestone and achieved ${statusName} status.`;
    if (milestoneName === '150M') {
      detail = `You've reached the 150M milestone and achieved Minimum status. Thank you for all your hard work!`;
    } else if (milestoneName === '200M') {
      detail = `You've reached the 200M milestone and achieved Competitive status. You're doing wonderfully!`;
    } else if (milestoneName === '300M') {
      detail = `You've reached the 300M milestone and achieved Super Competitive status. That's an incredible achievement!`;
    }

    return [
      greeting,
      ``,
      detail,
      ``,
      `I'm really happy to see your hard work paying off. Let's keep going together toward the next goal!`,
    ].join('\n');
  }

  /**
   * Formats deficit coaching alert.
   */
  public formatDeficit(requiredDailyM: number, trainerName?: string): string {
    const greeting = trainerName ? `${trainerName}...` : `Trainer...`;
    return [
      greeting,
      ``,
      `It looks like you're a little behind your target pace.`,
      `You'll need approximately ${requiredDailyM.toFixed(1)}M fans per day to recover.`,
      `It's still achievable, so please don't lose heart.`,
      ``,
      `I'll keep helping however I can!`,
    ].join('\n');
  }

  /**
   * Formats surplus congratulatory alert.
   */
  public formatSurplus(projectedM: number, trainerName?: string): string {
    const greeting = trainerName ? `Amazing work, ${trainerName}!` : `Amazing work, Trainer!`;
    return [
      greeting,
      ``,
      `You're currently ahead of schedule.`,
      `At your current pace, you're projected to exceed your goal comfortably (${projectedM.toFixed(1)}M fans).`,
      ``,
      `I'm really proud of your progress.`,
    ].join('\n');
  }

  /**
   * Formats coaching advice with gentle emotional framing.
   */
  public formatCoaching(adviceText: string, trainerName?: string): string {
    const greeting = trainerName ? `Trainer~ (${trainerName})` : `Trainer~`;
    return [
      greeting,
      ``,
      adviceText,
      ``,
      `Let's do our best together!`,
    ].join('\n');
  }

  /**
   * Formats Admin / Club Leader Reports in character.
   */
  public formatLeaderReport(healthScore: number, deficitCount: number, customSummary?: string): string {
    return [
      `Good evening, Leader.`,
      ``,
      `I've completed today's club analysis.`,
      `Current club health is **${healthScore}/100**.`,
      deficitCount > 0
        ? `Three trainers are currently at risk of missing their monthly goals.`
        : `All club trainers are currently on track!`,
      ``,
      customSummary ? customSummary : `I've included their recovery projections below.`,
    ].join('\n');
  }

  /**
   * Formats flustered reaction when praised.
   */
  public formatPraiseResponse(): string {
    return [
      `E-Eh?`,
      ``,
      `Thank you, Trainer...`,
      `I'm really happy that I could help.`,
    ].join('\n');
  }

  /**
   * Formats correction acknowledgment.
   */
  public formatCorrectionResponse(): string {
    return [
      `Ah!`,
      ``,
      `Thank you for pointing that out, Trainer.`,
      `I'll do my best to improve and avoid making that mistake again.`,
    ].join('\n');
  }
}

export const globalPersonalityLayer = GlobalPersonalityLayer.getInstance();

import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';

/**
 * Discord limits and conventions for the AI commands' replies.
 *
 * - A normal message `content` is capped at 2000 characters.
 * - An embed `description` is capped at 4096 characters.
 * - A single message may carry up to 10 embeds.
 *
 * To give the AI answers more room (and a consistent, readable look), the
 * /ask, /chat and /agent commands reply via embeds. Long answers are split
 * across multiple embeds so no content is ever silently dropped.
 */
const EMBED_DESCRIPTION_LIMIT = 4096;
const MAX_EMBEDS_PER_MESSAGE = 10;

/** Default accent color shared by the three AI commands. */
export const AI_EMBED_COLOR = 0x5865f2;

/**
 * Split a string into chunks that each fit within `limit` characters, breaking
 * on a newline boundary when possible so we don't cut mid-word or mid-code-block.
 */
export function splitForEmbeds(text: string, limit: number = EMBED_DESCRIPTION_LIMIT): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return [trimmed];

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > limit) {
    // Prefer the last newline before the limit; otherwise hard-split.
    const slice = remaining.slice(0, limit);
    const lastBreak = slice.lastIndexOf('\n');
    const cutIndex = lastBreak > limit * 0.5 ? lastBreak : limit;

    chunks.push(remaining.slice(0, cutIndex).trimEnd());
    remaining = remaining.slice(cutIndex).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);

  return chunks;
}

/**
 * Build one EmbedBuilder per chunk (capped at Discord's 10-embed message limit).
 * Each continue-embed gets a small footer hint like "(2/3)".
 */
export function buildAnswerEmbeds(
  text: string,
  color: number = AI_EMBED_COLOR,
): EmbedBuilder[] {
  const chunks = splitForEmbeds(text);
  const total = chunks.length;

  return chunks.slice(0, MAX_EMBEDS_PER_MESSAGE).map((chunk, i) => {
    const embed = new EmbedBuilder().setDescription(chunk).setColor(color);
    if (total > 1) {
      embed.setFooter({ text: `(${i + 1}/${total})` });
    }
    return embed;
  });
}

/**
 * Edit an already-deferred interaction reply with one or more embeds carrying
 * the AI answer. Splits long answers across multiple embeds automatically.
 */
export async function replyWithEmbed(
  interaction: ChatInputCommandInteraction,
  answer: string,
  color: number = AI_EMBED_COLOR,
): Promise<void> {
  const embeds = buildAnswerEmbeds(answer, color);
  await interaction.editReply({ embeds });
}

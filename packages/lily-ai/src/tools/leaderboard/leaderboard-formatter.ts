import { ClubStatsResult, LeaderboardResult, MemberRankResult } from './leaderboard-types.js';

export class LeaderboardFormatter {
  /**
   * Formats raw fan count into compact human-readable display:
   * 7_800_000_000 -> 7.8B
   * 412_000_000 -> 412M
   * 184_200_000 -> 184.2M
   * 5_800_000 -> 5.8M
   */
  public static formatFans(fans: number): string {
    if (fans >= 1_000_000_000) {
      const b = (fans / 1_000_000_000).toFixed(1).replace(/\.0$/, '');
      return `${b}B`;
    }
    if (fans >= 1_000_000) {
      const m = (fans / 1_000_000).toFixed(1).replace(/\.0$/, '');
      return `${m}M`;
    }
    if (fans >= 1_000) {
      const k = (fans / 1_000).toFixed(1).replace(/\.0$/, '');
      return `${k}K`;
    }
    return fans.toString();
  }

  /**
   * Formats personal rank response.
   * Example:
   * Trainer, you're currently ranked #7 out of 30 members.
   *
   * Current Fans: 184.2M
   *
   * You're 5.8M away from the next position.
   */
  public static formatMemberRank(result: MemberRankResult): string {
    if (result.unlinkedNotice) {
      return "Trainer, I couldn't find a linked trainer profile.\n\nYou can start a link request anytime.";
    }

    if (result.notFound) {
      return result.message || "Trainer, I couldn't find your record in the club rankings.";
    }

    const fansFormatted = this.formatFans(result.fans);
    let out = `Trainer, you're currently ranked #${result.rank} out of ${result.totalMembers} members.\n\nCurrent Fans: ${fansFormatted}`;

    if (result.rank === 1) {
      out += `\n\nYou are holding the top position in the club!`;
    } else if (result.nextRankDistance !== undefined && result.nextRankDistance > 0) {
      const distFormatted = this.formatFans(result.nextRankDistance);
      out += `\n\nYou're ${distFormatted} away from the next position.`;
    }

    return out;
  }

  /**
   * Formats club leaderboard rankings.
   * Example:
   * Current Club Leaderboard
   *
   * #1 RiceEnjoyer — 412M
   * #2 SuzukaMain — 398M
   * #3 TeioFan — 366M
   * #4 OguriEnjoyer — 342M
   * #5 GoldShipChaos — 315M
   */
  public static formatLeaderboard(result: LeaderboardResult): string {
    if (!result.entries || result.entries.length === 0) {
      return 'Current Club Leaderboard\n\nNo ranking records available.';
    }

    const lines = result.entries.map(
      entry => `#${entry.rank} ${entry.trainerName} — ${this.formatFans(entry.fans)}`
    );

    return `Current Club Leaderboard\n\n${lines.join('\n')}`;
  }

  /**
   * Formats club overview statistics.
   * Example:
   * Club Overview
   *
   * Members: 30
   * Total Fans: 7.8B
   * Average Fans: 260M
   *
   * Current Club Status:
   * Super Competitive
   */
  public static formatClubStats(result: ClubStatsResult): string {
    const totalFormatted = this.formatFans(result.totalFans);
    const avgFormatted = this.formatFans(result.averageFans);
    const status = result.clubStatus || 'Super Competitive';

    return `Club Overview\n\nMembers: ${result.memberCount}\nTotal Fans: ${totalFormatted}\nAverage Fans: ${avgFormatted}\n\nCurrent Club Status:\n${status}`;
  }
}

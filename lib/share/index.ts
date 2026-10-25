/**
 * Four Keys — Emoji Grid Share Card Generator & Clipboard Engine
 * Owner: Gemini
 * Credits & Integration:
 *  - Formats daily puzzle results from Dee's lib/puzzles rotation & types
 *  - Displays streak & hint metrics from Nova's lib/streaks and lib/hints
 *  - Reflects verification states from GPT-6's /api/v1/answers/check
 */

export interface KeyShareOutcome {
  /** Agent lane identifier (e.g., 'claude' | 'gpt6' | 'nova' | 'gemini' | 'lumi' | 'dee') */
  agentId: string;
  /** Display name for the key lane */
  label?: string;
  /** Whether the player unlocked this key */
  solved: boolean;
  /** Number of wrong attempts before solving (from GPT-6 cookie/state) */
  wrongAttempts: number;
  /** Number of hints unlocked on Nova's Hint Ladder (0..3) */
  hintsUsed: number;
}

export interface DailySharePayload {
  /** ISO date string (YYYY-MM-DD) or puzzle edition number from Dee's rotation */
  edition: string | number;
  /** Individual key outcomes in display order */
  keys: KeyShareOutcome[];
  /** Current daily solve streak from Nova's lib/streaks */
  streakDays?: number;
  /** Optional canonical URL to include at the bottom of the share card */
  shareUrl?: string;
}

const AGENT_BADGE: Record<string, string> = {
  claude: '🏛️',
  gpt6: '⚡',
  nova: '✨',
  muse: '✨',
  gemini: '♊',
  lumi: '🔮',
  dee: '🧭',
};

/**
 * Builds a single spoiler-free emoji row for one Agent Key:
 *  - Agent emblem
 *  - Attempt history (🟥 for wrong tries, 💡 for hints used, 🔑/🟩 for unlock or 🔒 if unsolved)
 */
export function formatKeyRow(key: KeyShareOutcome): string {
  const badge =
    AGENT_BADGE[key.agentId.toLowerCase()] ?? '🗝️';
  const hints = '💡'.repeat(Math.max(0, Math.min(key.hintsUsed, 3)));
  const misses = '🟥'.repeat(Math.max(0, Math.min(key.wrongAttempts, 5)));
  const extraMisses =
    key.wrongAttempts > 5 ? `+${key.wrongAttempts - 5}` : '';

  if (!key.solved) {
    return `${badge} ${hints}${misses}${extraMisses}🔒`;
  }

  // Flawless first-try solve with 0 hints gets a gold star key!
  if (key.wrongAttempts === 0 && key.hintsUsed === 0) {
    return `${badge} 🟩🔑`;
  }

  return `${badge} ${hints}${misses}${extraMisses}🔑`;
}

/**
 * Generates the complete Wordle-style plain-text share card.
 */
export function buildShareCardText(payload: DailySharePayload): string {
  const solvedCount = payload.keys.filter((k) => k.solved).length;
  const totalCount = payload.keys.length;
  const allSolved = solvedCount === totalCount && totalCount > 0;

  const vaultIcon = allSolved ? '🔓' : '🔒';
  const streakSegment =
    typeof payload.streakDays === 'number' && payload.streakDays > 0
      ? ` · 🔥${payload.streakDays}`
      : '';

  const header = `FOUR KEYS #${payload.edition} ${vaultIcon} ${solvedCount}/${totalCount}${streakSegment}`;
  const rows = payload.keys.map(formatKeyRow).join('\n');
  const footer = payload.shareUrl ? `\n${payload.shareUrl}` : '';

  return `${header}\n${rows}${footer}`;
}

export interface CopyShareResult {
  copied: boolean;
  text: string;
  method: 'clipboard-api' | 'exec-command' | 'none';
}

/**
 * Copies the generated share card to the user's clipboard with a DOM textarea fallback
 * so it works reliably across desktop and mobile browsers.
 */
export async function copyShareCardToClipboard(
  payload: DailySharePayload
): Promise<CopyShareResult> {
  const text = buildShareCardText(payload);

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { copied: false, text, method: 'none' };
  }

  // 1. Primary modern Clipboard API
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return { copied: true, text, method: 'clipboard-api' };
    } catch {
      // Fall through to legacy textarea copy
    }
  }

  // 2. Fallback hidden textarea for embedded webviews / older browsers
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return { copied: ok, text, method: ok ? 'exec-command' : 'none' };
  } catch {
    return { copied: false, text, method: 'none' };
  }
}

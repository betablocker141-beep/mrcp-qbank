import { Question, MRCPPart } from './types';
import { supabase } from './lib/supabase';

export const DAILY_QUESTION_COUNT = 20;
const STORAGE_KEY_PREFIX = 'mrcp_daily_result_';

export interface DailyMockResult {
  userId: string;
  userName: string;
  part: MRCPPart;
  date: string;       // YYYY-MM-DD
  score: number;
  total: number;
  percentage: number;
  timeTaken: number;  // seconds
  completedAt: string;
}

// ── Deterministic PRNG (mulberry32) ───────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(dateStr: string, part: MRCPPart): number {
  const key = `${dateStr}-${part}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ── Date helper ───────────────────────────────────────────────────────────────
export function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Seconds until next midnight UTC */
export function secondsUntilReset(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.floor((next.getTime() - now.getTime()) / 1000);
}

// ── Question selection ────────────────────────────────────────────────────────
export function getDailyQuestions(
  allQuestions: Question[],
  part: MRCPPart,
  date: string = getTodayUTC(),
): Question[] {
  // Include questions that match the part (MRCP) OR qbank sources (Part-agnostic)
  const pool = allQuestions.filter((q) => {
    if (q.source === 'Passmedicine' || q.source === 'Pastest') return true;
    return q.part === part;
  });
  if (pool.length === 0) return [];

  const rng = mulberry32(dateSeed(date, part));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, DAILY_QUESTION_COUNT);
}

// ── localStorage persistence ──────────────────────────────────────────────────
function lsKey(part: MRCPPart, date: string): string {
  return `${STORAGE_KEY_PREFIX}${part.replace(' ', '_')}_${date}`;
}

export function getTodayResult(part: MRCPPart): DailyMockResult | null {
  try {
    const raw = localStorage.getItem(lsKey(part, getTodayUTC()));
    return raw ? (JSON.parse(raw) as DailyMockResult) : null;
  } catch {
    return null;
  }
}

export function saveDailyResult(result: DailyMockResult): void {
  localStorage.setItem(lsKey(result.part, result.date), JSON.stringify(result));

  // Fire-and-forget sync to Supabase
  void supabase
    .from('daily_mock_results')
    .upsert(
      {
        user_id: result.userId,
        user_name: result.userName,
        part: result.part,
        date: result.date,
        score: result.score,
        total: result.total,
        percentage: result.percentage,
        time_taken: result.timeTaken,
        completed_at: result.completedAt,
      },
      { onConflict: 'user_id,part,date' },
    );
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
export async function getLeaderboard(
  part: MRCPPart,
  date: string = getTodayUTC(),
): Promise<DailyMockResult[]> {
  try {
    const { data, error } = await supabase
      .from('daily_mock_results')
      .select('*')
      .eq('part', part)
      .eq('date', date)
      .order('percentage', { ascending: false })
      .order('time_taken', { ascending: true })
      .limit(50);

    if (error || !data) return [];

    return data.map((row) => ({
      userId: row.user_id as string,
      userName: row.user_name as string,
      part: row.part as MRCPPart,
      date: row.date as string,
      score: row.score as number,
      total: row.total as number,
      percentage: row.percentage as number,
      timeTaken: row.time_taken as number,
      completedAt: row.completed_at as string,
    }));
  } catch {
    return [];
  }
}

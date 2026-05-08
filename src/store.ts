import { Question, UserStats, QuizSession } from './types';
import { supabase, rowToQuestion, questionToRow } from './lib/supabase';

// ── In-memory session cache ─────────────────────────────────
// Avoids re-fetching all questions on every component mount within the same session.
// Invalidated after any mutation (add/update/delete/clear).
let _sessionCache: Question[] | null = null;
let _sessionFetchPromise: Promise<Question[]> | null = null;

// ── Persistent TTL cache ─────────────────────────────────────
// Skips Supabase on page reload if questions were synced within the last 30 minutes.
// Cleared whenever invalidateSessionCache() is called (i.e. after any mutation).
const SYNC_TS_KEY = '_qs_sync_ts';
const SYNC_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function invalidateSessionCache(): void {
  _sessionCache = null;
  _sessionFetchPromise = null;
  try { localStorage.removeItem(SYNC_TS_KEY); } catch { /* ignore */ }
}

// ── Supabase async functions ────────────────────────────────

/**
 * Fetches all questions from Supabase and caches in localStorage + memory.
 * Returns the in-memory cache instantly on subsequent calls within the same session.
 * Falls back to localStorage if Supabase is unreachable.
 */
export async function syncFromSupabase(): Promise<Question[]> {
  // Return memory cache immediately (no network call)
  if (_sessionCache !== null) return _sessionCache;

  // Deduplicate concurrent calls — only one fetch in flight at a time
  if (_sessionFetchPromise) return _sessionFetchPromise;

  // Skip Supabase if questions were synced within the TTL window — use localStorage instead.
  // This prevents a full DB fetch on every page reload for students.
  // The TTL is cleared by invalidateSessionCache() after any admin mutation.
  try {
    const lastSync = Number(localStorage.getItem(SYNC_TS_KEY) ?? 0);
    if (Date.now() - lastSync < SYNC_TTL_MS) {
      const cached = getQuestions();
      if (cached.length > 0) {
        _sessionCache = cached;
        return cached;
      }
    }
  } catch { /* localStorage unavailable — fall through to Supabase */ }

  _sessionFetchPromise = (async () => {
    try {
      // Supabase defaults to 1000 rows max — paginate to fetch all records
      const allData: any[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      if (allData.length > 0) {
        const questions = allData.map(rowToQuestion);
        saveQuestions(questions);
        try { localStorage.setItem(SYNC_TS_KEY, String(Date.now())); } catch { /* ignore */ }
        _sessionCache = questions;
        return questions;
      }

      // Supabase table is empty — seed it with defaults
      const rows = defaultQuestions.map(questionToRow);
      const { error: seedError } = await supabase
        .from('questions')
        .upsert(rows, { onConflict: 'id' });

      if (seedError) throw seedError;

      _sessionCache = defaultQuestions;
      return defaultQuestions;
    } catch (err) {
      console.warn('Supabase sync failed, using local cache:', err);
      const cached = getQuestions();
      if (cached.length > 0) _sessionCache = cached;
      return cached;
    } finally {
      _sessionFetchPromise = null;
    }
  })();

  return _sessionFetchPromise;
}

export async function addQuestionToSupabase(q: Question): Promise<void> {
  const { error } = await supabase.from('questions').insert(questionToRow(q));
  if (error) throw new Error(`Supabase insert failed: ${error.message} (code: ${error.code})`);
  invalidateSessionCache();
}

export async function addQuestionsToSupabase(qs: Question[]): Promise<void> {
  // Supabase upsert in batches of 200 to avoid payload size limits
  const batchSize = 200;
  for (let i = 0; i < qs.length; i += batchSize) {
    const batch = qs.slice(i, i + batchSize);
    const { error } = await supabase
      .from('questions')
      .upsert(batch.map(questionToRow), { onConflict: 'id' });
    if (error) throw new Error(`Supabase upsert failed (batch ${Math.floor(i / batchSize) + 1}): ${error.message} (code: ${error.code})`);
  }
  invalidateSessionCache();
}

export async function updateQuestionInSupabase(q: Question): Promise<void> {
  const { error } = await supabase
    .from('questions')
    .update(questionToRow(q))
    .eq('id', q.id);
  if (error) throw new Error(`Supabase update failed: ${error.message} (code: ${error.code})`);
  invalidateSessionCache();
}

export async function deleteQuestionFromSupabase(id: string): Promise<void> {
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) throw new Error(`Supabase delete failed: ${error.message} (code: ${error.code})`);
  invalidateSessionCache();
}

export async function clearAllQuestionsFromSupabase(): Promise<void> {
  const { error } = await supabase.from('questions').delete().neq('id', '');
  if (error) throw new Error(`Supabase clear failed: ${error.message} (code: ${error.code})`);
  invalidateSessionCache();
}

/** Verify upload: returns count of rows matching source+part in Supabase */
export async function verifyUploadInSupabase(source: string, part: string): Promise<number> {
  const { count, error } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('source', source)
    .eq('part', part);
  if (error) throw new Error(`Verify failed: ${error.message}`);
  return count ?? 0;
}

/** Get Supabase total count (fast, head only) */
export async function getSupabaseTotalCount(): Promise<number> {
  const { count, error } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true });
  if (error) return -1;
  return count ?? 0;
}

/**
 * Check if the `source` column exists in the questions table.
 * Returns false if PGRST204 (column not in schema cache) is returned.
 */
export async function checkSourceColumnExists(): Promise<boolean> {
  const { error } = await supabase.from('questions').select('source').limit(1);
  if (!error) return true;
  return error.code !== 'PGRST204';
}

/**
 * Patch all rows that have NULL source → set to 'MRCP'.
 * Returns the number of rows updated.
 */
export async function patchNullSourcesToMRCP(): Promise<number> {
  const { data, error } = await supabase
    .from('questions')
    .update({ source: 'MRCP' })
    .is('source', null)
    .select('id');
  if (error) throw new Error(`Patch failed: ${error.message} (code: ${error.code})`);
  invalidateSessionCache();
  return data?.length ?? 0;
}

export async function bulkReassignSystem(
  fromSystem: string,
  toSystem: string,
  part?: 'Part 1' | 'Part 2',
  source?: string,
): Promise<number> {
  let query = supabase
    .from('questions')
    .update({ system: toSystem })
    .eq('system', fromSystem);
  if (part) query = query.eq('part', part);
  if (source) query = query.eq('source', source);
  const { data, error } = await query.select('id');
  if (error) throw new Error(`Reassign failed: ${error.message}`);
  invalidateSessionCache();
  return data?.length ?? 0;
}

const QUESTIONS_KEY = 'mrcp_questions_v3';
const STATS_KEY_PREFIX = 'mrcp_stats';
const ANSWERED_KEY_PREFIX = 'mrcp_answered';
const SESSIONS_KEY = 'mrcp_sessions';
const AUTH_SESSION_KEY = 'mrcp_auth_session'; // mirrors authStore.SESSION_KEY

// ── Current-user scoping ───────────────────────────────────
// Stats and answered-question history are namespaced by user id so
// multiple users on the same browser don't share progress, and the
// quiz sampler can exclude already-answered questions per user.
let _currentUserId: string | null = (() => {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? (JSON.parse(raw)?.id ?? null) : null;
  } catch {
    return null;
  }
})();

export function setCurrentUserId(id: string | null): void {
  _currentUserId = id;
}

function userKey(prefix: string): string {
  return `${prefix}:${_currentUserId ?? 'anon'}`;
}

// ── Questions ──────────────────────────────────────────────
export function getQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(QUESTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveQuestions(questions: Question[]): void {
  try {
    localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
  } catch {
    // localStorage quota exceeded — questions are stored in Supabase, skip local cache
    localStorage.removeItem(QUESTIONS_KEY);
  }
}

export function addQuestion(q: Question): void {
  const questions = getQuestions();
  questions.push(q);
  saveQuestions(questions);
}

export function addQuestions(qs: Question[]): void {
  const existing = getQuestions();
  const merged = [...existing, ...qs];
  saveQuestions(merged);
}

export function deleteQuestion(id: string): void {
  const questions = getQuestions().filter((q) => q.id !== id);
  saveQuestions(questions);
}

export function updateQuestion(updated: Question): void {
  const questions = getQuestions().map((q) => (q.id === updated.id ? updated : q));
  saveQuestions(questions);
}

// ── Stats ──────────────────────────────────────────────────
export function getStats(): UserStats {
  try {
    const raw = localStorage.getItem(userKey(STATS_KEY_PREFIX));
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return emptyStats();
  }
}

// ── Answered-question history (per user) ───────────────────
// Tracks question IDs the current user has answered in any finished
// session, so quiz sampling can exclude them and avoid repeats.
export function getAnsweredQuestionIds(): Set<string> {
  try {
    const raw = localStorage.getItem(userKey(ANSWERED_KEY_PREFIX));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveAnsweredQuestionIds(ids: Set<string>): void {
  try {
    localStorage.setItem(userKey(ANSWERED_KEY_PREFIX), JSON.stringify(Array.from(ids)));
  } catch {
    // quota exceeded — drop silently
  }
}

export function addAnsweredQuestionIds(ids: string[]): void {
  if (ids.length === 0) return;
  const set = getAnsweredQuestionIds();
  ids.forEach((id) => set.add(id));
  saveAnsweredQuestionIds(set);
}

export function resetAnsweredQuestionIds(): void {
  localStorage.removeItem(userKey(ANSWERED_KEY_PREFIX));
}

function emptyStats(): UserStats {
  return {
    totalAttempted: 0,
    totalCorrect: 0,
    bySystem: {},
    byDifficulty: {},
    history: [],
  };
}

export function recordSession(session: QuizSession): void {
  const stats = getStats();
  let correct = 0;
  const systemSet = new Set<string>();
  const answeredIds: string[] = [];

  session.questions.forEach((q) => {
    const chosen = session.answers[q.id];
    if (!chosen) return;
    answeredIds.push(q.id);
    const isCorrect = chosen === q.correctAnswer;
    if (isCorrect) correct++;

    stats.totalAttempted++;
    if (isCorrect) stats.totalCorrect++;

    // by system
    if (!stats.bySystem[q.system]) stats.bySystem[q.system] = { attempted: 0, correct: 0 };
    stats.bySystem[q.system].attempted++;
    if (isCorrect) stats.bySystem[q.system].correct++;

    // by difficulty
    if (!stats.byDifficulty[q.difficulty]) stats.byDifficulty[q.difficulty] = { attempted: 0, correct: 0 };
    stats.byDifficulty[q.difficulty].attempted++;
    if (isCorrect) stats.byDifficulty[q.difficulty].correct++;

    systemSet.add(q.system);
  });

  const systems = Array.from(systemSet).join(', ');
  const part = session.questions[0]?.part ?? 'Part 1';
  // Determine predominant source
  const sources = session.questions.map((q) => q.source ?? 'Custom');
  const sourceCounts = sources.reduce<Record<string, number>>((acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; }, {});
  const source = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Custom';
  stats.history.unshift({
    sessionId: session.id,
    date: new Date().toISOString(),
    score: correct,
    total: session.questions.length,
    system: systems,
    mode: session.mode,
    part,
    source,
  });

  // Keep last 50 history entries
  stats.history = stats.history.slice(0, 50);
  localStorage.setItem(userKey(STATS_KEY_PREFIX), JSON.stringify(stats));

  // Persist answered-question history so future batches skip these
  addAnsweredQuestionIds(answeredIds);
}

// ── Sessions ───────────────────────────────────────────────
export function saveSession(session: QuizSession): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  const plain = { ...session, flagged: Array.from(session.flagged) };
  if (idx >= 0) sessions[idx] = plain as any;
  else sessions.push(plain as any);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(-20)));
}

export function getSessions(): any[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearAllData(): void {
  localStorage.removeItem(QUESTIONS_KEY);
  localStorage.removeItem(SESSIONS_KEY);
  // Clear all per-user stats and answered-question history
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(`${STATS_KEY_PREFIX}:`) || k.startsWith(`${ANSWERED_KEY_PREFIX}:`)) {
      localStorage.removeItem(k);
    }
  }
}

// ── Default seed questions ─────────────────────────────────
const defaultQuestions: Question[] = [
  // ═══════════════ MRCP PART 1 ═══════════════
  {
    id: 'p1_q001',
    part: 'Part 1',
    system: 'Cardiology',
    topic: 'Heart Failure',
    year: '2022',
    difficulty: 'Medium',
    stem: 'A 68-year-old man presents with progressive breathlessness on exertion and bilateral ankle oedema. His JVP is elevated at 6 cm above the sternal angle. Chest X-ray shows cardiomegaly and upper lobe diversion. Echocardiography reveals an ejection fraction of 32%. Which medication has been shown to reduce mortality in this condition?',
    options: [
      { id: 'A', text: 'Digoxin' },
      { id: 'B', text: 'Furosemide' },
      { id: 'C', text: 'Carvedilol' },
      { id: 'D', text: 'Amlodipine' },
      { id: 'E', text: 'Isosorbide mononitrate' },
    ],
    correctAnswer: 'C',
    explanation:
      'Beta-blockers such as carvedilol have been shown in multiple large RCTs (COPERNICUS, MERIT-HF) to reduce mortality in heart failure with reduced ejection fraction (HFrEF). Digoxin reduces hospitalisations but not mortality. Furosemide relieves symptoms. Amlodipine and long-acting nitrates do not reduce mortality in HFrEF.',
    reference: 'ESC Heart Failure Guidelines 2021',
    tags: ['HFrEF', 'Beta-blocker', 'Mortality'],
  },
  {
    id: 'p1_q002',
    part: 'Part 1',
    system: 'Cardiology',
    topic: 'Arrhythmias',
    year: '2021',
    difficulty: 'Hard',
    stem: 'A 55-year-old woman presents with palpitations and pre-syncope. ECG shows a delta wave and short PR interval. She subsequently develops AF with a ventricular rate of 220 bpm. What is the most appropriate immediate management?',
    options: [
      { id: 'A', text: 'IV digoxin' },
      { id: 'B', text: 'IV adenosine' },
      { id: 'C', text: 'IV verapamil' },
      { id: 'D', text: 'IV flecainide' },
      { id: 'E', text: 'DC cardioversion' },
    ],
    correctAnswer: 'E',
    explanation:
      'This patient has Wolff-Parkinson-White (WPW) syndrome presenting with pre-excited AF. AV nodal blocking agents (digoxin, adenosine, verapamil, beta-blockers) are CONTRAINDICATED as they may accelerate conduction via the accessory pathway leading to VF. DC cardioversion is the safest option in a haemodynamically compromised patient.',
    reference: 'MRCP UK Past Paper 2021, NICE CG180',
    tags: ['WPW', 'Pre-excited AF', 'Cardioversion'],
  },
  {
    id: 'p1_q003',
    part: 'Part 1',
    system: 'Respiratory',
    topic: 'COPD',
    year: '2022',
    difficulty: 'Easy',
    stem: 'A 70-year-old smoker with known COPD is admitted with an acute exacerbation. His ABG on air shows: pH 7.28, PaO2 5.8 kPa, PaCO2 9.2 kPa, HCO3 32 mmol/L. What is the most appropriate initial oxygen target?',
    options: [
      { id: 'A', text: 'SpO2 98–100%' },
      { id: 'B', text: 'SpO2 94–98%' },
      { id: 'C', text: 'SpO2 88–92%' },
      { id: 'D', text: 'SpO2 85–88%' },
      { id: 'E', text: 'No supplemental oxygen' },
    ],
    correctAnswer: 'C',
    explanation:
      'In COPD patients with known or suspected hypercapnia, the target SpO2 is 88–92% to avoid suppressing the hypoxic respiratory drive. This patient has type 2 respiratory failure (raised CO2, compensatory raised HCO3, acidotic pH). BTS guidelines recommend 24–28% Venturi mask with target 88–92%.',
    reference: 'BTS COPD Guidelines, BTS Emergency Oxygen Guidelines',
    tags: ['COPD', 'Oxygen therapy', 'Type 2 RF'],
  },
  {
    id: 'p1_q004',
    part: 'Part 1',
    system: 'Gastroenterology',
    topic: 'Liver Disease',
    year: '2023',
    difficulty: 'Medium',
    stem: 'A 45-year-old man with known alcoholic cirrhosis presents with confusion, asterixis, and fetor hepaticus. His serum ammonia is elevated. Ascitic tap shows neutrophils > 250 cells/mm³. Which antibiotic is MOST appropriate?',
    options: [
      { id: 'A', text: 'IV co-amoxiclav' },
      { id: 'B', text: 'Oral ciprofloxacin' },
      { id: 'C', text: 'IV cefotaxime' },
      { id: 'D', text: 'IV vancomycin' },
      { id: 'E', text: 'Oral metronidazole' },
    ],
    correctAnswer: 'C',
    explanation:
      'Spontaneous bacterial peritonitis (SBP) is diagnosed when ascitic fluid neutrophil count exceeds 250 cells/mm³. IV cefotaxime (or oral ofloxacin if uncomplicated) is the first-line treatment. IV albumin should also be given to prevent hepatorenal syndrome.',
    reference: 'EASL Guidelines on Cirrhosis, BSG Liver Guidelines',
    tags: ['SBP', 'Cirrhosis', 'Hepatic encephalopathy'],
  },
  {
    id: 'p1_q005',
    part: 'Part 1',
    system: 'Nephrology',
    topic: 'AKI',
    year: '2022',
    difficulty: 'Medium',
    stem: 'A 72-year-old woman is started on ramipril for hypertension. Two weeks later her creatinine rises from 85 to 190 µmol/L (>50% rise). She takes regular NSAIDs for arthritis. Renal ultrasound shows bilateral small kidneys with increased echogenicity. What is the most likely diagnosis?',
    options: [
      { id: 'A', text: 'Acute tubular necrosis' },
      { id: 'B', text: 'Renal artery stenosis' },
      { id: 'C', text: 'IgA nephropathy' },
      { id: 'D', text: 'Hypertensive nephrosclerosis' },
      { id: 'E', text: 'Myeloma kidney' },
    ],
    correctAnswer: 'B',
    explanation:
      'A >50% rise in creatinine after starting an ACE inhibitor strongly suggests bilateral renal artery stenosis. ACEi reduces angiotensin II-mediated efferent arteriolar constriction, dropping intraglomerular pressure and GFR. NSAIDs worsen this by reducing prostaglandin-mediated afferent dilation. Small kidneys suggest chronic renovascular disease.',
    reference: 'NICE CKD Guidelines, MRCP Past Paper',
    tags: ['ACEi', 'Renovascular disease', 'AKI'],
  },
  {
    id: 'p1_q006',
    part: 'Part 1',
    system: 'Neurology',
    topic: 'Stroke',
    year: '2021',
    difficulty: 'Hard',
    stem: 'A 60-year-old man presents 2.5 hours after sudden onset left-sided weakness and dysphasia. CT brain shows no haemorrhage. His BP is 185/100 mmHg. INR is 1.0. He has no contraindications to thrombolysis. What is the most appropriate next step?',
    options: [
      { id: 'A', text: 'Aspirin 300 mg immediately' },
      { id: 'B', text: 'Lower BP to <140 mmHg before any treatment' },
      { id: 'C', text: 'IV alteplase 0.9 mg/kg' },
      { id: 'D', text: 'Mechanical thrombectomy only' },
      { id: 'E', text: 'Warfarin loading dose' },
    ],
    correctAnswer: 'C',
    explanation:
      'IV alteplase (0.9 mg/kg, max 90 mg) is indicated in ischaemic stroke within 4.5 hours if no contraindications. CT showing no haemorrhage is the key requirement. Aspirin is given 24 hours after thrombolysis.',
    reference: 'RCP Stroke Guidelines 2023, ESO Guidelines',
    tags: ['Stroke', 'Thrombolysis', 'Alteplase'],
  },
  {
    id: 'p1_q007',
    part: 'Part 1',
    system: 'Endocrinology',
    topic: 'Diabetes',
    year: '2023',
    difficulty: 'Easy',
    stem: 'A 35-year-old woman with Type 1 DM presents with vomiting, polyuria, and confusion. Glucose is 28 mmol/L, pH 7.15, bicarbonate 10 mmol/L, ketones 4.5 mmol/L. What is the most important initial treatment?',
    options: [
      { id: 'A', text: 'IV sodium bicarbonate' },
      { id: 'B', text: 'IV insulin bolus 10 units' },
      { id: 'C', text: 'IV 0.9% saline 1L over 1 hour' },
      { id: 'D', text: 'Subcutaneous insulin correction dose' },
      { id: 'E', text: 'IV dextrose 10%' },
    ],
    correctAnswer: 'C',
    explanation:
      'DKA management priority: 1) IV fluid resuscitation with 0.9% saline. 2) Potassium replacement. 3) Fixed-rate IV insulin infusion at 0.1 units/kg/hr. IV bolus insulin is no longer recommended. Bicarbonate is not routinely used (pH >6.9).',
    reference: 'JBDS DKA Guidelines 2021',
    tags: ['DKA', 'Type 1 DM', 'Fluid resuscitation'],
  },
  {
    id: 'p1_q008',
    part: 'Part 1',
    system: 'Haematology',
    topic: 'Anaemia',
    year: '2022',
    difficulty: 'Medium',
    stem: 'A 28-year-old African man presents with severe anaemia (Hb 6.2 g/dL), jaundice, and splenomegaly 2 days after starting primaquine. Blood film shows bite cells and Heinz bodies. What is the underlying defect?',
    options: [
      { id: 'A', text: 'Pyruvate kinase deficiency' },
      { id: 'B', text: 'G6PD deficiency' },
      { id: 'C', text: 'Hereditary spherocytosis' },
      { id: 'D', text: 'HbS/HbC disease' },
      { id: 'E', text: 'Autoimmune haemolytic anaemia' },
    ],
    correctAnswer: 'B',
    explanation:
      'G6PD deficiency is an X-linked condition common in African and Mediterranean populations. G6PD is needed to maintain glutathione to protect RBCs from oxidative stress. Oxidative drugs (primaquine, dapsone, nitrofurantoin) trigger haemolysis. Bite cells result from splenic removal of Heinz bodies (denatured Hb).',
    reference: 'Kumar & Clark Clinical Medicine, BSH Guidelines',
    tags: ['G6PD', 'Haemolytic anaemia', 'Primaquine'],
  },
  {
    id: 'p1_q009',
    part: 'Part 1',
    system: 'Rheumatology',
    topic: 'Connective Tissue Disease',
    year: '2021',
    difficulty: 'Medium',
    stem: 'A 32-year-old woman presents with a butterfly rash, arthralgia, pleuritis, and photosensitivity. ANA is positive (1:640). Anti-dsDNA is elevated. C3 and C4 are low. Urinalysis shows red cell casts. What is the most serious complication?',
    options: [
      { id: 'A', text: 'Pulmonary hypertension' },
      { id: 'B', text: 'Lupus nephritis' },
      { id: 'C', text: 'Libman-Sacks endocarditis' },
      { id: 'D', text: 'CNS lupus' },
      { id: 'E', text: 'Antiphospholipid syndrome' },
    ],
    correctAnswer: 'B',
    explanation:
      'This patient has SLE with evidence of lupus nephritis (red cell casts, anti-dsDNA, low complement). Red cell casts indicate glomerular inflammation. Lupus nephritis is the most common cause of morbidity and mortality in SLE. Renal biopsy is required for classification. Class III/IV requires MMF or cyclophosphamide plus steroids.',
    reference: 'ACR/EULAR SLE Classification Criteria 2019, BSR SLE Guidelines',
    tags: ['SLE', 'Lupus nephritis', 'Red cell casts'],
  },
  {
    id: 'p1_q010',
    part: 'Part 1',
    system: 'Infectious Diseases',
    topic: 'Meningitis',
    year: '2023',
    difficulty: 'Hard',
    stem: 'A 19-year-old student presents with fever (39.8°C), neck stiffness, photophobia, and a non-blanching petechial rash. He is drowsy (GCS 13). He has no focal neurology. What is the most appropriate FIRST action?',
    options: [
      { id: 'A', text: 'CT head then LP' },
      { id: 'B', text: 'Blood cultures then IV ceftriaxone 2g immediately' },
      { id: 'C', text: 'IV ceftriaxone 2g immediately without delay' },
      { id: 'D', text: 'LP immediately before antibiotics' },
      { id: 'E', text: 'IV aciclovir and observe' },
    ],
    correctAnswer: 'C',
    explanation:
      'The non-blanching rash suggests meningococcal septicaemia. Treatment must NOT be delayed. IV ceftriaxone 2g should be given IMMEDIATELY. Blood cultures should ideally be taken simultaneously but must not delay antibiotics. Dexamethasone should also be given if bacterial meningitis is likely.',
    reference: 'NICE Guideline NG51: Meningitis and Meningococcal Septicaemia',
    tags: ['Meningococcal', 'Septicaemia', 'Ceftriaxone'],
  },
  {
    id: 'p1_q011',
    part: 'Part 1',
    system: 'Biostatistics',
    topic: 'Study Design',
    year: '2022',
    difficulty: 'Medium',
    stem: 'A new diagnostic test for tuberculosis is evaluated in 200 patients. 50 have confirmed TB (by gold standard) and 150 do not. The test is positive in 45 of the 50 with TB and in 15 of the 150 without TB. What is the specificity of this test?',
    options: [
      { id: 'A', text: '75%' },
      { id: 'B', text: '80%' },
      { id: 'C', text: '90%' },
      { id: 'D', text: '95%' },
      { id: 'E', text: '99%' },
    ],
    correctAnswer: 'C',
    explanation:
      'Specificity = True Negatives / (True Negatives + False Positives) = TN / (TN + FP). Those without TB = 150. Test negative in those without TB (TN) = 150 - 15 = 135. Test positive in those without TB (FP) = 15. Specificity = 135 / (135 + 15) = 135/150 = 0.90 = 90%. Sensitivity = TP/(TP+FN) = 45/50 = 90% here too. PPV = 45/(45+15) = 75%. NPV = 135/(135+5) = 96.4%.',
    reference: 'MRCP Biostatistics, Evidence-Based Medicine',
    tags: ['Specificity', 'Sensitivity', 'Diagnostic test'],
  },
  {
    id: 'p1_q012',
    part: 'Part 1',
    system: 'Biostatistics',
    topic: 'Clinical Trials',
    year: '2023',
    difficulty: 'Hard',
    stem: 'A randomised controlled trial of a new drug for MI shows: event rate in treatment group = 8%, event rate in placebo group = 10%. Calculate the Number Needed to Treat (NNT).',
    options: [
      { id: 'A', text: '2' },
      { id: 'B', text: '5' },
      { id: 'C', text: '20' },
      { id: 'D', text: '50' },
      { id: 'E', text: '100' },
    ],
    correctAnswer: 'D',
    explanation:
      'Absolute Risk Reduction (ARR) = Control event rate - Treatment event rate = 10% - 8% = 2% = 0.02. NNT = 1/ARR = 1/0.02 = 50. Relative Risk Reduction (RRR) = ARR/Control rate = 2%/10% = 20%. NNT of 50 means you need to treat 50 patients to prevent 1 additional event compared to placebo.',
    reference: 'Evidence-Based Medicine: NNT, ARR, RRR',
    tags: ['NNT', 'ARR', 'Clinical trial'],
  },
  {
    id: 'p1_q013',
    part: 'Part 1',
    system: 'Geriatrics',
    topic: 'Falls Assessment',
    year: '2022',
    difficulty: 'Easy',
    stem: 'An 82-year-old woman is referred following her third fall in six months. She is on amlodipine, bendroflumethiazide, temazepam, and metformin. Examination reveals postural hypotension (drop >20 mmHg systolic on standing). Which medication is MOST likely contributing to her falls?',
    options: [
      { id: 'A', text: 'Metformin' },
      { id: 'B', text: 'Amlodipine' },
      { id: 'C', text: 'Temazepam' },
      { id: 'D', text: 'Bendroflumethiazide' },
      { id: 'E', text: 'All equally contribute' },
    ],
    correctAnswer: 'C',
    explanation:
      'Benzodiazepines like temazepam are the most significant pharmacological risk factor for falls in the elderly. They cause sedation, impair balance, slow reaction time, and contribute to confusion. While antihypertensives (amlodipine, bendroflumethiazide) can cause postural hypotension and also contribute to falls, benzodiazepines have the strongest independent association with fall risk. NICE recommends reviewing and withdrawing psychotropic medications in falls prevention.',
    reference: 'NICE CG161: Falls in older people',
    tags: ['Falls', 'Benzodiazepine', 'Polypharmacy', 'Elderly'],
  },
  {
    id: 'p1_q014',
    part: 'Part 1',
    system: 'Geriatrics',
    topic: 'Dementia',
    year: '2021',
    difficulty: 'Medium',
    stem: 'A 78-year-old man is brought by his daughter with a 2-year history of progressive memory loss, word-finding difficulties, and getting lost in familiar places. He scores 19/30 on MMSE. He has no vascular risk factors. MRI brain shows hippocampal and parietal atrophy. What is the most likely diagnosis?',
    options: [
      { id: 'A', text: 'Vascular dementia' },
      { id: 'B', text: "Lewy body dementia" },
      { id: 'C', text: "Alzheimer's disease" },
      { id: 'D', text: 'Frontotemporal dementia' },
      { id: 'E', text: 'Normal pressure hydrocephalus' },
    ],
    correctAnswer: 'C',
    explanation:
      "Alzheimer's disease is the most common cause of dementia. It presents with insidious onset, progressive episodic memory loss, followed by language, visuospatial, and executive difficulties. MRI typically shows hippocampal and parietal atrophy. Lewy body dementia features fluctuating cognition, visual hallucinations, and parkinsonism. Vascular dementia has stepwise progression and vascular risk factors. Frontotemporal dementia typically presents at younger age with personality/behaviour changes.",
    reference: 'NICE NG97: Dementia',
    tags: ["Alzheimer's", 'Dementia', 'Hippocampal atrophy', 'MMSE'],
  },
  {
    id: 'p1_q015',
    part: 'Part 1',
    system: 'Dermatology',
    topic: 'Skin Lesions',
    year: '2022',
    difficulty: 'Medium',
    stem: 'A 45-year-old man presents with a violaceous, flat-topped papular rash on his wrists and ankles. He also has lacy white patches on his buccal mucosa. He was recently started on a new medication. Which of the following drugs is most likely responsible?',
    options: [
      { id: 'A', text: 'Amlodipine' },
      { id: 'B', text: 'Beta-blocker (propranolol)' },
      { id: 'C', text: 'Hydroxychloroquine' },
      { id: 'D', text: 'Gold therapy' },
      { id: 'E', text: 'Penicillamine' },
    ],
    correctAnswer: 'D',
    explanation:
      'This presentation is consistent with lichen planus — characterised by the 6 Ps: Pruritic, Planar (flat-topped), Purple, Polygonal Papules, with Wickham\'s striae on oral mucosa. Drug-induced lichen planus (lichenoid drug reaction) is caused by gold, penicillamine, beta-blockers, antimalarials, thiazides, and ACE inhibitors. However, gold is the classic MRCP answer for lichenoid drug reactions. The oral Wickham\'s striae are pathognomonic.',
    reference: 'MRCP Dermatology, Kumar & Clark',
    tags: ['Lichen planus', 'Drug-induced', 'Gold therapy'],
  },
  {
    id: 'p1_q016',
    part: 'Part 1',
    system: 'Pharmacology',
    topic: 'Drug Interactions',
    year: '2023',
    difficulty: 'Medium',
    stem: 'A 65-year-old man with atrial fibrillation on warfarin (INR 2.5) is prescribed a new medication and returns 2 weeks later with an INR of 5.8 and haematuria. Which drug is most likely responsible?',
    options: [
      { id: 'A', text: 'Antacid (magnesium hydroxide)' },
      { id: 'B', text: 'Amiodarone' },
      { id: 'C', text: 'Rifampicin' },
      { id: 'D', text: 'Carbamazepine' },
      { id: 'E', text: 'St John\'s Wort' },
    ],
    correctAnswer: 'B',
    explanation:
      'Amiodarone potently inhibits CYP2C9 (the main enzyme metabolising warfarin) and also inhibits CYP3A4, dramatically increasing warfarin levels and INR. This is one of the most important drug interactions in clinical practice. Rifampicin, carbamazepine, and St John\'s Wort are all CYP inducers that would DECREASE INR. Amiodarone can also cause hypothyroidism which further increases warfarin sensitivity.',
    reference: 'BNF, MRCP Pharmacology',
    tags: ['Warfarin', 'Amiodarone', 'CYP2C9', 'Drug interaction'],
  },
  {
    id: 'p1_q017',
    part: 'Part 1',
    system: 'Clinical Sciences',
    topic: 'Immunology',
    year: '2022',
    difficulty: 'Hard',
    stem: 'A 25-year-old man presents with recurrent Neisseria infections (meningococcal meningitis at age 18, now gonorrhoea). Blood tests show normal immunoglobulins and neutrophil count. Which complement deficiency is most likely?',
    options: [
      { id: 'A', text: 'C1q deficiency' },
      { id: 'B', text: 'C3 deficiency' },
      { id: 'C', text: 'C5–C9 (terminal complement) deficiency' },
      { id: 'D', text: 'Factor B deficiency' },
      { id: 'E', text: 'Mannose-binding lectin deficiency' },
    ],
    correctAnswer: 'C',
    explanation:
      'The terminal complement components (C5–C9) form the membrane attack complex (MAC) that is essential for lysis of Neisseria species (N. meningitidis and N. gonorrhoeae). Deficiency of terminal complement leads to recurrent Neisseria infections. C3 deficiency causes susceptibility to encapsulated organisms broadly. C1q deficiency is associated with SLE-like illness. This pattern of recurrent Neisseria is the classic MRCP pointer to terminal complement deficiency.',
    reference: 'Kumar & Clark Immunology, MRCP Past Papers',
    tags: ['Complement deficiency', 'Neisseria', 'MAC', 'C5-C9'],
  },
  {
    id: 'p1_q018',
    part: 'Part 1',
    system: 'Psychiatry',
    topic: 'Psychosis',
    year: '2023',
    difficulty: 'Medium',
    stem: 'A 24-year-old man presents with auditory hallucinations, believing his thoughts are being broadcast on TV (thought broadcasting), and a 6-month history of social withdrawal. He has no mood symptoms. Which diagnosis best fits?',
    options: [
      { id: 'A', text: 'Bipolar disorder, manic phase' },
      { id: 'B', text: 'Schizophrenia' },
      { id: 'C', text: 'Brief psychotic disorder' },
      { id: 'D', text: 'Schizoaffective disorder' },
      { id: 'E', text: 'Drug-induced psychosis' },
    ],
    correctAnswer: 'B',
    explanation:
      'Schizophrenia requires at least 2 of: delusions, hallucinations, disorganised speech, negative symptoms — for ≥6 months with functional decline. Thought broadcasting is a Schneiderian first-rank symptom of schizophrenia. The 6-month duration with no mood component rules out brief psychotic disorder (<1 month) and schizoaffective disorder (which requires concurrent mood episodes). Bipolar disorder would have prominent mood features.',
    reference: 'DSM-5, ICD-11, MRCP Psychiatry',
    tags: ['Schizophrenia', 'First-rank symptoms', 'Thought broadcasting'],
  },
  // ═══════════════ MRCP PART 2 ═══════════════
  {
    id: 'p2_q001',
    part: 'Part 2',
    system: 'Cardiology',
    topic: 'Acute Coronary Syndrome',
    year: '2022',
    difficulty: 'Hard',
    stem: 'A 58-year-old man is admitted with NSTEMI. He has a history of peptic ulcer disease and is allergic to aspirin (anaphylaxis). Coronary angiography shows 3-vessel disease and he is referred for CABG. Which antiplatelet regimen is most appropriate preoperatively?',
    options: [
      { id: 'A', text: 'Clopidogrel alone' },
      { id: 'B', text: 'Ticagrelor alone' },
      { id: 'C', text: 'Prasugrel alone' },
      { id: 'D', text: 'Desensitise to aspirin then dual antiplatelet' },
      { id: 'E', text: 'Ticagrelor + PPI' },
    ],
    correctAnswer: 'A',
    explanation:
      'In true aspirin allergy (anaphylaxis), aspirin desensitisation can be performed in specialist centres but is not routine preoperatively. For CABG patients, clopidogrel is preferred over ticagrelor or prasugrel as it is stopped 5 days pre-CABG (ticagrelor 3–5 days, prasugrel 7 days). In aspirin allergy with CABG planned, clopidogrel monotherapy is the practical choice. The PPI does not address the allergy. Prasugrel is contraindicated in prior stroke/TIA.',
    reference: 'ESC NSTE-ACS Guidelines 2020, NICE CG94',
    tags: ['NSTEMI', 'Aspirin allergy', 'CABG', 'Antiplatelet'],
  },
  {
    id: 'p2_q002',
    part: 'Part 2',
    system: 'Respiratory',
    topic: 'Interstitial Lung Disease',
    year: '2023',
    difficulty: 'Hard',
    stem: 'A 62-year-old non-smoker presents with 18 months of progressive dyspnoea and dry cough. HRCT shows bilateral basal predominant reticular shadowing with honeycombing and traction bronchiectasis. Pulmonary function shows a restrictive pattern with reduced DLCO. Bronchoalveolar lavage shows neutrophil predominance. What is the diagnosis?',
    options: [
      { id: 'A', text: 'Cryptogenic organising pneumonia (COP)' },
      { id: 'B', text: 'Non-specific interstitial pneumonia (NSIP)' },
      { id: 'C', text: 'Idiopathic pulmonary fibrosis (IPF)' },
      { id: 'D', text: 'Hypersensitivity pneumonitis' },
      { id: 'E', text: 'Respiratory bronchiolitis ILD' },
    ],
    correctAnswer: 'C',
    explanation:
      'IPF (Idiopathic Pulmonary Fibrosis) is the most common ILD. Diagnosis requires: usual interstitial pneumonia (UIP) pattern on HRCT (basal, subpleural reticular shadowing with honeycombing ± traction bronchiectasis), exclusion of other causes, restrictive PFTs with reduced DLCO. BAL in IPF shows neutrophil ± eosinophil predominance. NSIP has a more ground-glass pattern. COP has peribronchovascular distribution. IPF is treated with nintedanib or pirfenidone.',
    reference: 'ATS/ERS/JRS/ALAT IPF Guidelines 2022',
    tags: ['IPF', 'UIP pattern', 'Honeycombing', 'HRCT'],
  },
  {
    id: 'p2_q003',
    part: 'Part 2',
    system: 'Gastroenterology',
    topic: 'Inflammatory Bowel Disease',
    year: '2022',
    difficulty: 'Medium',
    stem: 'A 28-year-old woman with known Crohn\'s disease (ileocolonic) on azathioprine presents with a painful perianal fistula. Examination confirms a simple low perianal fistula with no abscess. She is in clinical remission. What is the next most appropriate step?',
    options: [
      { id: 'A', text: 'Increase azathioprine dose' },
      { id: 'B', text: 'Start infliximab' },
      { id: 'C', text: 'Surgical fistulotomy' },
      { id: 'D', text: 'Seton placement' },
      { id: 'E', text: 'MRI pelvis to characterise fistula' },
    ],
    correctAnswer: 'E',
    explanation:
      'Before treating any perianal Crohn\'s disease, full characterisation with MRI pelvis is essential to assess complexity, depth, and relationship to sphincters. This guides whether surgical or medical management (anti-TNF) is appropriate. Simple fistulotomy risks sphincter damage. Infliximab is highly effective for perianal Crohn\'s but should be preceded by MRI and surgical opinion. Seton placement is for complex/high fistulas. MRI first is the correct answer.',
    reference: 'ECCO Guidelines on Crohn\'s Disease, BSG IBD Guidelines',
    tags: ['Crohn\'s disease', 'Perianal fistula', 'MRI pelvis', 'Anti-TNF'],
  },
  {
    id: 'p2_q004',
    part: 'Part 2',
    system: 'Nephrology',
    topic: 'Glomerulonephritis',
    year: '2021',
    difficulty: 'Hard',
    stem: 'A 35-year-old man presents with haemoptysis and rapidly progressive glomerulonephritis. Urinalysis shows red cell casts. Serum creatinine is 480 µmol/L. ANCA is negative. Anti-GBM antibodies are strongly positive. CXR shows bilateral pulmonary infiltrates. What is the diagnosis?',
    options: [
      { id: 'A', text: 'Granulomatosis with polyangiitis (GPA)' },
      { id: 'B', text: 'Microscopic polyangiitis' },
      { id: 'C', text: 'Goodpasture\'s syndrome' },
      { id: 'D', text: 'IgA nephropathy' },
      { id: 'E', text: 'Systemic lupus erythematosus' },
    ],
    correctAnswer: 'C',
    explanation:
      'Goodpasture\'s syndrome (anti-GBM disease) presents with the classic pulmonary-renal syndrome: haemoptysis + rapidly progressive glomerulonephritis. Anti-GBM antibodies target type IV collagen in alveolar and glomerular basement membranes. ANCA is negative (unlike GPA/MPA where ANCA is positive). Treatment is urgent plasma exchange + cyclophosphamide + steroids. Renal prognosis is poor if creatinine >500 µmol/L.',
    reference: 'ERA-EDTA Guidelines, KDIGO GN Guidelines',
    tags: ['Anti-GBM', 'Goodpasture\'s', 'Pulmonary-renal syndrome', 'RPGN'],
  },
  {
    id: 'p2_q005',
    part: 'Part 2',
    system: 'Neurology',
    topic: 'Demyelinating Disease',
    year: '2023',
    difficulty: 'Medium',
    stem: 'A 29-year-old woman presents with a 5-day history of blurred vision in her left eye with periorbital pain worsening on eye movement. She had an episode of right leg weakness 18 months ago that resolved spontaneously. Visual acuity is 6/18 in the left eye. MRI brain shows periventricular white matter lesions. What is the most likely diagnosis?',
    options: [
      { id: 'A', text: 'Neuromyelitis optica' },
      { id: 'B', text: 'Acute disseminated encephalomyelitis (ADEM)' },
      { id: 'C', text: 'Multiple sclerosis (MS)' },
      { id: 'D', text: 'Vitamin B12 deficiency' },
      { id: 'E', text: 'CNS lymphoma' },
    ],
    correctAnswer: 'C',
    explanation:
      'This is classic relapsing-remitting multiple sclerosis (RRMS). Two distinct episodes separated in time (leg weakness 18 months ago, optic neuritis now) fulfil McDonald criteria for MS diagnosis (dissemination in time and space). Optic neuritis with periorbital pain worsening on movement is characteristic of MS. Periventricular lesions (Dawson\'s fingers pattern) are typical. NMO is more severe, aquaporin-4 Ab+, predominantly affects optic nerves and spinal cord.',
    reference: 'McDonald Criteria 2017, NICE MS Guidelines',
    tags: ['Multiple sclerosis', 'Optic neuritis', 'McDonald criteria', 'RRMS'],
  },
  {
    id: 'p2_q006',
    part: 'Part 2',
    system: 'Endocrinology',
    topic: 'Adrenal Disorders',
    year: '2022',
    difficulty: 'Hard',
    stem: 'A 45-year-old woman is referred with hypertension resistant to 3 medications, hypokalaemia (K+ 2.8 mmol/L), and metabolic alkalosis. Plasma aldosterone:renin ratio is markedly elevated. CT adrenals shows no lesion. What is the best next investigation?',
    options: [
      { id: 'A', text: 'Urinary catecholamines' },
      { id: 'B', text: 'Adrenal vein sampling' },
      { id: 'C', text: 'Dexamethasone suppression test' },
      { id: 'D', text: 'MRI adrenals' },
      { id: 'E', text: 'Genetic testing for glucocorticoid-remediable aldosteronism' },
    ],
    correctAnswer: 'B',
    explanation:
      'Primary hyperaldosteronism (Conn\'s syndrome) is confirmed by elevated aldosterone:renin ratio. CT may miss small adenomas. Adrenal vein sampling (AVS) is the gold standard to differentiate unilateral adenoma (surgical cure by adrenalectomy) from bilateral adrenal hyperplasia (treated medically with spironolactone/eplerenone). AVS should be done before any surgical decision. MRI offers no advantage over CT for adrenal lesions.',
    reference: 'Endocrine Society Guidelines: Primary Hyperaldosteronism',
    tags: ['Primary hyperaldosteronism', 'Adrenal vein sampling', 'Conn\'s syndrome'],
  },
  {
    id: 'p2_q007',
    part: 'Part 2',
    system: 'Rheumatology',
    topic: 'Vasculitis',
    year: '2022',
    difficulty: 'Medium',
    stem: 'A 70-year-old man presents with headache, jaw claudication, scalp tenderness, and proximal limb girdle stiffness. ESR is 98 mm/hr, CRP 85 mg/L. Visual acuity is normal. What is the immediate management to prevent blindness?',
    options: [
      { id: 'A', text: 'Await temporal artery biopsy result before treating' },
      { id: 'B', text: 'Prednisolone 40–60mg daily' },
      { id: 'C', text: 'IV methylprednisolone 1g for 3 days' },
      { id: 'D', text: 'Methotrexate and low-dose prednisolone' },
      { id: 'E', text: 'Aspirin and refer to ophthalmology' },
    ],
    correctAnswer: 'B',
    explanation:
      'Giant cell arteritis (GCA) + polymyalgia rheumatica (PMR) overlap. With visual symptoms threatened: start prednisolone 40–60mg IMMEDIATELY — do NOT await biopsy. The temporal artery biopsy should be arranged within 1–2 weeks (treatment does not significantly affect biopsy results in this window). IV methylprednisolone is reserved for visual loss or amaurosis fugax. Blindness is irreversible and occurs due to anterior ischaemic optic neuropathy from GCA.',
    reference: 'BSR GCA Guidelines 2020, ACR/EULAR GCA Criteria',
    tags: ['Giant cell arteritis', 'PMR', 'Prednisolone', 'Blindness prevention'],
  },
  {
    id: 'p2_q008',
    part: 'Part 2',
    system: 'Haematology',
    topic: 'Coagulation',
    year: '2023',
    difficulty: 'Hard',
    stem: 'A 35-year-old woman has a history of two unprovoked DVTs and a miscarriage at 16 weeks. She is on warfarin. Blood tests show: thrombocytopenia (platelet count 90), prolonged APTT, positive lupus anticoagulant, and positive anti-cardiolipin antibodies (IgG). What is the diagnosis?',
    options: [
      { id: 'A', text: 'Heparin-induced thrombocytopenia' },
      { id: 'B', text: 'Antiphospholipid syndrome' },
      { id: 'C', text: 'Disseminated intravascular coagulation' },
      { id: 'D', text: 'Von Willebrand disease type 2' },
      { id: 'E', text: 'Factor V Leiden deficiency' },
    ],
    correctAnswer: 'B',
    explanation:
      'Antiphospholipid Syndrome (APS) = Thrombosis (arterial/venous) OR pregnancy morbidity PLUS persistent antiphospholipid antibodies on ≥2 occasions 12 weeks apart. Antibodies include: lupus anticoagulant, anti-cardiolipin (IgG/IgM), anti-β2-glycoprotein-I. Paradoxically, lupus anticoagulant prolongs APTT in vitro but causes thrombosis in vivo. Thrombocytopenia occurs in APS. Treatment: lifelong anticoagulation with warfarin (INR 2–3, or 3–4 if recurrent). DOACs are generally less effective in APS.',
    reference: 'ISTH/ACR APS Classification Criteria 2023, BSH Guidelines',
    tags: ['Antiphospholipid syndrome', 'Lupus anticoagulant', 'Recurrent DVT', 'Miscarriage'],
  },
  {
    id: 'p2_q009',
    part: 'Part 2',
    system: 'Infectious Diseases',
    topic: 'HIV/AIDS',
    year: '2022',
    difficulty: 'Medium',
    stem: 'A 35-year-old HIV-positive man (not on ART, CD4 45 cells/µL) presents with headache, fever, and neck stiffness for 3 weeks. CSF opening pressure is 28 cmH2O. CSF India ink stain is positive. Cryptococcal antigen titre is 1:1024. What is the most appropriate treatment?',
    options: [
      { id: 'A', text: 'Fluconazole 400mg daily for 8 weeks' },
      { id: 'B', text: 'Liposomal amphotericin B + flucytosine for 2 weeks' },
      { id: 'C', text: 'IV aciclovir' },
      { id: 'D', text: 'Itraconazole for 12 weeks' },
      { id: 'E', text: 'Start ART immediately with fluconazole' },
    ],
    correctAnswer: 'B',
    explanation:
      'Cryptococcal meningitis in HIV: Induction phase = Liposomal amphotericin B (1 mg/kg/day) + flucytosine (25 mg/kg QDS) for 2 weeks. Consolidation = Fluconazole 400mg daily for 8 weeks. Maintenance = Fluconazole 200mg daily. ART should be DELAYED 4–6 weeks to avoid IRIS (Immune Reconstitution Inflammatory Syndrome). Raised ICP management with therapeutic LP is critical (target opening pressure <20 cmH2O). Fluconazole monotherapy alone is inferior for induction.',
    reference: 'BHIVA/BASHH HIV Guidelines, WHO Cryptococcal Meningitis Guidelines',
    tags: ['Cryptococcal meningitis', 'HIV', 'Amphotericin B', 'Flucytosine'],
  },
  {
    id: 'p2_q010',
    part: 'Part 2',
    system: 'Geriatrics',
    topic: 'Delirium',
    year: '2022',
    difficulty: 'Medium',
    stem: 'An 84-year-old woman is admitted following a hip fracture repair. On day 2 post-op she becomes acutely confused, agitated, and is pulling at her catheter. She was cognitively intact pre-operatively. Temperature 37.2°C, urine dip is positive. GCS 14. Which is the MOST important initial management step?',
    options: [
      { id: 'A', text: 'Start haloperidol 1mg TDS' },
      { id: 'B', text: 'Start lorazepam for agitation' },
      { id: 'C', text: 'Identify and treat the underlying cause' },
      { id: 'D', text: 'Physical restraint and sedation' },
      { id: 'E', text: 'CT head to exclude subdural haematoma' },
    ],
    correctAnswer: 'C',
    explanation:
      'Delirium in the elderly is characterised by acute onset, fluctuating confusion, inattention. The MOST important principle is to identify and treat the underlying cause (infection, pain, urinary retention, constipation, metabolic, medications). Antipsychotics (haloperidol) are only used as last resort for severe agitation/risk of harm. Benzodiazepines worsen delirium (except in alcohol withdrawal). Non-pharmacological approaches: reorientation, adequate lighting, hearing aids, mobilisation. NICE NG119 emphasises cause identification first.',
    reference: 'NICE NG119: Delirium, BSG Delirium Guidelines',
    tags: ['Delirium', 'Post-operative', 'Elderly', 'Non-pharmacological'],
  },
  {
    id: 'p2_q011',
    part: 'Part 2',
    system: 'Geriatrics',
    topic: 'Polypharmacy',
    year: '2023',
    difficulty: 'Medium',
    stem: 'An 88-year-old man with CKD stage 3, heart failure, and type 2 diabetes is admitted with worsening leg oedema and orthopnoea. His medications include furosemide 80mg OD, spironolactone, ramipril, metformin, and gliclazide. Creatinine is 210 µmol/L (eGFR 22). Which medication requires urgent review/dose adjustment or discontinuation?',
    options: [
      { id: 'A', text: 'Furosemide' },
      { id: 'B', text: 'Spironolactone' },
      { id: 'C', text: 'Metformin' },
      { id: 'D', text: 'Ramipril' },
      { id: 'E', text: 'Gliclazide' },
    ],
    correctAnswer: 'C',
    explanation:
      'Metformin is contraindicated when eGFR <30 mL/min/1.73m² (and should be used with caution with eGFR 30–45). This patient has eGFR of 22, so metformin must be stopped immediately due to risk of lactic acidosis. Spironolactone should also be reviewed (risk of hyperkalaemia with eGFR <30), but metformin is the priority here. MHRA guidance: stop metformin if eGFR <30, review if eGFR <45.',
    reference: 'MHRA Metformin Guidance, NICE Diabetes Guidelines NG28',
    tags: ['Metformin', 'CKD', 'Lactic acidosis', 'eGFR', 'Polypharmacy'],
  },
  {
    id: 'p2_q012',
    part: 'Part 2',
    system: 'Oncology',
    topic: 'Paraneoplastic Syndromes',
    year: '2021',
    difficulty: 'Hard',
    stem: 'A 62-year-old man presents with confusion, constipation, and polyuria. Calcium is 3.2 mmol/L. PTH is suppressed. PTHrP is elevated. Chest X-ray shows a hilar mass. What is the most likely diagnosis?',
    options: [
      { id: 'A', text: 'Primary hyperparathyroidism' },
      { id: 'B', text: 'Sarcoidosis' },
      { id: 'C', text: 'Squamous cell carcinoma of the lung' },
      { id: 'D', text: 'Small cell carcinoma of the lung' },
      { id: 'E', text: 'Myeloma' },
    ],
    correctAnswer: 'C',
    explanation:
      'Hypercalcaemia of malignancy mediated by PTHrP (PTH-related protein) is most commonly caused by squamous cell carcinoma (SCC) of the lung, head and neck, oesophagus, and renal cell carcinoma. PTH is suppressed (differentiating from primary HPT), and PTHrP mimics PTH action. Small cell carcinoma causes SIADH and ectopic ACTH, not typically PTHrP-mediated hypercalcaemia. Sarcoidosis causes hypercalcaemia via 1-alpha-hydroxylase activation, with elevated 1,25-OH vitamin D.',
    reference: 'MRCP Oncology, Kumar & Clark',
    tags: ['Hypercalcaemia', 'PTHrP', 'SCC lung', 'Paraneoplastic'],
  },

  // ── Image-Based Questions ───────────────────────────────────

  {
    id: 'img_q001',
    part: 'Part 1',
    system: 'Cardiology',
    topic: 'ECG — STEMI',
    year: '2023',
    difficulty: 'Medium',
    stem: 'A 67-year-old man presents to the Emergency Department with severe central chest pain radiating to his left arm, onset 45 minutes ago. He is diaphoretic and hypotensive (BP 90/60). His 12-lead ECG is shown. What is the single most appropriate immediate management?',
    options: [
      { id: 'A', text: 'IV morphine and reassess in 30 minutes' },
      { id: 'B', text: 'Activate the cardiac catheterisation lab for primary PCI' },
      { id: 'C', text: 'Administer IV thrombolysis immediately' },
      { id: 'D', text: 'Start IV heparin infusion and transfer to CCU' },
      { id: 'E', text: 'Perform echocardiogram to assess LV function' },
    ],
    correctAnswer: 'B',
    explanation:
      'The ECG shows ST elevation in leads V1–V4 with reciprocal ST depression in leads II, III, and aVF — consistent with an anterior STEMI due to left anterior descending (LAD) artery occlusion. The ESC/NICE guidelines recommend primary PCI (percutaneous coronary intervention) as the preferred reperfusion strategy when door-to-balloon time can be achieved within 120 minutes. Thrombolysis is only considered when PCI is not available within 120 minutes. Aspirin 300mg + ticagrelor 180mg loading, and anticoagulation should also be given immediately.',
    reference: 'ESC STEMI Guidelines 2023; NICE NG185',
    tags: ['ECG', 'STEMI', 'Primary PCI', 'LAD occlusion', 'Chest pain'],
    imageUrl: 'https://www.ncbi.nlm.nih.gov/books/NBK532281/bin/12_Lead_EKG_ST_Elevation_tracing_color_coded.jpg',
    imageType: 'ECG',
    imageCaption: '12-lead ECG — note ST elevation in V1–V4 with reciprocal changes inferiorly',
  },

  {
    id: 'img_q002',
    part: 'Part 1',
    system: 'Respiratory',
    topic: 'X-Ray — Pneumothorax',
    year: '2022',
    difficulty: 'Easy',
    stem: 'A 22-year-old tall, thin male presents with sudden onset right-sided pleuritic chest pain and dyspnoea. He is haemodynamically stable. His chest X-ray is shown. What is the most appropriate initial management?',
    options: [
      { id: 'A', text: 'High-flow oxygen and discharge with outpatient review' },
      { id: 'B', text: 'Needle aspiration of the right pleural space' },
      { id: 'C', text: 'Immediate intercostal chest drain insertion' },
      { id: 'D', text: 'IV antibiotics for community-acquired pneumonia' },
      { id: 'E', text: 'CT pulmonary angiography to exclude PE' },
    ],
    correctAnswer: 'B',
    explanation:
      'The chest X-ray shows a large right-sided pneumothorax with visible lung edge and absent lung markings peripherally. In a haemodynamically stable patient with a primary spontaneous pneumothorax >2cm (or symptomatic), BTS guidelines recommend needle aspiration (second intercostal space, mid-clavicular line) as the first-line treatment. If aspiration fails or the pneumothorax recurs, chest drain insertion is indicated. A tension pneumothorax (haemodynamically unstable with deviated trachea) would require immediate needle decompression without waiting for imaging.',
    reference: 'BTS Guidelines for Spontaneous Pneumothorax 2023',
    tags: ['Pneumothorax', 'Chest X-Ray', 'Needle aspiration', 'BTS Guidelines'],
    imageUrl: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/de37/558461/8591f4edc165/ocona239210.f1.jpg',
    imageType: 'X-Ray',
    imageCaption: 'PA Chest X-Ray — visible pleural edge with absent lung markings',
  },

  {
    id: 'img_q003',
    part: 'Part 1',
    system: 'Haematology',
    topic: 'Blood Film — Malaria',
    year: '2022',
    difficulty: 'Hard',
    stem: 'A 28-year-old woman returns from Ghana with a 3-day history of cyclical fever, rigors, headache, and myalgia. Temperature is 39.8°C. Haemoglobin is 9.2 g/dL, platelets 68 × 10⁹/L. A thick and thin blood film is performed. The peripheral blood film is shown. What is the causative organism most likely to cause cerebral malaria and organ failure?',
    options: [
      { id: 'A', text: 'Plasmodium vivax' },
      { id: 'B', text: 'Plasmodium ovale' },
      { id: 'C', text: 'Plasmodium malariae' },
      { id: 'D', text: 'Plasmodium falciparum' },
      { id: 'E', text: 'Plasmodium knowlesi' },
    ],
    correctAnswer: 'D',
    explanation:
      'Plasmodium falciparum is the most dangerous species of malaria, responsible for the majority of malaria-related deaths worldwide. It causes severe/complicated malaria including cerebral malaria, acute kidney injury, ARDS, and multi-organ failure. Blood film features include: ring forms only (no schizonts in peripheral blood), multiple rings per RBC, "appliqué/accolé" forms, banana-shaped gametocytes, and infected RBCs are not enlarged. Treatment is IV artesunate (preferred) or quinine + doxycycline. P. vivax and P. ovale cause enlarged RBCs with Schüffner dots.',
    reference: 'WHO Malaria Treatment Guidelines 2022; BNF',
    tags: ['Malaria', 'Blood Film', 'Plasmodium falciparum', 'Tropical Medicine', 'Returning traveller'],
    imageUrl: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/3470/10035268/3148a6ec9bba/12880_2023_993_Fig1_HTML.jpg',
    imageType: 'Blood Film',
    imageCaption: 'Peripheral blood film showing intraerythrocytic ring forms — thin film, Giemsa stain',
  },

  {
    id: 'img_q004',
    part: 'Part 2',
    system: 'Respiratory',
    topic: 'CT Thorax — Fibrosis',
    year: '2023',
    difficulty: 'Hard',
    stem: 'A 68-year-old retired carpenter presents with a 2-year history of progressive exertional dyspnoea and a non-productive cough. He has never smoked. Examination reveals bibasal fine end-inspiratory crackles and finger clubbing. PFTs show FVC 58% predicted, FEV1/FVC ratio 0.86, TLCO 42%. The HRCT thorax is shown. What is the most likely diagnosis?',
    options: [
      { id: 'A', text: 'Hypersensitivity pneumonitis' },
      { id: 'B', text: 'Non-specific interstitial pneumonia (NSIP)' },
      { id: 'C', text: 'Idiopathic pulmonary fibrosis (IPF)' },
      { id: 'D', text: 'Cryptogenic organising pneumonia (COP)' },
      { id: 'E', text: 'Sarcoidosis' },
    ],
    correctAnswer: 'C',
    explanation:
      'The HRCT shows a usual interstitial pneumonia (UIP) pattern: bilateral, basal, subpleural reticular opacities with honeycombing and traction bronchiectasis — the hallmark of IPF. IPF is the most common idiopathic interstitial pneumonia, typically affecting older males with a restrictive spirometry pattern and markedly reduced TLCO. The diagnosis requires exclusion of other causes of UIP (e.g. connective tissue disease, drug toxicity, hypersensitivity pneumonitis). Treatment options include pirfenidone or nintedanib (anti-fibrotics) which slow progression. Prognosis is poor with median survival 3–5 years.',
    reference: 'ATS/ERS/JRS/ALAT IPF Guidelines 2022; NICE TA379',
    tags: ['IPF', 'UIP pattern', 'HRCT', 'Restrictive', 'Interstitial lung disease', 'Honeycombing'],
    imageUrl: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/98dd/9487568/6471d4025551/err-23-132-215-f01.jpg',
    imageType: 'CT Scan',
    imageCaption: 'HRCT Thorax — bilateral basal subpleural reticular opacities with honeycombing',
  },

  {
    id: 'img_q005',
    part: 'Part 1',
    system: 'Dermatology',
    topic: 'Dermatology — Psoriasis',
    year: '2021',
    difficulty: 'Easy',
    stem: 'A 35-year-old man presents with a 6-month history of itchy, scaly plaques on his elbows, knees, and scalp. He also has nail pitting and onycholysis. The skin lesion is shown. Which of the following findings on skin biopsy would be most consistent with this diagnosis?',
    options: [
      { id: 'A', text: 'Acanthosis with hypergranulosis and hyperkeratosis' },
      { id: 'B', text: 'Acanthosis, parakeratosis, Munro microabscesses, and elongated rete ridges' },
      { id: 'C', text: 'Interface dermatitis with liquefactive degeneration of basal layer' },
      { id: 'D', text: 'Subepidermal bullae with eosinophils' },
      { id: 'E', text: 'Dermal granulomas with Langhans giant cells' },
    ],
    correctAnswer: 'B',
    explanation:
      'The image shows classic plaque psoriasis: well-demarcated, erythematous plaques with silvery-white scale on extensor surfaces. Histological features of psoriasis include: acanthosis (epidermal thickening), parakeratosis (nuclei retained in stratum corneum), Munro microabscesses (neutrophil collections in stratum corneum), loss of granular layer, elongated rete ridges, dilated tortuous dermal capillaries, and perivascular T-cell infiltrate. Nail involvement (pitting, onycholysis, oil spots) is present in ~50% and is associated with psoriatic arthritis. Hypergranulosis is seen in lichen planus, not psoriasis.',
    reference: 'British Association of Dermatologists Psoriasis Guidelines 2023',
    tags: ['Psoriasis', 'Skin biopsy', 'Munro microabscesses', 'Parakeratosis', 'Plaque psoriasis'],
    imageUrl: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ab0f/8140694/6da4b480b1dc/clinmed-21-3-170fig1.jpg',
    imageType: 'Dermatology',
    imageCaption: 'Well-demarcated erythematous plaques with silvery scale on extensor surface',
  },

  {
    id: 'img_q006',
    part: 'Part 2',
    system: 'Neurology',
    topic: 'MRI Brain — Stroke',
    year: '2023',
    difficulty: 'Hard',
    stem: 'A 71-year-old hypertensive man presents with sudden onset of left-sided hemiplegia, hemisensory loss, and left homonymous hemianopia. Symptoms onset was 2 hours ago. NIHSS score is 14. His MRI DWI brain is shown. He has no contraindications to thrombolysis. What is the most appropriate immediate management?',
    options: [
      { id: 'A', text: 'Aspirin 300mg orally and admit to stroke unit' },
      { id: 'B', text: 'IV alteplase (rt-PA) 0.9 mg/kg followed by aspirin at 24 hours' },
      { id: 'C', text: 'Mechanical thrombectomy only, no IV thrombolysis' },
      { id: 'D', text: 'IV alteplase followed by mechanical thrombectomy if eligible' },
      { id: 'E', text: 'CT perfusion imaging before deciding treatment' },
    ],
    correctAnswer: 'D',
    explanation:
      'The MRI DWI (Diffusion Weighted Imaging) shows a large area of restricted diffusion in the right MCA territory, consistent with an acute ischaemic stroke. Current NICE/RCP guidelines (2023) recommend: (1) IV alteplase (0.9 mg/kg, max 90mg) within 4.5 hours of symptom onset for eligible patients, AND (2) Mechanical thrombectomy for large vessel occlusion (LVO) confirmed on CTA within 6 hours (up to 24h in selected patients with salvageable penumbra). The two treatments are complementary, not mutually exclusive. Aspirin alone is insufficient for acute large-vessel stroke.',
    reference: 'NICE NG128 Stroke and TIA 2023; ESC/ESO Stroke Guidelines',
    tags: ['Ischaemic stroke', 'MRI DWI', 'Alteplase', 'Thrombectomy', 'MCA territory', 'NIHSS'],
    imageUrl: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/bf94/8174850/d8cb72c0af6d/ajnr-21-09-09-f02.jpg',
    imageType: 'MRI',
    imageCaption: 'MRI DWI sequence — restricted diffusion in right MCA territory indicating acute ischaemic stroke',
  },
];

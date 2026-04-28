import { createClient } from '@supabase/supabase-js';
import { Question } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Normalize options from various possible DB formats → {id, text}[]
function normalizeOptions(raw: unknown): { id: string; text: string }[] {
  const ids = ['A', 'B', 'C', 'D', 'E'];

  // Format: {A: 'text', B: 'text', C: 'text', D: 'text', E: 'text'}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return ids
      .filter((id) => id in o)
      .map((id) => ({ id, text: String(o[id] ?? '') }));
  }

  if (!Array.isArray(raw)) return [];

  return raw.map((opt: unknown, i: number) => {
    const fallbackId = ids[i] ?? String(i + 1);

    // Format: ['text1', 'text2', ...]
    if (typeof opt === 'string') {
      return { id: fallbackId, text: opt };
    }

    if (opt && typeof opt === 'object') {
      const o = opt as Record<string, unknown>;

      // Format: {id: 'A', text: '...'} or variants with value/label/answer/content/option
      const text =
        (o.text as string) ||
        (o.value as string) ||
        (o.label as string) ||
        (o.answer as string) ||
        (o.content as string) ||
        (o.option as string) ||
        (o.choice as string) ||
        (o.description as string) ||
        '';

      const id = (o.id as string) || (o.key as string) || (o.letter as string) || fallbackId;
      return { id, text };
    }

    return { id: fallbackId, text: '' };
  });
}

// Convert DB row (snake_case) → Question (camelCase)
export function rowToQuestion(row: Record<string, unknown>): Question {
  return {
    id: row.id as string,
    part: row.part as Question['part'],
    system: row.system as string,
    topic: row.topic as string,
    year: (row.year as string) ?? undefined,
    difficulty: row.difficulty as Question['difficulty'],
    source: (row.source as Question['source']) ?? undefined,
    stem: row.stem as string,
    options: normalizeOptions(row.options),
    correctAnswer: row.correct_answer as string,
    explanation: row.explanation as string,
    reference: (row.reference as string) ?? undefined,
    tags: (row.tags as string[]) ?? undefined,
    imageUrl: (row.image_url as string) ?? undefined,
    imageType: (row.image_type as Question['imageType']) ?? undefined,
    imageCaption: (row.image_caption as string) ?? undefined,
  };
}

// Convert Question (camelCase) → DB row (snake_case)
export function questionToRow(q: Question) {
  return {
    id: q.id,
    part: q.part,
    system: q.system,
    topic: q.topic,
    year: q.year ?? null,
    difficulty: q.difficulty,
    source: q.source ?? null,
    stem: q.stem,
    options: q.options,
    correct_answer: q.correctAnswer,
    explanation: q.explanation || 'Explanation not yet available.',
    reference: q.reference ?? null,
    tags: q.tags ?? null,
    image_url: q.imageUrl ?? null,
    image_type: q.imageType ?? null,
    image_caption: q.imageCaption ?? null,
  };
}

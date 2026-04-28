export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type MRCPPart = 'Part 1' | 'Part 2';
export type QBankSource = 'Passmedicine' | 'Pastest' | 'Custom';
export const QBANK_SOURCES: QBankSource[] = ['Passmedicine', 'Pastest', 'Custom'];

export const QBANK_SOURCE_COLORS: Record<QBankSource, string> = {
  Passmedicine: 'bg-violet-100 text-violet-700 border-violet-200',
  Pastest:      'bg-teal-100 text-teal-700 border-teal-200',
  Custom:       'bg-gray-100 text-gray-600 border-gray-200',
};

export const QBANK_SOURCE_ICONS: Record<QBankSource, string> = {
  Passmedicine: '🟣',
  Pastest:      '🟢',
  Custom:       '⚙️',
};

// ── Auth ─────────────────────────────────────────────────────
export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  avatar?: string; // initials-based
}

export interface Option {
  id: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  text: string;
}

export type ImageType = 'ECG' | 'X-Ray' | 'CT Scan' | 'MRI' | 'Histology' | 'Blood Film' | 'Fundoscopy' | 'Dermatology' | 'Echo' | 'Other';

export const IMAGE_TYPES: ImageType[] = [
  'ECG', 'X-Ray', 'CT Scan', 'MRI', 'Histology', 'Blood Film', 'Fundoscopy', 'Dermatology', 'Echo', 'Other'
];

export const IMAGE_TYPE_COLORS: Record<ImageType, string> = {
  'ECG':         'bg-red-100 text-red-700 border-red-200',
  'X-Ray':       'bg-blue-100 text-blue-700 border-blue-200',
  'CT Scan':     'bg-purple-100 text-purple-700 border-purple-200',
  'MRI':         'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Histology':   'bg-pink-100 text-pink-700 border-pink-200',
  'Blood Film':  'bg-rose-100 text-rose-700 border-rose-200',
  'Fundoscopy':  'bg-teal-100 text-teal-700 border-teal-200',
  'Dermatology': 'bg-orange-100 text-orange-700 border-orange-200',
  'Echo':        'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Other':       'bg-gray-100 text-gray-700 border-gray-200',
};

export const IMAGE_TYPE_ICONS: Record<ImageType, string> = {
  'ECG':         '🫀',
  'X-Ray':       '🫁',
  'CT Scan':     '🧠',
  'MRI':         '🔬',
  'Histology':   '🔭',
  'Blood Film':  '🩸',
  'Fundoscopy':  '👁️',
  'Dermatology': '🩹',
  'Echo':        '💓',
  'Other':       '🖼️',
};

export interface Question {
  id: string;
  part: MRCPPart;
  system: string;
  topic: string;
  year?: string;
  difficulty: Difficulty;
  source?: QBankSource; // Passmedicine | Pastest | Custom
  stem: string;
  options: Option[];
  correctAnswer: string; // option id
  explanation: string;
  reference?: string;
  tags?: string[];
  // ── Image Support ───────────────────────────────────────────
  imageUrl?: string;
  imageType?: ImageType;
  imageCaption?: string;
}

export interface QuizSession {
  id: string;
  questions: Question[];
  answers: Record<string, string>; // questionId -> selectedOptionId
  flagged: Set<string>;
  startTime: number;
  endTime?: number;
  mode: 'tutor' | 'timed' | 'review';
  currentIndex: number;
}

export interface UserStats {
  totalAttempted: number;
  totalCorrect: number;
  bySystem: Record<string, { attempted: number; correct: number }>;
  byDifficulty: Record<string, { attempted: number; correct: number }>;
  history: HistoryEntry[];
}

export interface HistoryEntry {
  sessionId: string;
  date: string;
  score: number;
  total: number;
  system: string;
  mode: string;
  part?: string;
  source?: string; // 'Passmedicine' | 'Pastest' | 'Custom' | mixed
}

// ── MRCP Part 1 Systems ─────────────────────────────────────
export const PART1_SYSTEMS = [
  'Cardiology',
  'Respiratory',
  'Gastroenterology',
  'Nephrology',
  'Neurology',
  'Endocrinology',
  'Rheumatology',
  'Haematology',
  'Infectious Diseases',
  'Dermatology',
  'Psychiatry',
  'Ophthalmology',
  'Pharmacology',
  'Clinical Sciences',
  'Oncology',
  'Biostatistics',
  'Geriatrics',
  'Palliative Medicine',
] as const;

// ── MRCP Part 2 Systems ─────────────────────────────────────
export const PART2_SYSTEMS = [
  'Cardiology',
  'Respiratory',
  'Gastroenterology',
  'Nephrology',
  'Neurology',
  'Endocrinology',
  'Rheumatology',
  'Haematology',
  'Infectious Diseases',
  'Dermatology',
  'Psychiatry',
  'Ophthalmology',
  'Pharmacology',
  'Clinical Sciences',
  'Oncology',
  'Geriatrics',
] as const;

export type Part1System = (typeof PART1_SYSTEMS)[number];
export type Part2System = (typeof PART2_SYSTEMS)[number];

// Combined all unique systems
export const SYSTEMS = [
  'Cardiology',
  'Respiratory',
  'Gastroenterology',
  'Nephrology',
  'Neurology',
  'Endocrinology',
  'Rheumatology',
  'Haematology',
  'Infectious Diseases',
  'Dermatology',
  'Psychiatry',
  'Ophthalmology',
  'Pharmacology',
  'Clinical Sciences',
  'Oncology',
  'Biostatistics',
  'Geriatrics',
  'Palliative Medicine',
] as const;

export type SystemName = (typeof SYSTEMS)[number];

// ── Textbook ──────────────────────────────────────────────────
export interface Textbook {
  id: string;
  source: 'Passmedicine';
  part: 'Part 1' | 'Part 2';
  title: string;
  pdfUrl: string;
  description?: string;
  uploadedAt: string;
}

// ── One-liner / Pearl ─────────────────────────────────────────
export type OneLinerSource = 'Passmedicine' | 'Pastest';
export type OneLinerPart   = 'Part 1' | 'Part 2' | 'Both';

export interface OneLiner {
  id: string;
  source: OneLinerSource;
  part: OneLinerPart;
  system: string;
  topic?: string;
  content: string;        // the pearl / one-liner text
  explanation?: string;
  tags?: string[];
}

export const SYSTEM_ICONS: Record<string, string> = {
  Cardiology: '❤️',
  Respiratory: '🫁',
  Gastroenterology: '🫃',
  Nephrology: '🫘',
  Neurology: '🧠',
  Endocrinology: '⚗️',
  Rheumatology: '🦴',
  Haematology: '🩸',
  'Infectious Diseases': '🦠',
  Dermatology: '🌿',
  Psychiatry: '🧘',
  Ophthalmology: '👁️',
  Pharmacology: '💊',
  'Clinical Sciences': '🔬',
  Oncology: '🎗️',
  Biostatistics: '📊',
  Geriatrics: '🧓',
  'Palliative Medicine': '🕊️',
};

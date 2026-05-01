import { useState, useRef, useEffect } from 'react';
import {
  getQuestions,
  saveQuestions,
  addQuestions,
  deleteQuestion,
  updateQuestion,
  clearAllData,
  addQuestionToSupabase,
  addQuestionsToSupabase,
  syncFromSupabase,
  updateQuestionInSupabase,
  deleteQuestionFromSupabase,
  clearAllQuestionsFromSupabase,
  verifyUploadInSupabase,
  getSupabaseTotalCount,
  checkSourceColumnExists,
  patchNullSourcesToMRCP,
  bulkReassignSystem,
} from '../store';
import { Question, SYSTEMS, PART1_SYSTEMS, PART2_SYSTEMS, Difficulty, MRCPPart, IMAGE_TYPES, ImageType, QBankSource, QBANK_SOURCES, QBANK_SOURCE_COLORS, QBANK_SOURCE_ICONS, Textbook, OneLiner, OneLinerSource } from '../types';
import UserManagement from '../components/UserManagement';
import QuestionImage from '../components/QuestionImage';
import {
  getTextbooks, saveTextbook, deleteTextbook, generateTextbookId,
} from '../textbookStore';
import {
  getOneLiners, bulkAddOneLiners, deleteOneLiner, clearOneLiners,
} from '../oneLinerStore';

const EMPTY_Q: Omit<Question, 'id'> = {
  part: 'Part 1',
  system: 'Cardiology',
  topic: '',
  year: '',
  difficulty: 'Medium',
  source: 'Custom',
  stem: '',
  options: [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' },
    { id: 'E', text: '' },
  ],
  correctAnswer: 'A',
  explanation: '',
  reference: '',
  tags: [],
  imageUrl: '',
  imageType: undefined,
  imageCaption: '',
};

const SAMPLE_JSON = `[
  {
    "id": "q_pm_001",
    "part": "Part 1",
    "system": "Cardiology",
    "topic": "ECG Interpretation",
    "year": "2023",
    "difficulty": "Medium",
    "source": "Passmedicine",
    "stem": "A 58-year-old man presents with a 3-month history of fatigue and breathlessness. His blood results are shown below:\\n\\n| Investigation | Result | Reference Range |\\n|---|---|---|\\n| Haemoglobin | 7.2 g/dL | 13.5–17.5 g/dL |\\n| MCV | 68 fL | 80–100 fL |\\n| Ferritin | 4 µg/L | 12–300 µg/L |\\n| B12 | 312 ng/L | 197–771 ng/L |\\n\\nWhat is the most likely diagnosis?",
    "options": [
      { "id": "A", "text": "Anterior STEMI" },
      { "id": "B", "text": "NSTEMI" },
      { "id": "C", "text": "Pericarditis" },
      { "id": "D", "text": "Left bundle branch block" },
      { "id": "E", "text": "Hyperkalaemia" }
    ],
    "correctAnswer": "A",
    "explanation": "The ECG shows ST elevation in leads V1–V4 with reciprocal ST depression in the inferior leads (II, III, aVF), consistent with an anterior STEMI due to LAD occlusion. Immediate PCI is indicated within 120 minutes.",
    "reference": "ESC Guidelines on STEMI 2023",
    "tags": ["ECG", "STEMI", "Chest Pain", "PCI"],
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/STEMI.png/800px-STEMI.png",
    "imageType": "ECG",
    "imageCaption": "12-lead ECG showing anterior ST elevation"
  }
]`;

type AdminTab =
  | 'upload-mrcp1' | 'upload-mrcp2'
  | 'upload-pm1' | 'upload-pm2'
  | 'upload-pt1' | 'upload-pt2'
  | 'upload-custom'
  | 'textbooks' | 'oneliners'
  | 'manage' | 'manual' | 'template' | 'diagnostics' | 'users';

export default function AdminPanel({ onDataChange }: { onDataChange?: () => void }) {
  const [tab, setTab] = useState<AdminTab>('upload-mrcp1');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [jsonSuccess, setJsonSuccess] = useState('');
  const [questions, setQuestions] = useState<Question[]>(() => getQuestions());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const [newQ, setNewQ] = useState<Omit<Question, 'id'>>(EMPTY_Q);
  const [newQError, setNewQError] = useState('');
  const [newQSuccess, setNewQSuccess] = useState('');
  const [searchAdmin, setSearchAdmin] = useState('');
  const [clearConfirm, setClearConfirm] = useState(false);
  const [partFilter, setPartFilter] = useState<MRCPPart | 'All'>('All');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Bulk Reassign state ───────────────────────────────────────────────────
  const [reassignFrom, setReassignFrom] = useState('Clinical Sciences');
  const [reassignTo, setReassignTo] = useState('Palliative Medicine');
  const [reassignPart, setReassignPart] = useState<'Part 1' | 'Part 2' | 'Both'>('Part 1');
  const [reassignSource, setReassignSource] = useState('Any');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignResult, setReassignResult] = useState<string | null>(null);
  const [reassignConfirm, setReassignConfirm] = useState(false);

  // ── Diagnostics state ─────────────────────────────────────────────────────
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<string | null>(null);
  const [schemaOk, setSchemaOk] = useState<boolean | null>(null);  // null = not checked yet
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchResult, setPatchResult] = useState<string | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);

  const runDiagnostics = async () => {
    setDiagLoading(true);
    setDiagResult(null);
    setPatchResult(null);
    try {
      // Check schema health first
      const columnOk = await checkSourceColumnExists();
      setSchemaOk(columnOk);

      const total = await getSupabaseTotalCount();
      // Re-fetch all questions fresh
      const freshQs = await syncFromSupabase();
      setQuestions(freshQs);
      const bySource: Record<string, number> = {};
      const byPart: Record<string, number> = {};
      const nullSource = freshQs.filter((q) => !q.source).length;
      freshQs.forEach((q) => {
        bySource[q.source ?? 'null/undefined'] = (bySource[q.source ?? 'null/undefined'] ?? 0) + 1;
        byPart[q.part ?? 'null'] = (byPart[q.part ?? 'null'] ?? 0) + 1;
      });
      let result = `${columnOk ? '✅' : '❌'} source column: ${columnOk ? 'EXISTS' : 'MISSING — run the SQL fix below!'}\n`;
      result += `✅ Supabase Total Rows: ${total}\n`;
      result += `✅ Synced to App: ${freshQs.length} questions\n\n`;
      result += `📊 By Source:\n`;
      Object.entries(bySource).sort().forEach(([s, c]) => { result += `  • ${s}: ${c}\n`; });
      result += `\n📋 By Part:\n`;
      Object.entries(byPart).sort().forEach(([p, c]) => { result += `  • ${p}: ${c}\n`; });
      if (nullSource > 0) {
        result += `\n⚠️ ${nullSource} questions have NO source — use "Patch → MRCP" button below`;
      } else {
        result += `\n✅ All questions have a source assigned`;
      }
      setDiagResult(result);
    } catch (err: any) {
      setDiagResult(`❌ Diagnostics failed: ${err.message ?? err}`);
    } finally {
      setDiagLoading(false);
    }
  };

  // ── Textbook state ────────────────────────────────────────────────────────
  const [textbooks, setTextbooks] = useState<Textbook[]>(() => getTextbooks());
  const [tbPart, setTbPart] = useState<'Part 1' | 'Part 2'>('Part 1');
  const [tbTitle, setTbTitle] = useState('');
  const [tbDesc, setTbDesc] = useState('');
  const [tbUrl, setTbUrl] = useState('');
  const [tbMsg, setTbMsg] = useState('');
  const [tbDeleteConfirm, setTbDeleteConfirm] = useState<string | null>(null);

  // ── One-liner state ───────────────────────────────────────────────────────
  const [liners, setLiners] = useState<OneLiner[]>(() => getOneLiners());
  const [olJson, setOlJson] = useState('');
  const [olSource, setOlSource] = useState<OneLinerSource>('Passmedicine');
  const [olMsg, setOlMsg] = useState('');
  const [olError, setOlError] = useState('');
  const [olClearConfirm, setOlClearConfirm] = useState<OneLinerSource | null>(null);

  const [forceUpsert, setForceUpsert] = useState(false);
  const refresh = async () => { const qs = await syncFromSupabase(); setQuestions(qs); };

  useEffect(() => { refresh(); }, []);

  // Derive systems for manual add based on selected part
  const manualSystems = newQ.part === 'Part 1' ? [...PART1_SYSTEMS] : [...PART2_SYSTEMS];
  const editSystems = editingQ?.part === 'Part 1' ? [...PART1_SYSTEMS] : [...PART2_SYSTEMS];

  // ── JSON Upload ────────────────────────────────────────────
  const validateAndImport = async (text: string, forcedSource?: QBankSource) => {
    setJsonError('');
    setJsonSuccess('');
    if (!text.trim()) {
      setJsonError('JSON input is empty.');
      return;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e: any) {
      setJsonError(`❌ JSON Parse Error: ${e.message}`);
      return;
    }

    const arr: any[] = Array.isArray(parsed) ? parsed : [parsed];
    const errors: string[] = [];
    const validated: Question[] = [];

    arr.forEach((item, i) => {
      const prefix = `Q[${i + 1}]`;
      if (!item.id) errors.push(`${prefix}: missing "id"`);
      if (!item.part || !['Part 1', 'Part 2'].includes(item.part)) errors.push(`${prefix}: "part" must be "Part 1" or "Part 2"`);
      if (!item.system || !SYSTEMS.includes(item.system)) errors.push(`${prefix}: invalid or missing "system" — must be one of the MRCP systems`);
      if (!item.stem) errors.push(`${prefix}: missing "stem"`);
      if (!Array.isArray(item.options) || item.options.length < 2) errors.push(`${prefix}: "options" must be an array of at least 2`);
      if (!item.correctAnswer) errors.push(`${prefix}: missing "correctAnswer"`);
      // explanation optional — legacy questions may have none
      if (!['Easy', 'Medium', 'Hard'].includes(item.difficulty)) errors.push(`${prefix}: "difficulty" must be Easy, Medium, or Hard`);

      if (errors.filter((e) => e.startsWith(prefix)).length === 0) {
        const resolvedSource: QBankSource = forcedSource ?? (QBANK_SOURCES.includes(item.source) ? item.source : 'Custom');
        validated.push({
          id: String(item.id),
          part: item.part as MRCPPart,
          system: item.system,
          topic: item.topic ?? '',
          year: item.year ?? '',
          difficulty: item.difficulty ?? 'Medium',
          source: resolvedSource,
          stem: item.stem,
          options: item.options,
          correctAnswer: String(item.correctAnswer),
          explanation: item.explanation || 'Explanation not yet available.',
          reference: item.reference ?? '',
          tags: Array.isArray(item.tags) ? item.tags : [],
          imageUrl: item.imageUrl ?? '',
          imageType: item.imageType ?? undefined,
          imageCaption: item.imageCaption ?? '',
        });
      }
    });

    if (errors.length > 0) {
      setJsonError('❌ Validation Errors:\n' + errors.join('\n'));
      return;
    }

    // Check for duplicate IDs (against already-loaded questions state)
    const existingIds = new Set(questions.map((q) => q.id));
    const duplicates = validated.filter((q) => existingIds.has(q.id));
    if (duplicates.length > 0) {
      setJsonError(`⚠️ Duplicate IDs found: ${duplicates.map((d) => d.id).join(', ')}. Please use unique IDs.`);
      return;
    }

    setJsonSuccess(`⏳ Importing ${validated.length} question(s) to Supabase...`);
    try {
      await addQuestionsToSupabase(validated);
      onDataChange?.();
      await refresh();
      setJsonText('');
      setJsonSuccess(`✅ Successfully imported ${validated.length} question(s)!`);
    } catch (err: any) {
      setJsonError(`❌ Supabase import failed: ${err.message ?? err}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonText(text);
    };
    reader.readAsText(file);
  };

  // ── Manual Add ────────────────────────────────────────────
  const handleAddManual = () => {
    setNewQError('');
    setNewQSuccess('');
    if (!newQ.stem.trim()) { setNewQError('Question stem is required.'); return; }
    if (!newQ.explanation.trim()) { setNewQError('Explanation is required.'); return; }
    if (newQ.options.some((o) => !o.text.trim())) { setNewQError('All 5 options must have text.'); return; }

    const id = `q_manual_${Date.now()}`;
    const q: Question = { ...newQ, id, tags: typeof newQ.tags === 'string' ? (newQ.tags as string).split(',').map((t) => t.trim()).filter(Boolean) : newQ.tags ?? [] };
    const existing = getQuestions();
    saveQuestions([...existing, q]);
    addQuestionToSupabase(q).then(() => onDataChange?.());
    refresh();
    setNewQ({ ...EMPTY_Q, part: newQ.part }); // keep current part selection
    setNewQSuccess('✅ Question added successfully!');
  };

  const handleDeleteQ = (id: string) => {
    deleteQuestion(id);
    deleteQuestionFromSupabase(id).then(() => onDataChange?.());
    refresh();
    setDeleteConfirm(null);
  };

  const handleClearAll = () => {
    clearAllData();
    clearAllQuestionsFromSupabase().then(() => onDataChange?.());
    refresh();
    setClearConfirm(false);
  };

  const handleExport = () => {
    const data = JSON.stringify(questions, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mrcp_questions_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [sourceFilter, setSourceFilter] = useState<QBankSource | 'All' | 'NoSource'>('All');

  const filtered = questions.filter((q) => {
    const partOk = partFilter === 'All' || q.part === partFilter;
    const sourceOk = sourceFilter === 'All'
      ? true
      : sourceFilter === 'NoSource'
      ? !q.source
      : q.source === sourceFilter;
    const searchOk = searchAdmin.trim() === '' ||
      q.stem.toLowerCase().includes(searchAdmin.toLowerCase()) ||
      q.system.toLowerCase().includes(searchAdmin.toLowerCase()) ||
      q.topic.toLowerCase().includes(searchAdmin.toLowerCase());
    return partOk && sourceOk && searchOk;
  });

  const part1Count = questions.filter((q) => q.part === 'Part 1' && q.source !== 'Passmedicine' && q.source !== 'Pastest').length;
  const part2Count = questions.filter((q) => q.part === 'Part 2' && q.source !== 'Passmedicine' && q.source !== 'Pastest').length;
  const pm1Count = questions.filter((q) => q.source === 'Passmedicine' && q.part === 'Part 1').length;
  const pm2Count = questions.filter((q) => q.source === 'Passmedicine' && q.part === 'Part 2').length;
  const pt1Count = questions.filter((q) => q.source === 'Pastest' && q.part === 'Part 1').length;
  const pt2Count = questions.filter((q) => q.source === 'Pastest' && q.part === 'Part 2').length;
  const passmedicineCount = pm1Count + pm2Count;
  const pastestCount = pt1Count + pt2Count;

  // ── Textbook handlers ────────────────────────────────────────────────────
  const handleAddTextbook = () => {
    setTbMsg('');
    if (!tbTitle.trim()) { setTbMsg('❌ Title is required.'); return; }
    if (!tbUrl.trim() || !tbUrl.startsWith('http')) { setTbMsg('❌ A valid PDF URL is required.'); return; }
    const tb: Textbook = {
      id: generateTextbookId(),
      source: 'Passmedicine',
      part: tbPart,
      title: tbTitle.trim(),
      description: tbDesc.trim() || undefined,
      pdfUrl: tbUrl.trim(),
      uploadedAt: new Date().toISOString(),
    };
    saveTextbook(tb);
    setTextbooks(getTextbooks());
    setTbTitle(''); setTbDesc(''); setTbUrl('');
    setTbMsg(`✅ Textbook "${tb.title}" added for Passmedicine ${tbPart}.`);
  };

  const handleDeleteTextbook = (id: string) => {
    deleteTextbook(id);
    setTextbooks(getTextbooks());
    setTbDeleteConfirm(null);
  };

  // ── One-liner handlers ────────────────────────────────────────────────────
  const handleOneLinerImport = () => {
    setOlMsg(''); setOlError('');
    if (!olJson.trim()) { setOlError('❌ JSON input is empty.'); return; }
    let parsed: any;
    try { parsed = JSON.parse(olJson); }
    catch (e: any) { setOlError(`❌ JSON Parse Error: ${e.message}`); return; }
    const arr: any[] = Array.isArray(parsed) ? parsed : [parsed];
    const errors: string[] = [];
    const validated: OneLiner[] = [];
    arr.forEach((item, i) => {
      const p = `[${i+1}]`;
      if (!item.id) errors.push(`${p}: missing "id"`);
      if (!item.content) errors.push(`${p}: missing "content"`);
      if (!item.system) errors.push(`${p}: missing "system"`);
      if (errors.filter(e => e.startsWith(p)).length === 0) {
        validated.push({
          id: String(item.id),
          source: olSource,
          part: ['Part 1','Part 2','Both'].includes(item.part) ? item.part : 'Both',
          system: item.system,
          topic: item.topic ?? undefined,
          content: item.content,
          explanation: item.explanation ?? undefined,
          tags: Array.isArray(item.tags) ? item.tags : [],
        });
      }
    });
    if (errors.length > 0) { setOlError('❌ Validation Errors:\n' + errors.join('\n')); return; }
    const result = bulkAddOneLiners(validated);
    setLiners(getOneLiners());
    setOlJson('');
    setOlMsg(`✅ ${result.added} new · ${result.updated} updated · ${getOneLiners().length} total in database.`);
  };

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'upload-mrcp1', label: 'MRCP Part 1',  icon: '📘' },
    { id: 'upload-mrcp2', label: 'MRCP Part 2',  icon: '📗' },
    { id: 'upload-pm1',   label: 'PM Part 1',    icon: '🟣' },
    { id: 'upload-pm2',   label: 'PM Part 2',    icon: '🟣' },
    { id: 'upload-pt1',   label: 'PT Part 1',    icon: '🟢' },
    { id: 'upload-pt2',   label: 'PT Part 2',    icon: '🟢' },
    { id: 'upload-custom',label: 'Custom Upload', icon: '⚙️' },
    { id: 'textbooks',    label: 'Textbooks',    icon: '📚' },
    { id: 'oneliners',    label: 'One-Liners',   icon: '💡' },
    { id: 'manage',       label: 'Manage',       icon: '📋' },
    { id: 'manual',       label: 'Add Manually', icon: '✏️' },
    { id: 'template',     label: 'Template',     icon: '📄' },
    { id: 'diagnostics',  label: 'Diagnostics',  icon: '🔬' },
    { id: 'users',        label: 'Users',        icon: '👥' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">ADMIN PANEL</span>
              </div>
              <h1 className="text-3xl font-bold">Question Management</h1>
              <p className="text-amber-100 mt-1">{questions.length} total questions in database</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleExport}
                className="bg-white/20 hover:bg-white/30 border border-white/30 backdrop-blur text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
              >
                ⬇️ Export JSON
              </button>
              <button
                onClick={() => setClearConfirm(true)}
                className="bg-red-500/80 hover:bg-red-500 border border-red-400/30 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
              >
                🗑️ Clear All Data
              </button>
            </div>
          </div>

          {/* Stats breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-2 mt-6">
            {[
              { label: 'Total Qs',     value: questions.length,  icon: '📝' },
              { label: 'MRCP P1',      value: part1Count,        icon: '📘' },
              { label: 'MRCP P2',      value: part2Count,        icon: '📗' },
              { label: 'PM Part 1',    value: pm1Count,          icon: '🟣' },
              { label: 'PM Part 2',    value: pm2Count,          icon: '🟣' },
              { label: 'PT Part 1',    value: pt1Count,          icon: '🟢' },
              { label: 'PT Part 2',    value: pt2Count,          icon: '🟢' },
              { label: 'Systems',      value: new Set(questions.map(q => q.system)).size, icon: '🗂️' },
              { label: 'Textbooks',    value: textbooks.length,  icon: '📚' },
              { label: 'One-Liners',   value: liners.length,     icon: '💡' },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 backdrop-blur rounded-xl p-3 text-center border border-white/20">
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-amber-100">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                  tab === t.id
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* ── MRCP PART 1 & PART 2 UPLOAD TABS ── */}
        {(tab === 'upload-mrcp1' || tab === 'upload-mrcp2') && (() => {
          const isPart1 = tab === 'upload-mrcp1';
          const partLabel = isPart1 ? 'Part 1' : 'Part 2';
          const partIcon = isPart1 ? '📘' : '📗';
          const color = isPart1 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700';
          const border = isPart1 ? 'border-blue-400' : 'border-emerald-400';
          const ring = isPart1 ? 'focus:ring-blue-500' : 'focus:ring-emerald-500';
          const badge = isPart1 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700';

          // Custom validator that forces part + source=Custom
          const handleMrcpImport = async () => {
            setJsonError('');
            setJsonSuccess('');
            if (!jsonText.trim()) { setJsonError('JSON input is empty.'); return; }
            let parsed: any;
            try { parsed = JSON.parse(jsonText); }
            catch (e: any) { setJsonError(`❌ JSON Parse Error: ${e.message}`); return; }

            const arr: any[] = Array.isArray(parsed) ? parsed : [parsed];
            const errors: string[] = [];
            const validated: Question[] = [];

            arr.forEach((item, i) => {
              const prefix = `Q[${i + 1}]`;
              if (!item.id) errors.push(`${prefix}: missing "id"`);
              if (!item.system || !SYSTEMS.includes(item.system)) errors.push(`${prefix}: invalid or missing "system"`);
              if (!item.stem) errors.push(`${prefix}: missing "stem"`);
              if (!Array.isArray(item.options) || item.options.length < 2) errors.push(`${prefix}: "options" must be an array of at least 2`);
              if (!item.correctAnswer) errors.push(`${prefix}: missing "correctAnswer"`);
              // explanation optional — legacy questions may have none
              if (!['Easy', 'Medium', 'Hard'].includes(item.difficulty)) errors.push(`${prefix}: "difficulty" must be Easy, Medium, or Hard`);
              if (errors.filter((e) => e.startsWith(prefix)).length === 0) {
                validated.push({
                  id: String(item.id),
                  part: isPart1 ? 'Part 1' : 'Part 2', // force correct part
                  system: item.system,
                  topic: item.topic ?? '',
                  year: item.year ?? '',
                  difficulty: item.difficulty ?? 'Medium',
                  source: 'MRCP', // MRCP native past papers
                  stem: item.stem,
                  options: item.options,
                  correctAnswer: String(item.correctAnswer),
                  explanation: item.explanation || 'Explanation not yet available.',
                  reference: item.reference ?? '',
                  tags: Array.isArray(item.tags) ? item.tags : [],
                  imageUrl: item.imageUrl ?? '',
                  imageType: item.imageType ?? undefined,
                  imageCaption: item.imageCaption ?? '',
                });
              }
            });

            if (errors.length > 0) { setJsonError('❌ Validation Errors:\n' + errors.join('\n')); return; }

            if (!forceUpsert) {
              const existingIds = new Set(questions.map((q) => q.id));
              const duplicates = validated.filter((q) => existingIds.has(q.id));
              if (duplicates.length > 0) {
                setJsonError(
                  `⚠️ ${duplicates.length} question(s) already exist in the database.\n\n` +
                  `Tick "Force Update" to overwrite them with the new data (useful for reformatting explanations).`
                );
                return;
              }
            }

            const existingIds2 = new Set(questions.map((q) => q.id));
            const newCount      = validated.filter((q) => !existingIds2.has(q.id)).length;
            const updateCount   = validated.length - newCount;
            const action        = forceUpsert && updateCount > 0
              ? `⏳ Upserting ${validated.length} MRCP ${partLabel} questions (${newCount} new, ${updateCount} updates)…`
              : `⏳ Uploading ${validated.length} MRCP ${partLabel} questions to Supabase…`;

            setJsonSuccess(action);
            try {
              await addQuestionsToSupabase(validated);
              const verifiedCount = await verifyUploadInSupabase('MRCP', isPart1 ? 'Part 1' : 'Part 2');
              await refresh();
              onDataChange?.();
              setJsonText('');
              setJsonSuccess(
                `✅ ${forceUpsert && updateCount > 0 ? `Updated ${updateCount} + added ${newCount}` : `Uploaded ${validated.length}`} MRCP ${partLabel} question(s)!\n` +
                `🔍 Verified: Supabase now has ${verifiedCount} total MRCP ${partLabel} question(s).`
              );
            } catch (err: any) {
              setJsonError(`❌ Supabase upload failed: ${err.message ?? String(err)}`);
            }
          };

          return (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{partIcon}</span>
                  <h2 className="text-xl font-bold text-gray-800">Upload MRCP {partLabel} Past Papers</h2>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${badge}`}>MRCP {partLabel}</span>
                </div>
                <p className="text-gray-500 text-sm mb-4">
                  Questions will be tagged as <strong>MRCP {partLabel}</strong> native past papers (source: Custom).
                  They will appear in the <strong>MRCP {partLabel}</strong> section of the dashboard.
                </p>

                {/* Notice */}
                <div className={`${isPart1 ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'} border rounded-xl p-3 mb-4 flex items-start gap-2`}>
                  <span className="text-lg">{partIcon}</span>
                  <div className="text-sm text-gray-700">
                    <strong>MRCP {partLabel} Systems:</strong>{' '}
                    {isPart1
                      ? 'Cardiology, Respiratory, Gastroenterology, Nephrology, Neurology, Endocrinology, Rheumatology, Haematology, Infectious Diseases, Dermatology, Psychiatry, Ophthalmology, Pharmacology, Clinical Sciences, Oncology, Biostatistics, Geriatrics, Palliative Medicine'
                      : 'Cardiology, Respiratory, Gastroenterology, Nephrology, Neurology, Endocrinology, Rheumatology, Haematology, Infectious Diseases, Dermatology, Psychiatry, Ophthalmology, Pharmacology, Clinical Sciences, Oncology, Geriatrics'}
                  </div>
                </div>

                {/* File Upload */}
                <div onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed ${border} hover:opacity-80 rounded-2xl p-8 text-center cursor-pointer transition mb-4 group`}>
                  <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">{partIcon}</div>
                  <div className="text-gray-700 font-semibold">Click to upload MRCP {partLabel} JSON file</div>
                  <div className="text-gray-400 text-sm mt-1">or paste JSON below</div>
                  <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
                </div>

                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-gray-400 text-sm font-medium">OR paste JSON</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>

                <textarea
                  value={jsonText}
                  onChange={(e) => { setJsonText(e.target.value); setJsonError(''); setJsonSuccess(''); }}
                  placeholder={`Paste MRCP ${partLabel} questions JSON array here...\n\nExample:\n[\n  {\n    "id": "mrcp${isPart1 ? '1' : '2'}_q001",\n    "system": "Cardiology",\n    "topic": "Heart Failure",\n    "year": "2023",\n    "difficulty": "Medium",\n    "stem": "A patient presents with...",\n    "options": [\n      { "id": "A", "text": "Option A" },\n      ...\n    ],\n    "correctAnswer": "A",\n    "explanation": "..."\n  }\n]`}
                  rows={12}
                  className={`w-full border border-gray-300 rounded-xl p-4 font-mono text-sm focus:outline-none focus:ring-2 ${ring} resize-y bg-gray-50`}
                />

                {jsonError && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="font-semibold text-red-700 mb-1">Validation Failed</div>
                    <pre className="text-red-600 text-xs whitespace-pre-wrap">{jsonError}</pre>
                  </div>
                )}
                {jsonSuccess && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 font-semibold">{jsonSuccess}</div>
                )}

                {/* Force Update toggle */}
                <label className="flex items-center gap-3 mt-4 cursor-pointer select-none w-fit">
                  <div
                    onClick={() => setForceUpsert(v => !v)}
                    className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 flex items-center px-1 ${forceUpsert ? 'bg-amber-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${forceUpsert ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700 text-sm">Force Update (Upsert)</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Allow overwriting questions that already exist — use this when re-uploading reformatted explanations
                    </p>
                  </div>
                </label>

                <div className="flex gap-3 mt-4">
                  <button onClick={handleMrcpImport} className={`${color} text-white px-6 py-3 rounded-xl font-bold transition shadow`}>
                    {partIcon} {forceUpsert ? 'Force Update' : 'Validate & Import'} as MRCP {partLabel}
                  </button>
                  <button onClick={() => { setJsonText(''); setJsonError(''); setJsonSuccess(''); }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition">
                    Clear
                  </button>
                </div>
              </div>

              {/* Import Rules */}
              <div className={`${isPart1 ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'} border rounded-2xl p-6`}>
                <h3 className={`font-bold mb-3 ${isPart1 ? 'text-blue-900' : 'text-emerald-900'}`}>📋 MRCP {partLabel} Import Rules</h3>
                <ul className={`space-y-2 text-sm ${isPart1 ? 'text-blue-800' : 'text-emerald-800'}`}>
                  <li className="flex items-start gap-2"><span className="font-bold mt-0.5">•</span> <code className="bg-white/60 px-1 rounded">part</code> is <strong>auto-set to "{partLabel}"</strong> — no need to include</li>
                  <li className="flex items-start gap-2"><span className="font-bold mt-0.5">•</span> <code className="bg-white/60 px-1 rounded">source</code> is auto-set to "Custom" (MRCP native)</li>
                  <li className="flex items-start gap-2"><span className="font-bold mt-0.5">•</span> <code className="bg-white/60 px-1 rounded">system</code> must match one of the valid MRCP {partLabel} systems</li>
                  <li className="flex items-start gap-2"><span className="font-bold mt-0.5">•</span> <code className="bg-white/60 px-1 rounded">difficulty</code> must be "Easy", "Medium", or "Hard"</li>
                  <li className="flex items-start gap-2"><span className="font-bold mt-0.5">•</span> <code className="bg-white/60 px-1 rounded">options</code> — array with {`{ id, text }`} (A–E)</li>
                  <li className="flex items-start gap-2"><span className="font-bold mt-0.5">•</span> Optional: <code className="bg-white/60 px-1 rounded">topic</code>, <code className="bg-white/60 px-1 rounded">year</code>, <code className="bg-white/60 px-1 rounded">reference</code>, <code className="bg-white/60 px-1 rounded">tags</code>, <code className="bg-white/60 px-1 rounded">imageUrl</code></li>
                </ul>
              </div>
            </div>
          );
        })()}

        {/* ── PM/PT PART-SPECIFIC UPLOAD TABS ── */}
        {(tab === 'upload-pm1' || tab === 'upload-pm2' || tab === 'upload-pt1' || tab === 'upload-pt2') && (() => {
          const isPM = tab === 'upload-pm1' || tab === 'upload-pm2';
          const isPart1 = tab === 'upload-pm1' || tab === 'upload-pt1';
          const forcedSource: QBankSource = isPM ? 'Passmedicine' : 'Pastest';
          const forcedPart: MRCPPart = isPart1 ? 'Part 1' : 'Part 2';
          const srcColor = isPM ? 'bg-violet-600 hover:bg-violet-700' : 'bg-teal-600 hover:bg-teal-700';
          const srcBorder = isPM ? 'border-violet-400' : 'border-teal-400';
          const srcRing = isPM ? 'focus:ring-violet-500' : 'focus:ring-teal-500';
          const srcBadge = isPM ? 'bg-violet-100 text-violet-700' : 'bg-teal-100 text-teal-700';
          const srcIcon = isPM ? '🟣' : '🟢';
          const partIcon = isPart1 ? '📘' : '📗';
          const handleImport = async () => {
            setJsonError(''); setJsonSuccess('');
            if (!jsonText.trim()) { setJsonError('JSON input is empty.'); return; }
            let parsed: any;
            try { parsed = JSON.parse(jsonText); }
            catch (e: any) { setJsonError(`❌ JSON Parse Error: ${e.message}`); return; }
            const arr: any[] = Array.isArray(parsed) ? parsed : [parsed];
            const errors: string[] = [];
            const validated: Question[] = [];
            arr.forEach((item, i) => {
              const prefix = `Q[${i + 1}]`;
              if (!item.id) errors.push(`${prefix}: missing "id"`);
              if (!item.system || !SYSTEMS.includes(item.system)) errors.push(`${prefix}: invalid or missing "system"`);
              if (!item.stem) errors.push(`${prefix}: missing "stem"`);
              if (!Array.isArray(item.options) || item.options.length < 2) errors.push(`${prefix}: "options" must be an array of at least 2`);
              if (!item.correctAnswer) errors.push(`${prefix}: missing "correctAnswer"`);
              // explanation optional — legacy questions may have none
              if (!['Easy', 'Medium', 'Hard'].includes(item.difficulty)) errors.push(`${prefix}: "difficulty" must be Easy, Medium, or Hard`);
              if (errors.filter((e) => e.startsWith(prefix)).length === 0) {
                validated.push({
                  id: String(item.id), part: forcedPart, system: item.system,
                  topic: item.topic ?? '', year: item.year ?? '',
                  difficulty: item.difficulty ?? 'Medium', source: forcedSource,
                  stem: item.stem, options: item.options,
                  correctAnswer: String(item.correctAnswer), explanation: item.explanation || 'Explanation not yet available.',
                  reference: item.reference ?? '', tags: Array.isArray(item.tags) ? item.tags : [],
                  imageUrl: item.imageUrl ?? '', imageType: item.imageType ?? undefined, imageCaption: item.imageCaption ?? '',
                });
              }
            });
            if (errors.length > 0) { setJsonError('❌ Validation Errors:\n' + errors.join('\n')); return; }
            const existingIds = new Set(questions.map((q) => q.id));
            const duplicates = validated.filter((q) => existingIds.has(q.id));
            if (duplicates.length > 0) { setJsonError(`⚠️ Duplicate IDs: ${duplicates.map((d) => d.id).join(', ')}`); return; }
            setJsonSuccess(`⏳ Uploading ${validated.length} ${forcedSource} ${forcedPart} questions to Supabase…`);
            try {
              await addQuestionsToSupabase(validated);
              // Verify: count matching rows in Supabase
              const verifiedCount = await verifyUploadInSupabase(forcedSource, forcedPart);
              await refresh();
              onDataChange?.();
              setJsonText('');
              setJsonSuccess(
                `✅ Uploaded ${validated.length} question(s) to Supabase!\n` +
                `🔍 Verified: Supabase now has ${verifiedCount} total ${forcedSource} ${forcedPart} question(s).`
              );
            } catch (err: any) {
              setJsonError(`❌ Supabase upload failed: ${err.message ?? String(err)}\n\nCheck the Admin Panel → Diagnostics tab for details.`);
            }
          };
          return (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{srcIcon}</span>
                  <span className="text-2xl">{partIcon}</span>
                  <h2 className="text-xl font-bold text-gray-800">Upload {forcedSource} {forcedPart} Questions</h2>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${srcBadge}`}>{forcedSource} · {forcedPart}</span>
                </div>
                <p className="text-gray-500 text-sm mb-4">
                  All questions will be tagged as <strong>{forcedSource}</strong>, <strong>{forcedPart}</strong> automatically.
                </p>
                <div onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed ${srcBorder} hover:opacity-80 rounded-2xl p-8 text-center cursor-pointer transition mb-4 group`}>
                  <div className="text-4xl mb-2">{srcIcon}</div>
                  <div className="text-gray-700 font-semibold">Click to upload JSON file</div>
                  <div className="text-gray-400 text-sm mt-1">or paste JSON below</div>
                  <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
                </div>
                <textarea value={jsonText} onChange={(e) => { setJsonText(e.target.value); setJsonError(''); setJsonSuccess(''); }}
                  placeholder={`Paste ${forcedSource} ${forcedPart} JSON here...\nNote: "part" and "source" are auto-set — no need to include them.`}
                  rows={12} className={`w-full border border-gray-300 rounded-xl p-4 font-mono text-sm focus:outline-none focus:ring-2 ${srcRing} resize-y bg-gray-50`} />
                {jsonError && <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4"><pre className="text-red-600 text-xs whitespace-pre-wrap">{jsonError}</pre></div>}
                {jsonSuccess && <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 font-semibold">{jsonSuccess}</div>}
                <div className="flex gap-3 mt-4">
                  <button onClick={handleImport} className={`${srcColor} text-white px-6 py-3 rounded-xl font-bold transition shadow`}>
                    {srcIcon} Validate & Import
                  </button>
                  <button onClick={() => { setJsonText(''); setJsonError(''); setJsonSuccess(''); }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition">Clear</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── QBANK UPLOAD TABS (Custom only now) ── */}
        {(tab === 'upload-custom') && (() => {
          const sourceMap: Record<string, { source: QBankSource; color: string; border: string; ring: string; badge: string; desc: string }> = {
            'upload-custom': {
              source: 'Custom',
              color: 'bg-amber-500 hover:bg-amber-600',
              border: 'border-amber-400',
              ring: 'focus:ring-amber-500',
              badge: 'bg-amber-100 text-amber-700',
              desc: 'Questions tagged as Custom. You may also include a "source" field in your JSON to override.',
            },
          };
          const cfg = sourceMap['upload-custom'];
          return (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{QBANK_SOURCE_ICONS[cfg.source]}</span>
                  <h2 className="text-xl font-bold text-gray-800">Upload {cfg.source} Questions</h2>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${cfg.badge}`}>{cfg.source}</span>
                </div>
                <p className="text-gray-500 text-sm mb-4">{cfg.desc}</p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <span className="text-amber-500 text-lg">⚠️</span>
                  <div className="text-sm text-amber-800">
                    <strong>Important:</strong> Each question must have a <code className="bg-amber-100 px-1 rounded">part</code> field set to either <strong>"Part 1"</strong> or <strong>"Part 2"</strong>.
                  </div>
                </div>
                <div onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed ${cfg.border} hover:opacity-80 rounded-2xl p-8 text-center cursor-pointer transition mb-4 group`}>
                  <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📁</div>
                  <div className="text-gray-700 font-semibold">Click to upload {cfg.source} JSON file</div>
                  <div className="text-gray-400 text-sm mt-1">or paste JSON below</div>
                  <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
                </div>
                <textarea value={jsonText} onChange={(e) => { setJsonText(e.target.value); setJsonError(''); setJsonSuccess(''); }}
                  placeholder={`Paste your ${cfg.source} JSON array here...`}
                  rows={12} className={`w-full border border-gray-300 rounded-xl p-4 font-mono text-sm focus:outline-none focus:ring-2 ${cfg.ring} resize-y bg-gray-50`} />
                {jsonError && <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4"><pre className="text-red-600 text-xs whitespace-pre-wrap">{jsonError}</pre></div>}
                {jsonSuccess && <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 font-semibold">{jsonSuccess}</div>}
                <div className="flex gap-3 mt-4">
                  <button onClick={() => validateAndImport(jsonText, cfg.source)}
                    className={`${cfg.color} text-white px-6 py-3 rounded-xl font-bold transition shadow`}>
                    ✅ Validate & Import as {cfg.source}
                  </button>
                  <button onClick={() => { setJsonText(''); setJsonError(''); setJsonSuccess(''); }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition">Clear</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── OLD PASSMEDICINE/PASTEST STUB (kept for any leftover rendering) ── */}
        {false && (tab === 'upload-passmedicine' || tab === 'upload-pastest') && (() => {
          const sourceMap: Record<string, { source: QBankSource; color: string; border: string; ring: string; badge: string; desc: string }> = {
            'upload-passmedicine': {
              source: 'Passmedicine',
              color: 'bg-violet-600 hover:bg-violet-700',
              border: 'border-violet-400',
              ring: 'focus:ring-violet-500',
              badge: 'bg-violet-100 text-violet-700',
              desc: 'All questions will be tagged as Passmedicine source.',
            },
            'upload-pastest': {
              source: 'Pastest',
              color: 'bg-teal-600 hover:bg-teal-700',
              border: 'border-teal-400',
              ring: 'focus:ring-teal-500',
              badge: 'bg-teal-100 text-teal-700',
              desc: 'All questions will be tagged as Pastest source.',
            },
            'upload-custom': {
              source: 'Custom',
              color: 'bg-amber-500 hover:bg-amber-600',
              border: 'border-amber-400',
              ring: 'focus:ring-amber-500',
              badge: 'bg-amber-100 text-amber-700',
              desc: 'Questions tagged as Custom. You may also include a "source" field in your JSON to override.',
            },
          };
          const cfg = sourceMap[tab];
          return (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{QBANK_SOURCE_ICONS[cfg.source]}</span>
                  <h2 className="text-xl font-bold text-gray-800">Upload {cfg.source} Questions</h2>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${cfg.badge}`}>{cfg.source}</span>
                </div>
                <p className="text-gray-500 text-sm mb-4">{cfg.desc}</p>

                {/* Part reminder */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <span className="text-amber-500 text-lg">⚠️</span>
                  <div className="text-sm text-amber-800">
                    <strong>Important:</strong> Each question must have a <code className="bg-amber-100 px-1 rounded">part</code> field set to either <strong>"Part 1"</strong> or <strong>"Part 2"</strong>.
                    Part 1 supports Biostatistics; Part 2 does not.
                  </div>
                </div>

                {/* File Upload */}
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed ${cfg.border} hover:opacity-80 rounded-2xl p-8 text-center cursor-pointer transition mb-4 group`}
                >
                  <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📁</div>
                  <div className="text-gray-700 font-semibold">Click to upload {cfg.source} JSON file</div>
                  <div className="text-gray-400 text-sm mt-1">or paste JSON below</div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-gray-400 text-sm font-medium">OR paste JSON</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>

                <textarea
                  value={jsonText}
                  onChange={(e) => { setJsonText(e.target.value); setJsonError(''); setJsonSuccess(''); }}
                  placeholder={`Paste your ${cfg.source} JSON array here...\n\nExample:\n[\n  {\n    "id": "q_001",\n    "part": "Part 1",\n    "system": "Cardiology",\n    ...\n  }\n]`}
                  rows={12}
                  className={`w-full border border-gray-300 rounded-xl p-4 font-mono text-sm focus:outline-none focus:ring-2 ${cfg.ring} resize-y bg-gray-50`}
                />

                {jsonError && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="font-semibold text-red-700 mb-1">Validation Failed</div>
                    <pre className="text-red-600 text-xs whitespace-pre-wrap">{jsonError}</pre>
                  </div>
                )}
                {jsonSuccess && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 font-semibold">
                    {jsonSuccess}
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => validateAndImport(jsonText, cfg.source)}
                    className={`${cfg.color} text-white px-6 py-3 rounded-xl font-bold transition shadow`}
                  >
                    ✅ Validate & Import as {cfg.source}
                  </button>
                  <button
                    onClick={() => { setJsonText(''); setJsonError(''); setJsonSuccess(''); }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Import Rules */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                <h3 className="font-bold text-blue-900 mb-3">📋 Import Rules & Validation</h3>
                <ul className="space-y-2 text-blue-800 text-sm">
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> JSON must be an array <code className="bg-blue-100 px-1 rounded">[ ]</code> or a single object</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> Each question needs a unique <code className="bg-blue-100 px-1 rounded">id</code> — duplicates will be rejected</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> <code className="bg-blue-100 px-1 rounded">part</code> must be <strong>"Part 1"</strong> or <strong>"Part 2"</strong></li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> <code className="bg-blue-100 px-1 rounded">system</code> must exactly match one of the valid MRCP systems</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> <code className="bg-blue-100 px-1 rounded">difficulty</code> must be "Easy", "Medium", or "Hard"</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> <code className="bg-blue-100 px-1 rounded">options</code> must be an array with <code className="bg-blue-100 px-1 rounded">{"{ id, text }"}</code></li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> <code className="bg-blue-100 px-1 rounded">correctAnswer</code> must match one of the option ids (A–E)</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> Source is forced to <strong>{cfg.source}</strong> — no need to include it in JSON</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> Optional fields: <code className="bg-blue-100 px-1 rounded">topic</code>, <code className="bg-blue-100 px-1 rounded">year</code>, <code className="bg-blue-100 px-1 rounded">reference</code>, <code className="bg-blue-100 px-1 rounded">tags</code></li>
                </ul>
              </div>
            </div>
          );
        })()}

        {/* ── TEXTBOOKS TAB ── */}
        {tab === 'textbooks' && (
          <div className="space-y-6">
            {/* Add Textbook Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📚 Add Passmedicine Textbook</h2>
              <p className="text-gray-500 text-sm mb-5">
                Paste a publicly accessible PDF URL (from Supabase Storage, Google Drive, OneDrive, etc.).
                Students can read, annotate and take notes.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">MRCP Part *</label>
                  <div className="flex gap-2">
                    {(['Part 1', 'Part 2'] as const).map((p) => (
                      <button key={p} onClick={() => setTbPart(p)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition border-2 ${
                          tbPart === p ? (p === 'Part 1' ? 'bg-blue-600 text-white border-blue-600' : 'bg-emerald-600 text-white border-emerald-600')
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-violet-300'
                        }`}>
                        {p === 'Part 1' ? '📘' : '📗'} {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
                  <input type="text" value={tbTitle} onChange={(e) => setTbTitle(e.target.value)}
                    placeholder="e.g. Passmedicine Complete MRCP Notes Part 1"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">PDF URL *</label>
                <input type="url" value={tbUrl} onChange={(e) => setTbUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/xxx/view or https://supabase.co/storage/v1/..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <p className="text-xs text-gray-400 mt-1">💡 Google Drive: share → copy link. Make sure "Anyone with link can view" is enabled.</p>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description (optional)</label>
                <input type="text" value={tbDesc} onChange={(e) => setTbDesc(e.target.value)}
                  placeholder="e.g. Comprehensive notes covering all Part 1 systems"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              {tbMsg && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-semibold ${tbMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {tbMsg}
                </div>
              )}
              <button onClick={handleAddTextbook}
                className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-bold transition shadow">
                📚 Add Textbook
              </button>
            </div>

            {/* Textbook List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 text-lg mb-4">Existing Textbooks ({textbooks.length})</h3>
              {textbooks.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-3">📚</div>
                  <div className="font-semibold">No textbooks added yet</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(['Part 1', 'Part 2'] as const).map((part) => {
                    const partBooks = textbooks.filter((t) => t.part === part);
                    if (partBooks.length === 0) return null;
                    return (
                      <div key={part}>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                          {part === 'Part 1' ? '📘' : '📗'} Passmedicine {part}
                        </div>
                        {partBooks.map((tb) => (
                          <div key={tb.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-800 text-sm truncate">{tb.title}</div>
                              {tb.description && <div className="text-xs text-gray-400 truncate">{tb.description}</div>}
                              <div className="text-xs text-gray-300 mt-0.5 font-mono truncate">{tb.pdfUrl}</div>
                            </div>
                            <div className="flex gap-2 ml-3 flex-shrink-0">
                              <a href={tb.pdfUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 px-3 py-1.5 rounded-lg transition font-semibold">
                                🔗 Open
                              </a>
                              <button onClick={() => setTbDeleteConfirm(tb.id)}
                                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition font-semibold">
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ONE-LINERS TAB ── */}
        {tab === 'oneliners' && (
          <div className="space-y-6">
            {/* Import */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">💡 Upload One-Liners / Clinical Pearls</h2>
              <p className="text-gray-500 text-sm mb-4">
                Import one-liners as a JSON array. Students can browse them in flashcard or list mode.
              </p>

              {/* Source selector */}
              <div className="flex gap-2 mb-4">
                {(['Passmedicine', 'Pastest'] as OneLinerSource[]).map((s) => (
                  <button key={s} onClick={() => setOlSource(s)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition border-2 ${
                      olSource === s
                        ? s === 'Passmedicine' ? 'bg-violet-600 text-white border-violet-600' : 'bg-teal-600 text-white border-teal-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-violet-300'
                    }`}>
                    {s === 'Passmedicine' ? '🟣' : '🟢'} {s}
                    <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded-full">
                      {liners.filter(l => l.source === s).length}
                    </span>
                  </button>
                ))}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-xs text-gray-600">
                <strong>JSON format:</strong><br/>
                <code className="font-mono">{`[{ "id": "ol_001", "system": "Cardiology", "part": "Part 1", "content": "One-liner text...", "explanation": "Why?", "topic": "Heart Failure", "tags": ["HF"] }]`}</code><br/>
                <span className="text-gray-400">• <code>part</code>: "Part 1" | "Part 2" | "Both" • <code>source</code> is auto-set to {olSource}</span>
              </div>

              <textarea value={olJson} onChange={(e) => { setOlJson(e.target.value); setOlMsg(''); setOlError(''); }}
                placeholder={`Paste ${olSource} one-liners JSON here...`}
                rows={12} className="w-full border border-gray-300 rounded-xl p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y bg-gray-50 mb-4" />

              {olError && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"><pre className="whitespace-pre-wrap text-xs">{olError}</pre></div>}
              {olMsg && <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">{olMsg}</div>}

              <div className="flex gap-3">
                <button onClick={handleOneLinerImport}
                  className={`${olSource === 'Passmedicine' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-teal-600 hover:bg-teal-700'} text-white px-6 py-3 rounded-xl font-bold transition shadow`}>
                  {olSource === 'Passmedicine' ? '🟣' : '🟢'} Import {olSource} One-Liners
                </button>
                <button onClick={() => { setOlJson(''); setOlMsg(''); setOlError(''); }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition">Clear</button>
              </div>
            </div>

            {/* Summary & Clear */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 text-lg mb-4">One-Liner Database ({liners.length} total)</h3>
              <div className="grid grid-cols-2 gap-4 mb-5">
                {(['Passmedicine', 'Pastest'] as OneLinerSource[]).map((s) => {
                  const count = liners.filter(l => l.source === s).length;
                  return (
                    <div key={s} className={`p-4 rounded-xl border ${s === 'Passmedicine' ? 'bg-violet-50 border-violet-200' : 'bg-teal-50 border-teal-200'}`}>
                      <div className="text-2xl font-extrabold mb-0.5">{count}</div>
                      <div className="text-sm font-semibold text-gray-700">{s === 'Passmedicine' ? '🟣' : '🟢'} {s}</div>
                      <button onClick={() => setOlClearConfirm(s)}
                        className="mt-2 text-xs text-red-500 hover:text-red-700 font-semibold transition">
                        🗑️ Clear all {s}
                      </button>
                    </div>
                  );
                })}
              </div>
              {/* System breakdown */}
              {liners.length > 0 && (() => {
                const bySystem: Record<string, number> = {};
                liners.forEach(l => { bySystem[l.system] = (bySystem[l.system] ?? 0) + 1; });
                const entries = Object.entries(bySystem).sort((a, b) => b[1] - a[1]);
                return (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Breakdown by system</p>
                    <div className="flex flex-wrap gap-2">
                      {entries.map(([sys, n]) => (
                        <span key={sys} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">
                          {sys}: <strong>{n}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── MANAGE QUESTIONS TAB ── */}
        {tab === 'manage' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchAdmin}
                  onChange={(e) => setSearchAdmin(e.target.value)}
                  placeholder="Search questions..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>
              {/* Part filter */}
              <div className="flex items-center gap-2">
                {(['All', 'Part 1', 'Part 2'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPartFilter(p)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                      partFilter === p
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                    }`}
                  >
                    {p === 'Part 1' ? '📘 ' : p === 'Part 2' ? '📗 ' : ''}{p}
                  </button>
                ))}
              </div>
              {/* Source filter */}
              <div className="flex items-center gap-2 flex-wrap">
                {(['All', ...QBANK_SOURCES, 'NoSource'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSourceFilter(s as any)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold transition border ${
                      sourceFilter === s
                        ? s === 'Passmedicine' ? 'bg-violet-600 text-white border-violet-600'
                          : s === 'Pastest' ? 'bg-teal-600 text-white border-teal-600'
                          : s === 'Custom' ? 'bg-gray-600 text-white border-gray-600'
                          : s === 'NoSource' ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                    }`}
                  >
                    {s === 'Passmedicine' ? '🟣 ' : s === 'Pastest' ? '🟢 ' : s === 'Custom' ? '⚙️ ' : s === 'NoSource' ? '⚠️ ' : ''}{s === 'NoSource' ? 'No Source' : s}
                  </button>
                ))}
              </div>
              <div className="text-sm text-gray-500 flex items-center px-2">{filtered.length} questions</div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="text-5xl mb-4">📭</div>
                <div className="text-lg font-semibold">No questions found</div>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((q) => (
                  <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${q.part === 'Part 1' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {q.part === 'Part 1' ? '📘' : '📗'} {q.part}
                          </span>
                          {q.source && (
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${QBANK_SOURCE_COLORS[q.source]}`}>
                              {QBANK_SOURCE_ICONS[q.source]} {q.source}
                            </span>
                          )}
                          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{q.system}</span>
                          <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-0.5 rounded-full">{q.topic || 'No topic'}</span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full ${q.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : q.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {q.difficulty}
                          </span>
                          {q.year && <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-0.5 rounded-full">{q.year}</span>}
                          {q.imageType && (
                            <span className="bg-gray-800 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">🖼️ {q.imageType}</span>
                          )}
                           <span className="bg-gray-50 text-gray-400 text-xs px-2.5 py-0.5 rounded-full border border-gray-200 font-mono">{q.id}</span>
                         </div>
                         <p className="text-gray-800 text-sm line-clamp-2">{q.stem.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/\|[^|]*\|/g,'').replace(/\s+/g,' ').trim()}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setEditingQ(q)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-xs font-semibold transition"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(q.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg text-xs font-semibold transition"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MANUAL ADD TAB ── */}
        {tab === 'manual' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-xl font-bold text-gray-800">✏️ Add Question Manually</h2>

            {/* Part + System Row */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">MRCP Part *</label>
                <select
                  value={newQ.part}
                  onChange={(e) => setNewQ({ ...newQ, part: e.target.value as MRCPPart, system: e.target.value === 'Part 1' ? 'Cardiology' : 'Cardiology' })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Part 1">📘 Part 1</option>
                  <option value="Part 2">📗 Part 2</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">QBank Source *</label>
                <select
                  value={newQ.source ?? 'Custom'}
                  onChange={(e) => setNewQ({ ...newQ, source: e.target.value as QBankSource })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Passmedicine">🟣 Passmedicine</option>
                  <option value="Pastest">🟢 Pastest</option>
                  <option value="Custom">⚙️ Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">System *</label>
                <select
                  value={newQ.system}
                  onChange={(e) => setNewQ({ ...newQ, system: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {manualSystems.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Topic</label>
                <input
                  type="text"
                  value={newQ.topic}
                  onChange={(e) => setNewQ({ ...newQ, topic: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. Heart Failure"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Year</label>
                <input
                  type="text"
                  value={newQ.year}
                  onChange={(e) => setNewQ({ ...newQ, year: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. 2023"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Difficulty *</label>
                <select
                  value={newQ.difficulty}
                  onChange={(e) => setNewQ({ ...newQ, difficulty: e.target.value as Difficulty })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={Array.isArray(newQ.tags) ? newQ.tags.join(', ') : newQ.tags}
                  onChange={(e) => setNewQ({ ...newQ, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. HFrEF, Beta-blocker"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Question Stem *
                <span className="ml-2 text-xs font-normal text-gray-400">Supports tables, **bold**, *italic*, - bullets (see Template tab)</span>
              </label>
              <textarea
                value={newQ.stem}
                onChange={(e) => setNewQ({ ...newQ, stem: e.target.value })}
                rows={6}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y font-mono"
                placeholder={`A 68-year-old man presents with fatigue. His results are shown below:

| Investigation | Result | Reference Range |
|---|---|---|
| Haemoglobin | 7.2 g/dL | 13.5–17.5 g/dL |
| MCV | 68 fL | 80–100 fL |

What is the most likely diagnosis?`}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Options * (A–E) — click radio to mark correct</label>
              <div className="space-y-2">
                {newQ.options.map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      newQ.correctAnswer === opt.id ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>{opt.id}</div>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => {
                        const opts = [...newQ.options];
                        opts[i] = { ...opts[i], text: e.target.value };
                        setNewQ({ ...newQ, options: opts });
                      }}
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={`Option ${opt.id}`}
                    />
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={newQ.correctAnswer === opt.id}
                      onChange={() => setNewQ({ ...newQ, correctAnswer: opt.id })}
                      className="w-4 h-4 accent-green-500"
                      title="Mark as correct"
                    />
                    <span className="text-xs text-gray-400">Correct</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Explanation *
                <span className="ml-2 text-xs font-normal text-gray-400">Supports tables, **bold**, *italic*, - bullets</span>
              </label>
              <textarea
                value={newQ.explanation}
                onChange={(e) => setNewQ({ ...newQ, explanation: e.target.value })}
                rows={4}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                placeholder="Detailed explanation of why the answer is correct..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Reference</label>
              <input
                type="text"
                value={newQ.reference}
                onChange={(e) => setNewQ({ ...newQ, reference: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. NICE NG136, ESC Guidelines 2021"
              />
            </div>

            {/* ── Image Section ── */}
            <div className="border border-dashed border-gray-300 rounded-2xl p-5 bg-gray-50 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🖼️</span>
                <h3 className="font-bold text-gray-700">Image Attachment <span className="text-gray-400 font-normal text-xs">(Optional — ECG, X-Ray, Histology, etc.)</span></h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={newQ.imageUrl ?? ''}
                    onChange={(e) => setNewQ({ ...newQ, imageUrl: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="https://example.com/ecg.png"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Image Type</label>
                  <select
                    value={newQ.imageType ?? ''}
                    onChange={(e) => setNewQ({ ...newQ, imageType: (e.target.value || undefined) as ImageType | undefined })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">— Select type —</option>
                    {IMAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Image Caption</label>
                <input
                  type="text"
                  value={newQ.imageCaption ?? ''}
                  onChange={(e) => setNewQ({ ...newQ, imageCaption: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. 12-lead ECG showing ST elevation in V1–V4"
                />
              </div>
              {/* Live preview */}
              {newQ.imageUrl && newQ.imageUrl.startsWith('http') && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">Preview:</p>
                  <QuestionImage
                    imageUrl={newQ.imageUrl}
                    imageType={newQ.imageType}
                    imageCaption={newQ.imageCaption}
                  />
                </div>
              )}
            </div>

            {newQError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm font-medium">{newQError}</div>
            )}
            {newQSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm font-semibold">{newQSuccess}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleAddManual}
                className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold transition shadow"
              >
                ➕ Add Question
              </button>
              <button
                onClick={() => { setNewQ({ ...EMPTY_Q, part: newQ.part }); setNewQError(''); setNewQSuccess(''); }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ── JSON TEMPLATE TAB ── */}
        {tab === 'template' && (
          <div className="space-y-6">
            {/* Rich Text Formatting Guide */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">✏️ Rich Text Formatting Guide</h2>
              <p className="text-gray-500 text-sm mb-5">
                The <strong>stem</strong> and <strong>explanation</strong> fields support rich text formatting.
                Use these patterns directly in your JSON strings (use <code className="font-mono bg-gray-100 px-1 rounded">\\n</code> for newlines in JSON).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Tables */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="font-bold text-slate-800 mb-2 flex items-center gap-2">🗃️ Lab / Data Tables</div>
                  <pre className="text-xs font-mono text-slate-600 whitespace-pre overflow-x-auto leading-relaxed">{`| Investigation | Result | Range |
|---|---|---|
| Haemoglobin | 7.2 g/dL | 13.5–17.5 |
| MCV | 68 fL | 80–100 |
| Ferritin | 4 µg/L | 12–300 |`}</pre>
                  <div className="text-xs text-slate-500 mt-2">In JSON: replace each newline with <code className="bg-white px-1 rounded">\\n</code></div>
                </div>
                {/* Bold/italic */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="font-bold text-slate-800 mb-2 flex items-center gap-2">🔤 Inline Formatting</div>
                  <div className="space-y-1.5 text-xs font-mono text-slate-600">
                    <div><span className="text-slate-400">**bold text**</span> → <strong>bold text</strong></div>
                    <div><span className="text-slate-400">*italic text*</span> → <em>italic text</em></div>
                    <div><span className="text-slate-400">`inline code`</span> → <code className="bg-white px-1 rounded border border-slate-200">inline code</code></div>
                  </div>
                </div>
                {/* Bullets */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="font-bold text-slate-800 mb-2 flex items-center gap-2">• Bullet Lists</div>
                  <pre className="text-xs font-mono text-slate-600 whitespace-pre leading-relaxed">{`- First finding
- Second finding
- Third finding`}</pre>
                </div>
                {/* Numbered */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="font-bold text-slate-800 mb-2 flex items-center gap-2">1. Numbered Lists</div>
                  <pre className="text-xs font-mono text-slate-600 whitespace-pre leading-relaxed">{`1. First step
2. Second step
3. Third step`}</pre>
                </div>
              </div>
              {/* Column alignment */}
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                <strong>Table column alignment:</strong>{' '}
                <code className="bg-white px-1 rounded mx-0.5">|---|</code> = left (default) ·
                <code className="bg-white px-1 rounded mx-0.5">|:---:|</code> = center ·
                <code className="bg-white px-1 rounded mx-0.5">|---:|</code> = right
                <br />
                <strong>In JSON strings,</strong> use <code className="bg-white px-1 rounded">\n</code> for line breaks within stem/explanation.
                Use a blank line (<code className="bg-white px-1 rounded">\n\n</code>) to separate the table from surrounding text.
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">📄 JSON Template & Format Guide</h2>
                <button
                  onClick={() => { navigator.clipboard.writeText(SAMPLE_JSON); }}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-700 px-4 py-2 rounded-xl text-sm font-semibold transition"
                >
                  📋 Copy Template
                </button>
              </div>
              <pre className="bg-gray-900 text-green-400 rounded-xl p-5 text-xs overflow-x-auto font-mono leading-relaxed whitespace-pre">
                {SAMPLE_JSON}
              </pre>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 text-lg mb-4">📝 Field Reference</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Field', 'Type', 'Required', 'Description', 'Example'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                       ['id', 'string', '✅ Yes', 'Unique question identifier', '"q_001"'],
                       ['part', 'string', '✅ Yes', '"Part 1" or "Part 2"', '"Part 1"'],
                       ['system', 'string', '✅ Yes', 'Must match a valid MRCP system', '"Cardiology"'],
                       ['source', 'string', '❌ No', 'Passmedicine | Pastest | Custom (auto-set by upload tab)', '"Passmedicine"'],
                       ['topic', 'string', '❌ No', 'Sub-topic within system', '"Heart Failure"'],
                       ['year', 'string', '❌ No', 'Past paper year', '"2023"'],
                       ['difficulty', 'string', '✅ Yes', 'Easy | Medium | Hard', '"Medium"'],
                       ['stem', 'string', '✅ Yes', 'Full question text/clinical scenario', '"A 68-year-old..."'],
                       ['options', 'array', '✅ Yes', 'Array of {id, text} objects', '[{"id":"A","text":"..."}]'],
                       ['correctAnswer', 'string', '✅ Yes', 'The correct option id', '"C"'],
                       ['explanation', 'string', '✅ Yes', 'Detailed teaching explanation', '"Beta-blockers..."'],
                       ['reference', 'string', '❌ No', 'Guideline / textbook reference', '"NICE NG136"'],
                       ['tags', 'string[]', '❌ No', 'Keywords for search/filter', '["HFrEF","Beta-blocker"]'],
                       ['imageUrl', 'string', '❌ No', 'Direct URL to image (ECG/X-Ray/etc.)', '"https://example.com/ecg.png"'],
                       ['imageType', 'string', '❌ No', 'ECG | X-Ray | CT Scan | MRI | Histology | Blood Film | Fundoscopy | Dermatology | Echo | Other', '"ECG"'],
                       ['imageCaption', 'string', '❌ No', 'Descriptive caption shown under image', '"12-lead ECG showing ST elevation"'],
                     ].map(([field, type, req, desc, ex]) => (
                      <tr key={field} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-blue-700 font-semibold">{field}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{type}</td>
                        <td className="px-4 py-3">{req}</td>
                        <td className="px-4 py-3 text-gray-600">{desc}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[160px]">{ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Valid systems split by part */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 text-lg mb-3 flex items-center gap-2">📘 Part 1 Systems</h3>
                <div className="flex flex-wrap gap-2">
                  {PART1_SYSTEMS.map((s) => (
                    <span key={s} className="bg-sky-50 border border-sky-200 text-sky-700 text-xs font-mono px-3 py-1.5 rounded-full">
                      "{s}"
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 text-lg mb-3 flex items-center gap-2">📗 Part 2 Systems</h3>
                <div className="flex flex-wrap gap-2">
                  {PART2_SYSTEMS.map((s) => (
                    <span key={s} className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono px-3 py-1.5 rounded-full">
                      "{s}"
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DIAGNOSTICS TAB ── */}
        {tab === 'diagnostics' && (
          <div className="space-y-6">

            {/* ── STEP 1: SQL MIGRATION (shown when schema is broken or not checked) ── */}
            {schemaOk !== true && (
              <div className={`rounded-2xl border-2 p-6 ${schemaOk === false ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-300'}`}>
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl">{schemaOk === false ? '🚨' : '⚠️'}</span>
                  <div>
                    <h2 className={`text-lg font-extrabold ${schemaOk === false ? 'text-red-800' : 'text-amber-900'}`}>
                      {schemaOk === false
                        ? 'Database Setup Required — source column is MISSING'
                        : 'Database Setup — Run Diagnostics to check schema'}
                    </h2>
                    <p className={`text-sm mt-1 ${schemaOk === false ? 'text-red-700' : 'text-amber-800'}`}>
                      {schemaOk === false
                        ? 'Your Supabase questions table is missing the source column. Uploads will fail until you run the SQL below. This also explains why all 3 618 existing questions show no source.'
                        : 'Click "Run Diagnostics" below to check if your database schema is complete.'}
                    </p>
                  </div>
                </div>

                {/* SQL Block */}
                <div className="bg-gray-950 rounded-xl p-4 mb-3 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Supabase SQL Editor → paste & run</span>
                    <button
                      onClick={() => {
                        const sql = `-- Run in Supabase Dashboard → SQL Editor\n\n-- Step 1: Add all missing columns\nALTER TABLE questions ADD COLUMN IF NOT EXISTS source text;\nALTER TABLE questions ADD COLUMN IF NOT EXISTS year text;\nALTER TABLE questions ADD COLUMN IF NOT EXISTS topic text;\nALTER TABLE questions ADD COLUMN IF NOT EXISTS reference text;\nALTER TABLE questions ADD COLUMN IF NOT EXISTS tags text[];\nALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url text;\nALTER TABLE questions ADD COLUMN IF NOT EXISTS image_type text;\nALTER TABLE questions ADD COLUMN IF NOT EXISTS image_caption text;\n\n-- Step 2: (Optional) After adding source column, label existing rows as MRCP\n-- Run the "Patch null \u2192 MRCP" button in this page instead, OR:\n-- UPDATE questions SET source = 'MRCP' WHERE source IS NULL;\n\n-- Step 3: Verify\nSELECT source, part, COUNT(*) FROM questions GROUP BY source, part ORDER BY source, part;`;
                        navigator.clipboard.writeText(sql).then(() => {
                          setSqlCopied(true);
                          setTimeout(() => setSqlCopied(false), 2500);
                        });
                      }}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    >
                      {sqlCopied ? '✅ Copied!' : '📋 Copy SQL'}
                    </button>
                  </div>
                  <pre className="text-green-400 text-xs font-mono whitespace-pre overflow-x-auto leading-relaxed">{`-- Step 1: Add all missing columns
ALTER TABLE questions ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS year text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_type text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_caption text;

-- Step 3: Verify
SELECT source, part, COUNT(*)
FROM questions
GROUP BY source, part
ORDER BY source, part;`}</pre>
                </div>

                <div className={`text-sm font-semibold ${schemaOk === false ? 'text-red-700' : 'text-amber-800'}`}>
                  👆 1. Copy the SQL above &nbsp;→&nbsp; 2. Open{' '}
                  <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">
                    supabase.com/dashboard
                  </a>
                  &nbsp;→ SQL Editor &nbsp;→ Paste &amp; Run &nbsp;→ 3. Come back and click "Run Diagnostics" to confirm ✅
                </div>
              </div>
            )}

            {/* Schema OK banner */}
            {schemaOk === true && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <div className="font-bold text-emerald-800">source column exists in Supabase</div>
                  <div className="text-sm text-emerald-700">Schema is healthy. You can now upload questions to any tab.</div>
                </div>
              </div>
            )}

            {/* ── STEP 2: PATCH NULL SOURCES ── */}
            {(schemaOk === true || questions.filter((q) => !q.source).length > 0) && (
              <div className={`rounded-2xl border p-6 ${questions.filter((q) => !q.source).length > 0 ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-100 shadow-sm'}`}>
                <h3 className="font-bold text-gray-800 mb-1">
                  {questions.filter((q) => !q.source).length > 0
                    ? `⚠️ ${questions.filter((q) => !q.source).length} questions have no source`
                    : '✅ All questions have a source'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  After running the SQL above, click the button below to label all existing sourceless questions as <strong>MRCP</strong>.
                  (Your existing 3 618 questions are MRCP questions — this sets that correctly in Supabase.)
                </p>
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    onClick={async () => {
                      setPatchLoading(true);
                      setPatchResult(null);
                      try {
                        const patched = await patchNullSourcesToMRCP();
                        const freshQs = await syncFromSupabase();
                        setQuestions(freshQs);
                        onDataChange?.();
                        setPatchResult(`✅ Patched ${patched} questions → source = 'MRCP'. Re-synced ${freshQs.length} questions from Supabase.`);
                      } catch (err: any) {
                        setPatchResult(`❌ Patch failed: ${err.message ?? err}`);
                      } finally {
                        setPatchLoading(false);
                      }
                    }}
                    disabled={patchLoading || questions.filter((q) => !q.source).length === 0}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow"
                  >
                    {patchLoading
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Patching…</>
                      : `🔧 Patch ${questions.filter((q) => !q.source).length} null → MRCP`}
                  </button>
                </div>
                {patchResult && (
                  <div className={`mt-3 text-sm font-mono p-3 rounded-xl ${patchResult.startsWith('❌') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                    {patchResult}
                  </div>
                )}

                {questions.filter((q) => !q.source).length > 0 && (
                  <div className="space-y-2 max-h-52 overflow-y-auto mt-4">
                    {questions.filter((q) => !q.source).slice(0, 15).map((q) => (
                      <div key={q.id} className="flex items-center gap-3 p-2.5 bg-white border border-orange-100 rounded-lg text-sm">
                        <span className="font-mono text-xs text-gray-400 flex-shrink-0">{q.id}</span>
                        <span className="text-gray-600 truncate flex-1">{q.stem.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/\|[^|]*\|/g,'').substring(0,65)}…</span>
                        <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">{q.part}</span>
                      </div>
                    ))}
                    {questions.filter((q) => !q.source).length > 15 && (
                      <div className="text-xs text-gray-400 text-center pt-1">and {questions.filter((q) => !q.source).length - 15} more...</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── DIAGNOSTICS RUNNER ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">🔬 Run Diagnostics</h2>
              <p className="text-gray-500 text-sm mb-5">
                Performs a fresh direct fetch from Supabase (bypasses cache) and checks the schema.
                Run after applying the SQL fix above to confirm everything is working.
              </p>

              <div className="flex flex-wrap gap-3 mb-5">
                <button
                  onClick={runDiagnostics}
                  disabled={diagLoading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition shadow"
                >
                  {diagLoading ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Running…</>
                  ) : '🔍 Run Diagnostics & Sync'}
                </button>
                <button
                  onClick={async () => {
                    setDiagLoading(true);
                    try {
                      const qs = await syncFromSupabase();
                      setQuestions(qs);
                      onDataChange?.();
                      setDiagResult(`✅ Force sync complete — ${qs.length} questions loaded from Supabase into app.`);
                    } catch (err: any) {
                      setDiagResult(`❌ Sync failed: ${err.message ?? err}`);
                    } finally { setDiagLoading(false); }
                  }}
                  disabled={diagLoading}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition shadow"
                >
                  🔄 Force Sync from Supabase
                </button>
              </div>

              {diagResult && (
                <pre className={`whitespace-pre-wrap text-sm font-mono p-4 rounded-xl border ${
                  diagResult.includes('❌') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-900 text-green-400 border-gray-700'
                }`}>
                  {diagResult}
                </pre>
              )}
            </div>

            {/* ── BULK REASSIGN SYSTEM ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-1">🔁 Bulk Reassign System</h2>
              <p className="text-gray-500 text-sm mb-5">
                Move all questions from one system to another in Supabase. Useful for renaming or reorganising systems without touching individual questions.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">From System</label>
                  <input
                    value={reassignFrom}
                    onChange={e => { setReassignFrom(e.target.value); setReassignResult(null); setReassignConfirm(false); }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="e.g. Clinical Sciences"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">To System</label>
                  <input
                    value={reassignTo}
                    onChange={e => { setReassignTo(e.target.value); setReassignResult(null); setReassignConfirm(false); }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="e.g. Palliative Medicine"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Part Filter</label>
                  <select
                    value={reassignPart}
                    onChange={e => { setReassignPart(e.target.value as 'Part 1' | 'Part 2' | 'Both'); setReassignResult(null); setReassignConfirm(false); }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  >
                    <option value="Part 1">Part 1 only</option>
                    <option value="Part 2">Part 2 only</option>
                    <option value="Both">Both parts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Source Filter</label>
                  <select
                    value={reassignSource}
                    onChange={e => { setReassignSource(e.target.value); setReassignResult(null); setReassignConfirm(false); }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  >
                    <option value="Any">Any source</option>
                    <option value="Passmedicine">Passmedicine</option>
                    <option value="Pastest">Pastest</option>
                    <option value="MRCP">MRCP</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>

              {/* Preview count */}
              {reassignFrom.trim() && (
                <div className="text-sm text-gray-500 mb-4">
                  {(() => {
                    const count = questions.filter(q =>
                      q.system === reassignFrom.trim() &&
                      (reassignPart === 'Both' || q.part === reassignPart) &&
                      (reassignSource === 'Any' || q.source === reassignSource)
                    ).length;
                    return count > 0
                      ? <span className="text-amber-700 font-semibold">⚠️ {count} question(s) in local cache match — Supabase may differ. Proceed to apply.</span>
                      : <span className="text-gray-400">No matching questions in local cache for this combination.</span>;
                  })()}
                </div>
              )}

              {!reassignConfirm ? (
                <button
                  onClick={() => setReassignConfirm(true)}
                  disabled={!reassignFrom.trim() || !reassignTo.trim() || reassignFrom.trim() === reassignTo.trim()}
                  className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition shadow"
                >
                  🔁 Reassign System
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl p-4">
                  <span className="text-sm font-semibold text-amber-800">
                    Reassign all <strong>"{reassignFrom.trim()}"</strong> → <strong>"{reassignTo.trim()}"</strong>
                    {reassignPart !== 'Both' ? ` (${reassignPart})` : ''}
                    {reassignSource !== 'Any' ? ` · source: ${reassignSource}` : ''} in Supabase?
                  </span>
                  <button
                    onClick={async () => {
                      setReassignLoading(true);
                      setReassignResult(null);
                      setReassignConfirm(false);
                      try {
                        const part = reassignPart !== 'Both' ? reassignPart as 'Part 1' | 'Part 2' : undefined;
                        const source = reassignSource !== 'Any' ? reassignSource : undefined;
                        const count = await bulkReassignSystem(reassignFrom.trim(), reassignTo.trim(), part, source);
                        const freshQs = await syncFromSupabase();
                        setQuestions(freshQs);
                        onDataChange?.();
                        setReassignResult(`✅ Reassigned ${count} question(s): "${reassignFrom.trim()}" → "${reassignTo.trim()}"${part ? ` (${part})` : ''}${source ? ` · source: ${source}` : ''}. Re-synced ${freshQs.length} questions.`);
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : String(err);
                        setReassignResult(`❌ ${msg}`);
                      } finally {
                        setReassignLoading(false);
                      }
                    }}
                    disabled={reassignLoading}
                    className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold text-sm transition"
                  >
                    {reassignLoading
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-1" />Updating…</>
                      : 'Yes, Reassign'}
                  </button>
                  <button
                    onClick={() => setReassignConfirm(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm transition"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {reassignResult && (
                <div className={`mt-3 text-sm font-mono p-3 rounded-xl ${reassignResult.startsWith('❌') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                  {reassignResult}
                </div>
              )}
            </div>

            {/* Quick reference */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <h3 className="font-bold text-slate-700 mb-3">📖 Quick Reference</h3>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex gap-2">
                  <span className="font-bold text-slate-700 shrink-0">Step 1 —</span>
                  <span>Run the SQL migration in Supabase Dashboard → SQL Editor (copy button above)</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-slate-700 shrink-0">Step 2 —</span>
                  <span>Come back here → <strong>"Run Diagnostics"</strong> → confirm <code className="bg-white border px-1 rounded">source column: EXISTS</code></span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-slate-700 shrink-0">Step 3 —</span>
                  <span>Click <strong>"Patch null → MRCP"</strong> to label all 3 618 existing questions as MRCP source</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-slate-700 shrink-0">Step 4 —</span>
                  <span>Go to <strong>PM Part 2</strong> upload tab and re-upload your Passmedicine questions — they will now save correctly</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-gray-800">👥 User Management</h2>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">Admin Only</span>
            </div>
            <UserManagement />
          </div>
        )}
      </div>

      {/* Textbook Delete Modal */}
      {tbDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-4xl text-center mb-3">📚</div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Delete Textbook?</h3>
            <p className="text-gray-500 text-sm text-center mb-6">This will remove the textbook from the platform. Student notes will be preserved locally.</p>
            <div className="flex gap-3">
              <button onClick={() => setTbDeleteConfirm(null)} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => handleDeleteTextbook(tbDeleteConfirm)} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* OneLiner Clear Confirm Modal */}
      {olClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-4xl text-center mb-3">💡</div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Clear All {olClearConfirm} One-Liners?</h3>
            <p className="text-gray-500 text-sm text-center mb-6">This will permanently delete all {liners.filter(l => l.source === olClearConfirm).length} {olClearConfirm} one-liners.</p>
            <div className="flex gap-3">
              <button onClick={() => setOlClearConfirm(null)} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => { clearOneLiners(olClearConfirm); setLiners(getOneLiners()); setOlClearConfirm(null); }}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 transition">Clear All</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-4xl text-center mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Delete Question?</h3>
            <p className="text-gray-500 text-sm text-center mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={() => handleDeleteQ(deleteConfirm)} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 transition">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-gray-900">✏️ Edit Question</h3>
              <button onClick={() => setEditingQ(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Part</label>
                  <select
                    value={editingQ.part}
                    onChange={(e) => setEditingQ({ ...editingQ, part: e.target.value as MRCPPart })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Part 1">📘 Part 1</option>
                    <option value="Part 2">📗 Part 2</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Source</label>
                  <select
                    value={editingQ.source ?? 'Custom'}
                    onChange={(e) => setEditingQ({ ...editingQ, source: e.target.value as QBankSource })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Passmedicine">🟣 Passmedicine</option>
                    <option value="Pastest">🟢 Pastest</option>
                    <option value="Custom">⚙️ Custom</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">System</label>
                  <select
                    value={editingQ.system}
                    onChange={(e) => setEditingQ({ ...editingQ, system: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {editSystems.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Topic</label>
                  <input type="text" value={editingQ.topic} onChange={(e) => setEditingQ({ ...editingQ, topic: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Difficulty</label>
                  <select value={editingQ.difficulty} onChange={(e) => setEditingQ({ ...editingQ, difficulty: e.target.value as Difficulty })} className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Easy</option><option>Medium</option><option>Hard</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Stem</label>
                <textarea rows={3} value={editingQ.stem} onChange={(e) => setEditingQ({ ...editingQ, stem: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">Options</label>
                {editingQ.options.map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-2 mb-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${editingQ.correctAnswer === opt.id ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{opt.id}</span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => {
                        const opts = [...editingQ.options];
                        opts[i] = { ...opts[i], text: e.target.value };
                        setEditingQ({ ...editingQ, options: opts });
                      }}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input type="radio" name="editCorrect" checked={editingQ.correctAnswer === opt.id} onChange={() => setEditingQ({ ...editingQ, correctAnswer: opt.id })} className="accent-green-500" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Explanation</label>
                <textarea rows={3} value={editingQ.explanation} onChange={(e) => setEditingQ({ ...editingQ, explanation: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Reference</label>
                <input type="text" value={editingQ.reference} onChange={(e) => setEditingQ({ ...editingQ, reference: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Image fields in edit modal */}
              <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                <p className="text-xs font-bold text-gray-600 flex items-center gap-1">🖼️ Image Attachment <span className="font-normal text-gray-400">(optional)</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Image URL</label>
                    <input
                      type="url"
                      value={editingQ.imageUrl ?? ''}
                      onChange={(e) => setEditingQ({ ...editingQ, imageUrl: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com/image.png"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Image Type</label>
                    <select
                      value={editingQ.imageType ?? ''}
                      onChange={(e) => setEditingQ({ ...editingQ, imageType: (e.target.value || undefined) as ImageType | undefined })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select —</option>
                      {IMAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Image Caption</label>
                  <input
                    type="text"
                    value={editingQ.imageCaption ?? ''}
                    onChange={(e) => setEditingQ({ ...editingQ, imageCaption: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 12-lead ECG showing ST elevation in V1–V4"
                  />
                </div>
                {editingQ.imageUrl && editingQ.imageUrl.startsWith('http') && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">Preview:</p>
                    <QuestionImage
                      imageUrl={editingQ.imageUrl}
                      imageType={editingQ.imageType}
                      imageCaption={editingQ.imageCaption}
                      compact
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { updateQuestion(editingQ); updateQuestionInSupabase(editingQ).then(() => onDataChange?.()); refresh(); setEditingQ(null); }}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-blue-700 transition"
                >
                  Save Changes
                </button>
                <button onClick={() => setEditingQ(null)} className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation */}
      {clearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-4xl text-center mb-3">⚠️</div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Clear ALL Data?</h3>
            <p className="text-gray-500 text-sm text-center mb-6">This will delete ALL questions, stats, and session history. This cannot be undone!</p>
            <div className="flex gap-3">
              <button onClick={() => setClearConfirm(false)} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleClearAll} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 transition">
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

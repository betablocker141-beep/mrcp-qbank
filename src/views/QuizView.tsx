import { useState, useEffect, useCallback } from 'react';
import { Question, QuizSession } from '../types';
import { saveSession, recordSession } from '../store';
import StudyToolsPanel from '../components/StudyToolsPanel';
import QuestionImage from '../components/QuestionImage';
import RichText from '../components/RichText';
import { isBookmarked } from '../notesStore';
import {
  FlagIcon, GridIcon, BookmarkIcon, PencilIcon, ClockIcon,
  CheckIcon, XIcon, LightbulbIcon, BookIcon,
  ArrowLeftIcon, ArrowRightIcon,
} from '../components/Icons';

interface QuizViewProps {
  session: QuizSession;
  onFinish: (session: QuizSession) => void;
  onExit: () => void;
}

// ── Lab Values Data ───────────────────────────────────────────────────────────
const LAB_SECTIONS = [
  {
    title: 'Haematology', color: 'bg-red-50 border-red-200',
    values: [
      { name: 'Haemoglobin (Male)', range: '130–180 g/L' },
      { name: 'Haemoglobin (Female)', range: '115–165 g/L' },
      { name: 'MCV', range: '80–100 fL' },
      { name: 'White Cell Count', range: '4–11 × 10⁹/L' },
      { name: 'Neutrophils', range: '2.5–7.5 × 10⁹/L' },
      { name: 'Lymphocytes', range: '1.5–4.0 × 10⁹/L' },
      { name: 'Platelets', range: '150–400 × 10⁹/L' },
      { name: 'Reticulocytes', range: '0.5–2.5%' },
      { name: 'ESR (Male <50y)', range: '< 15 mm/hr' },
      { name: 'ESR (Female <50y)', range: '< 20 mm/hr' },
    ],
  },
  {
    title: 'Biochemistry', color: 'bg-blue-50 border-blue-200',
    values: [
      { name: 'Sodium', range: '135–145 mmol/L' },
      { name: 'Potassium', range: '3.5–5.0 mmol/L' },
      { name: 'Chloride', range: '95–107 mmol/L' },
      { name: 'Bicarbonate', range: '22–29 mmol/L' },
      { name: 'Urea', range: '2.5–7.5 mmol/L' },
      { name: 'Creatinine', range: '60–120 µmol/L' },
      { name: 'eGFR', range: '> 60 mL/min/1.73m²' },
      { name: 'Glucose (fasting)', range: '4.0–5.9 mmol/L' },
      { name: 'HbA1c (normal)', range: '< 42 mmol/mol' },
      { name: 'Calcium (total)', range: '2.12–2.65 mmol/L' },
      { name: 'Phosphate', range: '0.8–1.5 mmol/L' },
      { name: 'Magnesium', range: '0.75–1.05 mmol/L' },
      { name: 'Urate', range: '0.18–0.42 mmol/L' },
      { name: 'CRP', range: '< 5 mg/L' },
    ],
  },
  {
    title: 'Liver Function', color: 'bg-amber-50 border-amber-200',
    values: [
      { name: 'ALT', range: '5–40 U/L' },
      { name: 'AST', range: '10–40 U/L' },
      { name: 'ALP', range: '30–130 U/L' },
      { name: 'GGT', range: '< 50 U/L' },
      { name: 'Bilirubin (total)', range: '< 21 µmol/L' },
      { name: 'Albumin', range: '35–50 g/L' },
      { name: 'Total Protein', range: '60–80 g/L' },
      { name: 'LDH', range: '100–250 U/L' },
    ],
  },
  {
    title: 'Arterial Blood Gas', color: 'bg-teal-50 border-teal-200',
    values: [
      { name: 'pH', range: '7.35–7.45' },
      { name: 'PaO₂', range: '11–13 kPa (83–100 mmHg)' },
      { name: 'PaCO₂', range: '4.7–6.0 kPa (35–45 mmHg)' },
      { name: 'HCO₃⁻', range: '22–26 mmol/L' },
      { name: 'Base Excess', range: '−2 to +2 mmol/L' },
      { name: 'SpO₂', range: '95–100%' },
    ],
  },
  {
    title: 'Thyroid & Hormones', color: 'bg-purple-50 border-purple-200',
    values: [
      { name: 'TSH', range: '0.4–4.0 mU/L' },
      { name: 'Free T4', range: '9–25 pmol/L' },
      { name: 'Free T3', range: '3.5–7.8 pmol/L' },
      { name: 'Cortisol (9am)', range: '170–700 nmol/L' },
      { name: 'Prolactin (Male)', range: '< 450 mU/L' },
      { name: 'Prolactin (Female)', range: '< 600 mU/L' },
    ],
  },
  {
    title: 'Clotting & Immunology', color: 'bg-rose-50 border-rose-200',
    values: [
      { name: 'PT / INR', range: '10–14 s / 0.8–1.2' },
      { name: 'APTT', range: '25–35 s' },
      { name: 'Fibrinogen', range: '2.0–4.0 g/L' },
      { name: 'D-Dimer', range: '< 0.5 mg/L' },
      { name: 'IgG', range: '6–16 g/L' },
      { name: 'IgA', range: '0.8–3.0 g/L' },
      { name: 'IgM', range: '0.5–2.0 g/L' },
    ],
  },
  {
    title: 'Lipids & Cardiac', color: 'bg-indigo-50 border-indigo-200',
    values: [
      { name: 'Total Cholesterol', range: '< 5.0 mmol/L' },
      { name: 'LDL', range: '< 3.0 mmol/L' },
      { name: 'HDL (Male)', range: '> 1.0 mmol/L' },
      { name: 'HDL (Female)', range: '> 1.2 mmol/L' },
      { name: 'Triglycerides', range: '< 1.7 mmol/L' },
      { name: 'Troponin I (high-sens)', range: '< 52 ng/L' },
      { name: 'NT-proBNP', range: '< 125 pg/mL' },
      { name: 'BNP', range: '< 35 pg/mL' },
      { name: 'CK', range: '< 200 U/L' },
    ],
  },
];

// ── Simple Calculator ─────────────────────────────────────────────────────────
function CalculatorModal({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState('');
  const [op, setOp] = useState('');
  const [reset, setReset] = useState(false);

  // Medical sub-calculators
  const [calcMode, setCalcMode] = useState<'basic' | 'bmi' | 'calcium' | 'egfr'>('basic');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [medResult, setMedResult] = useState('');

  const pressNum = (n: string) => {
    if (reset || display === '0') { setDisplay(n); setReset(false); }
    else setDisplay(display + n);
  };
  const pressDot = () => { if (!display.includes('.')) setDisplay(display + '.'); };
  const pressOp = (o: string) => { setPrev(display); setOp(o); setReset(true); };
  const pressEq = () => {
    const a = parseFloat(prev), b = parseFloat(display);
    let r = 0;
    if (op === '+') r = a + b;
    else if (op === '-') r = a - b;
    else if (op === '×') r = a * b;
    else if (op === '÷') r = b !== 0 ? a / b : 0;
    setDisplay(String(parseFloat(r.toFixed(8))));
    setOp(''); setPrev(''); setReset(true);
  };
  const pressClear = () => { setDisplay('0'); setPrev(''); setOp(''); setReset(false); };
  const pressBack = () => { setDisplay(display.length > 1 ? display.slice(0, -1) : '0'); };

  const calcMed = () => {
    try {
      if (calcMode === 'bmi') {
        const w = parseFloat(inputs.weight), h = parseFloat(inputs.height) / 100;
        if (!w || !h) { setMedResult('Enter valid weight (kg) and height (cm)'); return; }
        const bmi = w / (h * h);
        const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
        setMedResult(`BMI = ${bmi.toFixed(1)} kg/m² → ${cat}`);
      } else if (calcMode === 'calcium') {
        const ca = parseFloat(inputs.calcium), alb = parseFloat(inputs.albumin);
        if (!ca || !alb) { setMedResult('Enter valid Calcium (mmol/L) and Albumin (g/L)'); return; }
        const corrCa = ca + 0.02 * (40 - alb);
        setMedResult(`Corrected Ca²⁺ = ${corrCa.toFixed(2)} mmol/L`);
      } else if (calcMode === 'egfr') {
        const cr = parseFloat(inputs.creatinine), age = parseFloat(inputs.age);
        const sex = inputs.sex || 'male';
        if (!cr || !age) { setMedResult('Enter valid Creatinine (µmol/L) and Age'); return; }
        const crMg = cr / 88.4;
        let egfr = 186 * Math.pow(crMg, -1.154) * Math.pow(age, -0.203);
        if (sex === 'female') egfr *= 0.742;
        const stage = egfr >= 90 ? 'G1 (Normal)' : egfr >= 60 ? 'G2 (Mildly ↓)' : egfr >= 45 ? 'G3a' : egfr >= 30 ? 'G3b' : egfr >= 15 ? 'G4' : 'G5 (Kidney Failure)';
        setMedResult(`eGFR ≈ ${egfr.toFixed(0)} mL/min/1.73m² → CKD ${stage}`);
      }
    } catch { setMedResult('Calculation error'); }
  };

  const btnCls = 'flex items-center justify-center rounded-xl font-bold text-sm transition active:scale-95';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#1a3a5c] text-white px-4 py-3 flex items-center justify-between">
          <span className="font-bold">🖩 Calculator</span>
          <button onClick={onClose} className="w-7 h-7 bg-white/20 rounded-lg text-sm font-bold hover:bg-white/30 transition">✕</button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50 text-xs">
          {[
            { id: 'basic', label: '🔢 Basic' },
            { id: 'bmi', label: '⚖️ BMI' },
            { id: 'calcium', label: '🦴 Ca²⁺' },
            { id: 'egfr', label: '🫘 eGFR' },
          ].map((m) => (
            <button key={m.id} onClick={() => { setCalcMode(m.id as any); setMedResult(''); }}
              className={`flex-1 py-2 font-semibold transition ${calcMode === m.id ? 'bg-white text-blue-700 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Basic Calculator */}
        {calcMode === 'basic' && (
          <div className="p-4">
            <div className="bg-gray-900 text-white rounded-xl p-4 mb-3 text-right">
              {op && <div className="text-gray-400 text-xs mb-1">{prev} {op}</div>}
              <div className="text-3xl font-mono font-bold truncate">{display}</div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                ['C', '⌫', '%', '÷'],
                ['7', '8', '9', '×'],
                ['4', '5', '6', '-'],
                ['1', '2', '3', '+'],
                ['±', '0', '.', '='],
              ].map((row) => row.map((btn) => (
                <button key={btn}
                  onClick={() => {
                    if (btn === 'C') pressClear();
                    else if (btn === '⌫') pressBack();
                    else if (btn === '=') pressEq();
                    else if (['+', '-', '×', '÷', '%'].includes(btn)) pressOp(btn);
                    else if (btn === '.') pressDot();
                    else if (btn === '±') setDisplay(String(parseFloat(display) * -1));
                    else pressNum(btn);
                  }}
                  className={`${btnCls} py-3 ${
                    btn === '=' ? 'bg-blue-600 text-white col-span-1' :
                    ['÷', '×', '-', '+'].includes(btn) ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                    ['C', '⌫', '%', '±'].includes(btn) ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' :
                    'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}>
                  {btn}
                </button>
              )))}
            </div>
          </div>
        )}

        {/* Medical Calculators */}
        {calcMode !== 'basic' && (
          <div className="p-4 space-y-3">
            {calcMode === 'bmi' && (
              <>
                <p className="text-xs text-gray-500 font-medium">BMI = Weight / Height²</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Weight (kg)</label>
                    <input type="number" placeholder="e.g. 70" value={inputs.weight ?? ''}
                      onChange={(e) => setInputs({ ...inputs, weight: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Height (cm)</label>
                    <input type="number" placeholder="e.g. 175" value={inputs.height ?? ''}
                      onChange={(e) => setInputs({ ...inputs, height: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
              </>
            )}
            {calcMode === 'calcium' && (
              <>
                <p className="text-xs text-gray-500 font-medium">Corrected Ca = Ca + 0.02 × (40 − Albumin)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Total Ca (mmol/L)</label>
                    <input type="number" step="0.01" placeholder="e.g. 2.1" value={inputs.calcium ?? ''}
                      onChange={(e) => setInputs({ ...inputs, calcium: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Albumin (g/L)</label>
                    <input type="number" placeholder="e.g. 28" value={inputs.albumin ?? ''}
                      onChange={(e) => setInputs({ ...inputs, albumin: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
              </>
            )}
            {calcMode === 'egfr' && (
              <>
                <p className="text-xs text-gray-500 font-medium">CKD-EPI eGFR (MDRD simplified)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Creatinine (µmol/L)</label>
                    <input type="number" placeholder="e.g. 110" value={inputs.creatinine ?? ''}
                      onChange={(e) => setInputs({ ...inputs, creatinine: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Age (years)</label>
                    <input type="number" placeholder="e.g. 55" value={inputs.age ?? ''}
                      onChange={(e) => setInputs({ ...inputs, age: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="sex" value="male" checked={(inputs.sex ?? 'male') === 'male'} onChange={() => setInputs({ ...inputs, sex: 'male' })} className="accent-blue-600" /> Male
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="sex" value="female" checked={inputs.sex === 'female'} onChange={() => setInputs({ ...inputs, sex: 'female' })} className="accent-blue-600" /> Female
                  </label>
                </div>
              </>
            )}
            {medResult && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm font-semibold text-blue-800">
                {medResult}
              </div>
            )}
            <button onClick={calcMed}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-sm transition">
              Calculate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lab Values Modal ──────────────────────────────────────────────────────────
function LabValuesModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? LAB_SECTIONS.map((s) => ({ ...s, values: s.values.filter((v) => v.name.toLowerCase().includes(search.toLowerCase())) })).filter((s) => s.values.length > 0)
    : LAB_SECTIONS;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#1a3a5c] text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="font-bold text-base">Δ Lab Reference Values</span>
          <button onClick={onClose} className="w-7 h-7 bg-white/20 rounded-lg text-sm font-bold hover:bg-white/30 transition">✕</button>
        </div>
        {/* Search */}
        <div className="p-3 border-b border-gray-100 flex-shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lab values…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {filtered.map((section) => (
            <div key={section.title} className={`rounded-xl border ${section.color} overflow-hidden`}>
              <div className={`px-4 py-2 font-bold text-sm ${section.color}`}>{section.title}</div>
              <table className="w-full text-sm">
                <tbody>
                  {section.values.map((v, i) => (
                    <tr key={v.name} className={i % 2 === 0 ? 'bg-white/60' : 'bg-white/30'}>
                      <td className="px-4 py-2 text-gray-700 font-medium">{v.name}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-600 font-semibold">{v.range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-400">No results for "{search}"</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main QuizView ─────────────────────────────────────────────────────────────
export default function QuizView({ session: initSession, onFinish, onExit }: QuizViewProps) {
  const [session, setSession] = useState<QuizSession>({
    ...initSession,
    flagged: new Set(initSession.flagged),
  });
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(
    initSession.mode === 'timed' ? initSession.questions.length * 90 : 0
  );
  const [showNavigator, setShowNavigator] = useState(false);
  // Study tools state
  const [studyToolsTab, setStudyToolsTab] = useState<'highlights' | 'notes' | 'bookmarks' | null>(null);
  // Modal states
  const [showLabValues, setShowLabValues] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(initSession.questions[0]?.id ?? ''));

  const currentQ: Question = session.questions[session.currentIndex];
  const selectedAnswer = session.answers[currentQ?.id];
  const isAnswered = !!selectedAnswer;
  const isFlagged = session.flagged.has(currentQ?.id);
  const total = session.questions.length;
  const answeredCount = Object.keys(session.answers).length;

  useEffect(() => {
    if (session.mode !== 'timed' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); handleFinish(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [session.mode]);

  const handleFinish = useCallback(() => {
    const finished = { ...session, endTime: Date.now() };
    recordSession(finished);
    saveSession(finished);
    onFinish(finished);
  }, [session, onFinish]);

  const selectAnswer = (optionId: string) => {
    if (isAnswered && session.mode === 'tutor') return;
    setSession((prev) => {
      const updated = { ...prev, answers: { ...prev.answers, [currentQ.id]: optionId } };
      saveSession(updated);
      return updated;
    });
    if (session.mode === 'tutor') setShowExplanation(true);
  };

  const toggleFlag = () => {
    setSession((prev) => {
      const newFlagged = new Set(prev.flagged);
      if (newFlagged.has(currentQ.id)) newFlagged.delete(currentQ.id);
      else newFlagged.add(currentQ.id);
      const updated = { ...prev, flagged: newFlagged };
      saveSession(updated);
      return updated;
    });
  };

  useEffect(() => {
    setBookmarked(isBookmarked(currentQ?.id ?? ''));
    setShowExplanation(false);
    setStudyToolsTab(null);
  }, [currentQ?.id]);

  const navigate = (dir: 1 | -1) => {
    setShowExplanation(false);
    setStudyToolsTab(null);
    setSession((prev) => ({
      ...prev,
      currentIndex: Math.max(0, Math.min(total - 1, prev.currentIndex + dir)),
    }));
  };

  const goTo = (idx: number) => {
    setShowExplanation(false);
    setStudyToolsTab(null);
    setSession((prev) => ({ ...prev, currentIndex: idx }));
    setShowNavigator(false);
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Toggle a study tools tab (clicking active tab closes it)
  const toggleStudyTab = (tab: 'highlights' | 'notes' | 'bookmarks') => {
    setStudyToolsTab((prev) => (prev === tab ? null : tab));
  };

  // ── Option styling ────────────────────────────────────────────────────────
  const optionBorderStyle = (optId: string) => {
    if (!isAnswered || session.mode === 'timed') {
      return selectedAnswer === optId
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-200 hover:border-gray-400 cursor-pointer';
    }
    if (optId === currentQ.correctAnswer) return 'border-green-500 bg-green-50';
    if (optId === selectedAnswer && optId !== currentQ.correctAnswer) return 'border-red-400 bg-red-50';
    return 'border-gray-200 opacity-60';
  };

  const optionCircleStyle = (optId: string) => {
    if (!isAnswered || session.mode === 'timed') {
      return selectedAnswer === optId
        ? 'border-blue-500 bg-blue-500 text-white'
        : 'border-gray-400 text-gray-600';
    }
    if (optId === currentQ.correctAnswer) return 'border-green-500 bg-green-500 text-white';
    if (optId === selectedAnswer) return 'border-red-400 bg-red-400 text-white';
    return 'border-gray-300 text-gray-400';
  };

  // ── Navigator Overlay ─────────────────────────────────────────────────────
  if (showNavigator) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Question Navigator</h2>
              <p className="text-sm text-gray-500 mt-0.5">{answeredCount} of {total} answered · {session.flagged.size} flagged</p>
            </div>
            <button onClick={() => setShowNavigator(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition text-lg font-bold">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-2 mb-5">
            {session.questions.map((q, i) => {
              const ans = session.answers[q.id];
              const correct = ans === q.correctAnswer;
              const flagged = session.flagged.has(q.id);
              return (
                <button key={q.id} onClick={() => goTo(i)}
                  className={`aspect-square rounded-xl text-xs font-bold flex items-center justify-center relative transition border-2 ${
                    i === session.currentIndex ? 'ring-2 ring-offset-1 ring-blue-600' : ''
                  } ${
                    ans
                      ? correct ? 'bg-green-500 border-green-500 text-white' : 'bg-red-400 border-red-400 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'
                  }`}>
                  {i + 1}
                  {flagged && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white" />}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 border-t border-gray-100 pt-4">
            <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 bg-green-500 rounded" /> Correct</span>
            <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 bg-red-400 rounded" /> Incorrect</span>
            <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 bg-white border-2 border-gray-300 rounded" /> Unanswered</span>
            <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 bg-amber-400 rounded-full" /> Flagged</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">

      {/* ── TOP HEADER ROW 1: Brand + Timer ─────────────────────────── */}
      <div className="bg-[#1a3a5c] text-white flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-sm">🧪</span>
            </div>
            <span className="font-bold text-base tracking-tight">MRCP Q Bank</span>
            <span className="text-white/40 text-lg font-thin">|</span>
            <span className="text-white/80 text-sm font-medium hidden sm:block">
              {currentQ.part} — {currentQ.system}
              {currentQ.topic ? ` · ${currentQ.topic}` : ''}
              {currentQ.source ? ` · ${currentQ.source}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {session.mode === 'timed' && (
              <div className={`flex items-center gap-1.5 font-mono text-sm font-semibold px-3 py-1.5 rounded-lg ${
                timeLeft < 60 ? 'bg-red-500/80' : 'bg-white/10'
              }`}>
                <ClockIcon className="w-3.5 h-3.5" />
                {formatTime(timeLeft)}
              </div>
            )}
            {session.mode !== 'timed' && (
              <div className="flex items-center gap-1.5 font-mono text-sm text-white/70 bg-white/10 px-3 py-1.5 rounded-lg">
                <ClockIcon className="w-3.5 h-3.5" />
                <ElapsedTimer />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TOP HEADER ROW 2: Question # + Tool Buttons ──────────────── */}
      <div className="bg-[#142e4a] text-white flex-shrink-0 border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-semibold text-white/90">
            Question {session.currentIndex + 1} of {total}
          </span>

          <div className="flex items-center gap-0.5">
            {/* Flag */}
            <ToolBtn
              active={isFlagged}
              activeClass="text-amber-300 bg-white/15"
              onClick={toggleFlag}
              icon={<FlagIcon className="w-4 h-4" filled={isFlagged} />}
              label="Flag"
            />
            {/* Notes */}
            <ToolBtn
              active={studyToolsTab === 'notes'}
              activeClass="text-blue-300 bg-white/15"
              onClick={() => toggleStudyTab('notes')}
              icon={<PencilIcon className="w-4 h-4" />}
              label="Notes"
            />
            {/* Highlight */}
            <ToolBtn
              active={studyToolsTab === 'highlights'}
              activeClass="text-yellow-300 bg-white/15"
              onClick={() => toggleStudyTab('highlights')}
              icon={<span className="text-sm font-bold">✏️</span>}
              label="Highlight"
            />
            {/* Bookmark */}
            <ToolBtn
              active={bookmarked || studyToolsTab === 'bookmarks'}
              activeClass="text-indigo-300 bg-white/15"
              onClick={() => toggleStudyTab('bookmarks')}
              icon={<BookmarkIcon className="w-4 h-4" filled={bookmarked} />}
              label="Bookmark"
            />
            {/* Lab Values */}
            <ToolBtn
              active={showLabValues}
              activeClass="text-teal-300 bg-white/15"
              onClick={() => setShowLabValues(true)}
              icon={<span className="text-xs font-black">Δ</span>}
              label="Lab Values"
            />
            {/* Calculator */}
            <ToolBtn
              active={showCalculator}
              activeClass="text-green-300 bg-white/15"
              onClick={() => setShowCalculator(true)}
              icon={<span className="text-sm">🖩</span>}
              label="Calculator"
            />
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

          {/* Question Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 pb-4">
              {/* Topic tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs font-semibold px-3 py-1 rounded-full border border-blue-400 text-blue-600 bg-blue-50">{currentQ.system}</span>
                {currentQ.topic && <span className="text-xs font-semibold px-3 py-1 rounded-full border border-teal-400 text-teal-600 bg-teal-50">{currentQ.topic}</span>}
                {currentQ.source && (
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                    currentQ.source === 'Passmedicine' ? 'border-violet-400 text-violet-600 bg-violet-50'
                    : currentQ.source === 'Pastest' ? 'border-teal-500 text-teal-700 bg-teal-50'
                    : 'border-gray-300 text-gray-500 bg-gray-50'
                  }`}>{currentQ.source}</span>
                )}
                {currentQ.year && <span className="text-xs font-semibold px-3 py-1 rounded-full border border-purple-300 text-purple-600 bg-purple-50">{currentQ.year}</span>}
                <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                  currentQ.difficulty === 'Easy' ? 'border-green-400 text-green-600 bg-green-50'
                  : currentQ.difficulty === 'Medium' ? 'border-amber-400 text-amber-600 bg-amber-50'
                  : 'border-red-400 text-red-600 bg-red-50'
                }`}>{currentQ.difficulty}</span>
              </div>

              {/* Question stem */}
              <RichText text={currentQ.stem} className="text-gray-800 text-[15px]" />

              {currentQ.imageUrl && (
                <div className="mt-4">
                  <QuestionImage imageUrl={currentQ.imageUrl} imageType={currentQ.imageType} imageCaption={currentQ.imageCaption} />
                </div>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* Answer options */}
            <div className="p-6 pt-4 space-y-2">
              {currentQ.options.map((opt) => (
                <button key={opt.id} onClick={() => selectAnswer(opt.id)}
                  disabled={isAnswered && session.mode === 'tutor'}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-lg border-2 transition-all text-left ${optionBorderStyle(opt.id)} ${
                    isAnswered && session.mode === 'tutor' ? 'cursor-default' : 'cursor-pointer'
                  }`}>
                  <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${optionCircleStyle(opt.id)}`}>
                    {isAnswered && session.mode === 'tutor' && opt.id === currentQ.correctAnswer
                      ? <CheckIcon className="w-4 h-4" />
                      : isAnswered && session.mode === 'tutor' && opt.id === selectedAnswer && opt.id !== currentQ.correctAnswer
                      ? <XIcon className="w-4 h-4" />
                      : opt.id}
                  </span>
                  <span className="text-gray-800 text-sm leading-relaxed flex-1">{opt.text}</span>
                </button>
              ))}

              {session.mode === 'timed' && !isAnswered && selectedAnswer && (
                <div className="pt-2 text-center">
                  <button onClick={() => setShowExplanation(true)}
                    className="bg-blue-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm">
                    Submit Answer
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Explanation Card */}
          {showExplanation && isAnswered && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className={`flex items-center gap-3 px-6 py-4 border-b ${
                selectedAnswer === currentQ.correctAnswer ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
              }`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selectedAnswer === currentQ.correctAnswer ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {selectedAnswer === currentQ.correctAnswer
                    ? <CheckIcon className="w-5 h-5 text-white" />
                    : <XIcon className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <p className={`font-bold text-base ${selectedAnswer === currentQ.correctAnswer ? 'text-green-800' : 'text-red-700'}`}>
                    {selectedAnswer === currentQ.correctAnswer ? 'Correct Answer!' : `Incorrect — Correct answer: ${currentQ.correctAnswer}`}
                  </p>
                  {selectedAnswer !== currentQ.correctAnswer && (
                    <p className="text-sm text-red-600 mt-0.5">
                      {currentQ.options.find((o) => o.id === currentQ.correctAnswer)?.text}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                  <LightbulbIcon className="w-4 h-4 text-amber-500" /> Explanation
                </h3>
                <RichText text={currentQ.explanation} className="text-gray-700 text-[15px]" />

                {currentQ.reference && (
                  <div className="mt-4 flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <BookIcon className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-slate-700"><span className="font-semibold">Reference:</span> {currentQ.reference}</div>
                  </div>
                )}

                {currentQ.tags && currentQ.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {currentQ.tags.map((t) => (
                      <span key={t} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Study Tools Panel */}
          {studyToolsTab !== null && (
            <StudyToolsPanel
              questionId={currentQ.id}
              stemText={currentQ.stem}
              defaultTab={studyToolsTab}
              onBookmarkChange={(bm) => setBookmarked(bm)}
            />
          )}
        </div>
      </div>

      {/* ── FIXED BOTTOM NAVIGATION BAR ─────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button onClick={() => setShowNavigator(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 hover:border-gray-400 transition">
            <GridIcon className="w-4 h-4" />
            <span>Navigator</span>
          </button>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} disabled={session.currentIndex === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
              <ArrowLeftIcon className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm font-bold text-gray-600 px-2 min-w-[60px] text-center">
              {session.currentIndex + 1} / {total}
            </span>
            {session.currentIndex === total - 1 ? (
              <button onClick={handleFinish}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition shadow-sm">
                <CheckIcon className="w-4 h-4" /> Finish
              </button>
            ) : (
              <button onClick={() => navigate(1)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition shadow-sm">
                Next <ArrowRightIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          <button onClick={() => setConfirmExit(true)}
            className="px-4 py-2 rounded-lg border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 hover:border-red-400 transition">
            End Block
          </button>
        </div>
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${Math.round((answeredCount / total) * 100)}%` }} />
        </div>
      </div>

      {/* Modals */}
      {showLabValues && <LabValuesModal onClose={() => setShowLabValues(false)} />}
      {showCalculator && <CalculatorModal onClose={() => setShowCalculator(false)} />}

      {/* Exit Confirmation */}
      {confirmExit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">End Block?</h3>
            <p className="text-gray-500 text-sm mb-6">Your progress will be saved.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmExit(false)}
                className="flex-1 border-2 border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                Continue
              </button>
              <button onClick={() => { saveSession(session); onExit(); }}
                className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-700 transition">
                End Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ToolBtn({ icon, label, active, activeClass, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; activeClass: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
        active ? `${activeClass}` : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return <>{`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`}</>;
}

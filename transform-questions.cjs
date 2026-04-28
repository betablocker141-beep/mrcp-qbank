/**
 * transform-questions.js
 *
 * Converts MRCP question JSON from Supabase export format into
 * the clean upload format expected by the Admin Panel.
 *
 * Usage:
 *   node transform-questions.js input.json output.json
 *
 * Steps:
 *   1. Export your questions from Supabase SQL Editor:
 *        SELECT * FROM questions WHERE part = 'Part 1' AND source = 'MRCP';
 *      then download as JSON.
 *   2. Run:  node transform-questions.js exported.json cleaned.json
 *   3. Upload cleaned.json via Admin Panel → MRCP Part 1 tab.
 */

const fs = require('fs');

// ─── Explanation transformer ───────────────────────────────────────────────────

function transformExplanation(raw) {
  if (!raw || !raw.trim()) return '';

  // If no emoji section markers found → already formatted or plain text, leave untouched
  if (!/[✅🔑❌💡🔍]/.test(raw)) return raw.trim();

  let text = raw.trim();

  // ── Detect format ──────────────────────────────────────────────────────────
  // Format A: single long line using "→" as separator between sections
  // Format B: multi-line using "→" as bullet prefix within sections
  const isMultiLine = text.split('\n').length > 3;

  // Normalise: if mostly one line, split on → first
  if (!isMultiLine) {
    text = text.split('→').map(s => s.trim()).filter(Boolean).join('\n');
  }

  const lines = text.split('\n').map(l => l.replace(/^→\s*/, '').trim()).filter(Boolean);

  // ── Parse sections ─────────────────────────────────────────────────────────
  let correctAnswerName = '';
  let keyConceptLines   = [];
  let clinicalLines     = [];
  let wrongOptions      = [];   // { letter, name, text }
  let rememberLines     = [];
  let section           = '';

  for (const line of lines) {

    // ✅ CORRECT
    const correctMatch = line.match(/✅\s*CORRECT:\s*([A-E])\s*[—\-–]\s*(.+)/);
    if (correctMatch) {
      correctAnswerName = correctMatch[2].trim();
      section = '';
      continue;
    }

    // 🔑 KEY CONCEPT (with or without colon, with or without content on same line)
    if (/🔑\s*KEY CONCEPT/i.test(line)) {
      section = 'key';
      const rest = line.replace(/🔑\s*KEY CONCEPT[:\s]*/i, '').trim();
      if (rest) keyConceptLines.push(rest);
      continue;
    }

    // 🔍 CLINICAL CLUES
    if (/🔍\s*CLINICAL/i.test(line)) {
      section = 'clinical';
      const rest = line.replace(/🔍[^:]*[:\s]*/i, '').trim();
      if (rest) clinicalLines.push(rest);
      continue;
    }

    // ❌ WRONG OPTIONS / WHY THE OTHERS ARE WRONG
    if (/❌/.test(line)) {
      section = 'wrong';
      // The first wrong option may be on the same line after the header
      const rest = line.replace(/❌\s*(?:WRONG OPTIONS|WHY THE OTHERS ARE WRONG)[:\s]*/i, '').trim();
      if (rest) parseWrongOptionLine(rest, wrongOptions);
      continue;
    }

    // 💡 REMEMBER
    if (/💡\s*REMEMBER/i.test(line)) {
      section = 'remember';
      const rest = line.replace(/💡\s*REMEMBER\s*[→:\s]*/i, '').trim();
      if (rest) rememberLines.push(rest);
      continue;
    }

    // ── Content lines ──────────────────────────────────────────────────────
    if (section === 'key')      { keyConceptLines.push(line); continue; }
    if (section === 'clinical') { clinicalLines.push(line);   continue; }
    if (section === 'remember') { rememberLines.push(line);   continue; }

    if (section === 'wrong') {
      if (!parseWrongOptionLine(line, wrongOptions)) {
        // Continuation of previous option
        if (wrongOptions.length > 0) {
          wrongOptions[wrongOptions.length - 1].text += ' ' + line;
        }
      }
      continue;
    }

    // Before any section is set, content belongs to key concept
    if (!section && line) {
      keyConceptLines.push(line);
    }
  }

  // ── Build formatted markdown ───────────────────────────────────────────────
  const parts = [];

  if (correctAnswerName) {
    parts.push(`**${correctAnswerName}** is the correct answer.\n`);
  }

  if (keyConceptLines.length > 0) {
    parts.push('**Key Concept:**');
    keyConceptLines.forEach(l => parts.push(`- ${l}`));
    parts.push('');
  }

  if (clinicalLines.length > 0) {
    parts.push('**Clinical Clues:**');
    clinicalLines.forEach(l => parts.push(`- ${l}`));
    parts.push('');
  }

  if (wrongOptions.length > 0) {
    parts.push('**Why the others are wrong:**\n');
    wrongOptions.forEach(opt => {
      const label = opt.name ? `**${opt.letter} — ${opt.name}:**` : `**${opt.letter}:**`;
      parts.push(`- ${label} ${opt.text}`);
    });
    parts.push('');
  }

  if (rememberLines.length > 0) {
    parts.push(`**Remember:** ${rememberLines.join(' ')}`);
  }

  return parts.join('\n').trim();
}

/** Try to parse "A (Name): text" or "A — Name: text" from a line.
 *  Returns true if parsed and pushed, false otherwise. */
function parseWrongOptionLine(line, arr) {
  // "A (Name): text" or "A(Name): text"
  const m1 = line.match(/^([A-E])\s*[\(（]([^)）]*)[\)）]\s*[:\-–—]\s*(.+)/);
  if (m1) { arr.push({ letter: m1[1], name: m1[2].trim(), text: m1[3].trim() }); return true; }

  // "A — Name: text"
  const m2 = line.match(/^([A-E])\s*[—\-–]\s*([^:]+?):\s*(.+)/);
  if (m2) { arr.push({ letter: m2[1], name: m2[2].trim(), text: m2[3].trim() }); return true; }

  // "A: text" (no name)
  const m3 = line.match(/^([A-E])\s*:\s*(.+)/);
  if (m3) { arr.push({ letter: m3[1], name: '', text: m3[2].trim() }); return true; }

  return false;
}

// ─── Stem transformer: converts plain-text lab values → markdown tables ────────

// Headers that signal a lab values section is coming
const LAB_HEADERS = [
  /\b(blood\s+tests?|investigations?|bloods?|biochemistry|haematology|hematology|lab(?:oratory)?\s+(?:results?|findings?)|test\s+results?|the\s+following\s+(?:results?|investigations?)|blood\s+results?|relevant\s+investigations?)\s*[:\-–—]?/i,
];

// Dictionary of known lab test names (lowercase) for confident detection
const LAB_NAMES = new Set([
  'hb','haemoglobin','hemoglobin','wbc','wcc','white cell count','white blood cell count',
  'platelets','plt','neutrophils','neutrophil count','lymphocytes','lymphocyte count',
  'monocytes','eosinophils','basophils','mcv','mch','mchc','reticulocytes','hct',
  'haematocrit','hematocrit','rbc','red cell count',
  'sodium','na','potassium','k','chloride','bicarbonate','hco3','urea','creatinine',
  'egfr','gfr','glucose','hba1c','calcium','phosphate','magnesium','albumin',
  'total protein','bilirubin','alt','ast','alp','alk phos','alkaline phosphatase',
  'ggt','γgt','ldh','crp','esr','ferritin','b12','vitamin b12','folate','iron',
  'tibc','transferrin saturation','pt','aptt','inr','fibrinogen','d-dimer',
  'tsh','t4','t3','free t4','ft4','free t3','ft3','cortisol','acth','insulin',
  'troponin','troponin i','troponin t','bnp','nt-probnp','ck','myoglobin',
  'psa','afp','ca-125','ca 125','ca-19-9','cea','urate','uric acid',
  'amylase','lipase','procalcitonin','lactate','csf protein','csf glucose',
  'ph','po2','pco2','spo2','o2 saturation','pcr',
]);

function looksLikeLabName(word) {
  return LAB_NAMES.has(word.toLowerCase().trim());
}

/**
 * Try to parse a single line as a lab test entry.
 * Returns { name, value, range } or null.
 */
function parseLabLine(rawLine) {
  // Strip bullet/dash prefixes
  const line = rawLine.replace(/^[\s\-–—•*→]+/, '').trim();
  if (!line) return null;

  // Pattern A: "TestName: value units (range)" — colon separator
  const colonPat = /^([A-Za-zÀ-ÿ][\w\s\+\-²³⁹\/²]{1,35}?)\s*:\s*([\d.,]+(?:\s*[×x]\s*10[\^⁹⁶])?(?:\s*[\w\/μµ%]+)?)\s*(?:\(([^)]{1,30})\))?$/;
  const mColon = line.match(colonPat);
  if (mColon) {
    const name = mColon[1].trim();
    if (looksLikeLabName(name) || name.split(' ').length <= 3) {
      return { name, value: mColon[2].trim(), range: mColon[3]?.trim() || '' };
    }
  }

  // Pattern B: "TestName value units (range)" — space separator (name must be known)
  const spacePat = /^([A-Za-zÀ-ÿ][\w\s\+\-]{1,30}?)\s+([\d.,]+(?:\s*[×x]\s*10[\^⁹⁶])?(?:\s*[\w\/μµ%]+)?)\s*(?:\(([^)]{1,30})\))?$/;
  const mSpace = line.match(spacePat);
  if (mSpace) {
    const name = mSpace[1].trim();
    if (looksLikeLabName(name)) {
      return { name, value: mSpace[2].trim(), range: mSpace[3]?.trim() || '' };
    }
  }

  return null;
}

/**
 * Determine if a value is abnormal vs a reference range string.
 * Returns true if definitely outside range, false otherwise.
 */
function isAbnormalValue(valueStr, rangeStr) {
  if (!rangeStr) return false;
  const num = parseFloat(valueStr.replace(/[^\d.]/g, ''));
  if (isNaN(num)) return false;
  // Range: "X-Y" or "X–Y"
  const rangeMatch = rangeStr.match(/([\d.]+)\s*[–\-]\s*([\d.]+)/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]);
    const hi = parseFloat(rangeMatch[2]);
    return num < lo || num > hi;
  }
  // Range: "<X" or ">X"
  const ltMatch = rangeStr.match(/^<\s*([\d.]+)/);
  if (ltMatch) return num >= parseFloat(ltMatch[1]);
  const gtMatch = rangeStr.match(/^>\s*([\d.]+)/);
  if (gtMatch) return num <= parseFloat(gtMatch[1]);
  return false;
}

/**
 * Build a markdown pipe table from lab entries.
 * Abnormal values are wrapped in **bold** for red highlight in RichText.
 */
function buildLabTable(entries) {
  const hasRanges = entries.some(e => e.range);
  const header = hasRanges
    ? '| Investigation | Result | Reference Range |\n|---|---|---|'
    : '| Investigation | Result |\n|---|---|';

  const rows = entries.map(e => {
    const abnormal = isAbnormalValue(e.value, e.range);
    const name  = abnormal ? `**${e.name}**`  : e.name;
    const value = abnormal ? `**${e.value}**` : e.value;
    return hasRanges
      ? `| ${name} | ${value} | ${e.range} |`
      : `| ${name} | ${value} |`;
  });

  return header + '\n' + rows.join('\n');
}

/**
 * Main stem transformer.
 * Finds lab sections in a stem and converts them to markdown tables.
 */
function transformStem(rawStem) {
  if (!rawStem) return rawStem;

  // If stem already contains a markdown table → leave completely untouched
  if (/\|\s*[-:]+\s*\|/.test(rawStem) || /\|---/.test(rawStem)) return rawStem;

  let stem = rawStem;
  let tablesAdded = 0;

  for (const headerReg of LAB_HEADERS) {
    // Find the header position
    const hMatch = headerReg.exec(stem);
    if (!hMatch) continue;

    const headerEnd = hMatch.index + hMatch[0].length;
    const beforeHeader = stem.slice(0, hMatch.index).trimEnd();
    const afterHeader  = stem.slice(headerEnd);

    // ── Try bullet/dash list format ──────────────────────────────────────
    // Look for consecutive lines that parse as lab values
    const lines = afterHeader.split('\n');
    const labEntries = [];
    let lastLabIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const parsed = parseLabLine(lines[i]);
      if (parsed) {
        labEntries.push(parsed);
        lastLabIdx = i;
      } else if (labEntries.length > 0 && lines[i].trim() === '') {
        // Allow one blank line gap, then stop
        break;
      } else if (labEntries.length > 0) {
        break;
      }
    }

    // ── Try inline comma-separated format ────────────────────────────────
    // e.g.: "Hb 9.2 g/dL, WBC 12.4, Platelets 420"
    if (labEntries.length === 0) {
      const firstLine = afterHeader.split('\n')[0] || '';
      const parts = firstLine.split(/,\s*/);
      let inlineEntries = [];
      for (const part of parts) {
        const parsed = parseLabLine(part.trim());
        if (parsed) inlineEntries.push(parsed);
      }
      if (inlineEntries.length >= 2) {
        // Build table and replace the inline list
        const table = buildLabTable(inlineEntries);
        const replaced = afterHeader.replace(firstLine, '');
        const headerPhrase2 = hMatch[0].replace(/[\s:–—\-]+$/, '');
        stem = `${beforeHeader}\n\n${headerPhrase2} show:\n\n${table}\n${replaced}`.replace(/\n{3,}/g, '\n\n');
        tablesAdded++;
        break;
      }
    }

    // Need at least 2 lab entries to make a table worthwhile
    if (labEntries.length >= 2) {
      const table = buildLabTable(labEntries);
      // Reconstruct: text before header + header phrase + table + remaining text
      const remaining = lines.slice(lastLabIdx + 1).join('\n').trimStart();
      // Strip trailing punctuation from header so we can add " show:"
      const headerPhrase = hMatch[0].replace(/[\s:–—\-]+$/, '');
      stem = [
        beforeHeader,
        `${headerPhrase} show:\n\n${table}`,
        remaining,
      ].filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n');
      tablesAdded++;
      break; // one table per stem is usually enough
    }
  }

  return stem;
}

let stemsConverted = 0;

// ─── Field-name fixer (snake_case DB → camelCase app) ─────────────────────────

function transformQuestion(q) {
  const correctAnswer = String(q.correctAnswer ?? q.correct_answer ?? '');
  const imageUrl      = q.imageUrl    ?? q.image_url    ?? '';
  const imageType     = q.imageType   ?? q.image_type   ?? null;
  const imageCaption  = q.imageCaption ?? q.image_caption ?? '';

  const rawExplanation = q.explanation || '';
  const transformed    = transformExplanation(rawExplanation);
  const finalExplanation = transformed.trim() ? transformed : rawExplanation.trim();

  const rawStem   = (q.stem || '').trim();
  const finalStem = transformStem(rawStem);
  if (finalStem !== rawStem) stemsConverted++;

  return {
    id:            String(q.id),
    part:          q.part          || 'Part 1',
    system:        q.system        || '',
    topic:         q.topic         || '',
    year:          q.year          || '',
    difficulty:    q.difficulty    || 'Medium',
    source:        q.source        || 'MRCP',
    stem:          finalStem,
    options:       Array.isArray(q.options) ? q.options : [],
    correctAnswer,
    explanation:   finalExplanation,
    reference:     q.reference     || '',
    tags:          Array.isArray(q.tags) ? q.tags : [],
    imageUrl:      imageUrl  || '',
    imageType:     imageType || null,
    imageCaption:  imageCaption || '',
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const inputFile  = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('Usage: node transform-questions.js <input.json> <output.json>');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ File not found: ${inputFile}`);
  process.exit(1);
}

let questions;
try {
  questions = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
} catch (e) {
  console.error(`❌ JSON parse error: ${e.message}`);
  process.exit(1);
}

const arr         = Array.isArray(questions) ? questions : [questions];
const transformed = arr.map(transformQuestion);

fs.writeFileSync(outputFile, JSON.stringify(transformed, null, 2), 'utf8');

// ── Summary ──
const withTables    = transformed.filter(q => q.stem.includes('|')).length;
const withRemember  = transformed.filter(q => q.explanation.includes('**Remember:**')).length;
const withWrong     = transformed.filter(q => q.explanation.includes('**Why the others')).length;

const withTables2   = transformed.filter(q => /\|\s*[-:]+\s*\|/.test(q.stem) || /\|---/.test(q.stem)).length;

console.log(`\n✅ Transformed ${transformed.length} questions → ${outputFile}`);
console.log(`   • ${stemsConverted} stems had lab values converted to tables`);
console.log(`   • ${withTables2} stems now contain markdown table syntax`);
console.log(`   • ${withWrong} explanations have "Why the others are wrong" section`);
console.log(`   • ${withRemember} explanations have "Remember" tip`);

// Show a preview of first stem that got a table
const firstTableQ = transformed.find(q => /\|---/.test(q.stem));
if (firstTableQ) {
  console.log(`\n📋 Preview — first stem with converted table (${firstTableQ.id}):\n`);
  console.log(firstTableQ.stem.slice(0, 600) + (firstTableQ.stem.length > 600 ? '...' : ''));
}
console.log(`\n📝 Preview — Q1 explanation:\n`);
console.log(transformed[0]?.explanation?.slice(0, 400) + '...\n');

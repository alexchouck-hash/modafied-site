import fs from 'node:fs';
import path from 'node:path';

const V1_DIR = path.resolve('./public/v1');

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`[modafied-site] could not read ${filePath}:`, e.message);
    return fallback;
  }
}

function readDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath).filter((f) => f.endsWith('.json'));
  } catch (e) {
    return [];
  }
}

export function getScorecards() {
  const dir = path.join(V1_DIR, 'scorecards');
  return readDir(dir).map((f) => readJson(path.join(dir, f), null)).filter(Boolean);
}

export function getRatings() {
  const dir = path.join(V1_DIR, 'ratings');
  return readDir(dir).map((f) => readJson(path.join(dir, f), null)).filter(Boolean);
}

export function getRatingMap() {
  const map = {};
  for (const rating of getRatings()) map[rating.source_id] = rating;
  return map;
}

export function getRankings() {
  return readJson(path.join(V1_DIR, 'rankings.json'), { categories: [], rating_version: null, generated_at: null, ordering: '' });
}

export function getCatalog() {
  return readJson(path.join(V1_DIR, 'catalog.json'), []);
}

export function getCatalogMap() {
  const map = {};
  for (const source of getCatalog()) map[source.id] = source;
  return map;
}

/** Emblem attestations, one per source, published at v1/emblems/<id>.json (ADR-0009 E7). */
export function getAttestations() {
  const dir = path.join(V1_DIR, 'emblems');
  return readDir(dir).map((f) => readJson(path.join(dir, f), null)).filter(Boolean);
}

export function getAttestationMap() {
  const map = {};
  for (const attestation of getAttestations()) map[attestation.source_id] = attestation;
  return map;
}

/** Every append-only trace ledger, flattened and newest first. One record per claim change. */
export function getTraceLedger() {
  const dir = path.join(V1_DIR, 'trace');
  let files = [];
  try {
    files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')) : [];
  } catch (e) {
    return [];
  }
  const records = [];
  for (const file of files) {
    let raw = '';
    try {
      raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    } catch (e) {
      continue;
    }
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(JSON.parse(trimmed));
      } catch (e) {
        console.error(`[modafied-site] bad ledger line in ${file}`);
      }
    }
  }
  records.sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at)));
  return records;
}

/**
 * Index of every trace id this site can resolve, current and superseded alike.
 * A superseded id still resolves: an emblem someone screenshotted last month has to stay
 * answerable, otherwise the trace is only as durable as the current publish (ADR-0009 E6).
 */
export function getTraceIndex() {
  const attestations = getAttestationMap();
  const index = {};
  for (const record of getTraceLedger()) {
    index[record.trace_id] = {
      record,
      attestation: attestations[record.source_id] ?? null,
      current: attestations[record.source_id]?.trace_id === record.trace_id,
    };
  }
  return index;
}

export function getManifest() {
  return readJson(path.join(V1_DIR, 'manifest.json'), { files: [], generated_at: null });
}

/** Rank position of a source within its category, or null when it is unranked. */
export function getRankPositions() {
  const positions = {};
  for (const category of getRankings().categories) {
    for (const row of category.ranked) {
      positions[row.source_id] = { rank: row.rank, of: category.ranked.length, category: category.category };
    }
  }
  return positions;
}

export const GRADE_COLORS = {
  A: { bg: '#dcfce7', fg: '#14532d', solid: '#15803d' },
  B: { bg: '#ecfccb', fg: '#365314', solid: '#4d7c0f' },
  C: { bg: '#fef3c7', fg: '#78350f', solid: '#b45309' },
  D: { bg: '#ffedd5', fg: '#7c2d12', solid: '#c2410c' },
  E: { bg: '#fee2e2', fg: '#7f1d1d', solid: '#b91c1c' },
};

export const NEUTRAL = { bg: '#f3f4f6', fg: '#374151', solid: '#4b5563' };

export function gradeColor(grade) {
  return GRADE_COLORS[grade] || NEUTRAL;
}

export function categoryLabel(category) {
  return String(category || '').replace(/-/g, ' ');
}

/** Human readable seconds, used wherever a measured value is printed beside a grade. */
export function humanSeconds(value) {
  if (value === null || value === undefined) return null;
  const seconds = Number(value);
  if (seconds < 90) return `${seconds.toFixed(0)}s`;
  if (seconds < 5400) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86400).toFixed(1)} d`;
}

export const DIMENSION_ORDER = [
  'freshness_lag',
  'revision_behavior',
  'correction_latency',
  'completeness_by_segment',
  'schema_stability',
  'internal_consistency',
];

export const DIMENSION_LABELS = {
  freshness_lag: 'Freshness lag',
  revision_behavior: 'Revision behavior',
  correction_latency: 'Correction latency',
  completeness_by_segment: 'Completeness',
  schema_stability: 'Schema stability',
  internal_consistency: 'Internal consistency',
};

/** Prints a graded value with its unit, so a grade never appears alone (H1, ADR-0008 D2). */
export function formatMeasured(dimension, entry) {
  if (!entry || entry.status !== 'ok' || entry.measured_value === null) return 'insufficient data';
  const value = entry.measured_value;
  switch (entry.measured_unit) {
    case 'ratio_of_declared_cadence':
      return `${value.toFixed(2)}x cadence`;
    case 'seconds':
      return humanSeconds(value);
    default:
      return `${value}%`;
  }
}

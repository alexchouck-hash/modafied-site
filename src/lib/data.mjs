import fs from 'node:fs';
import path from 'node:path';

const V1_DIR = path.resolve('./public/v1');

/**
 * Deployed base path. The site is authored for a root origin but currently served from a GitHub
 * Pages project path, so every internal link goes through u(). Set MODAFIED_BASE="" when the site
 * moves to its own domain and the links become root absolute again with no other edit.
 */
export const BASE = (process.env.MODAFIED_BASE ?? '/modafied-site').replace(/\/$/, '');

export function u(pathname) {
  const p = String(pathname ?? '');
  if (/^[a-z]+:/i.test(p) || p.startsWith('//')) return p;
  return BASE + (p.startsWith('/') ? p : '/' + p);
}



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

/**
 * Emblem attestations, one per source, published at v1/emblems/<id>.json (ADR-0009 E7).
 *
 * index.json lives in the same directory and is not an attestation: it carries membership and no
 * claim at all (ADR-0015 E8). Skipped by name, and then everything left is required to look like an
 * attestation, so a future non-attestation dropped in here surfaces as a missing card rather than
 * as an undefined source_id halfway through rendering.
 */
export function getAttestations() {
  const dir = path.join(V1_DIR, 'emblems');
  return readDir(dir)
    .filter((f) => f !== 'index.json')
    .map((f) => readJson(path.join(dir, f), null))
    .filter((doc) => doc && doc.source_id && doc.trace_id);
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

/**
 * Anchor kinds this method knows how to settle against, with the settle rule stated in prose so a
 * reader can check the number by hand. An accuracy figure names one of these; a figure that names
 * none of them is not publishable (H1, and plan v0.2 section 5.1: no accuracy without an anchor_ref).
 */
export const ANCHOR_KINDS = {
  later_observation_of_same_source: {
    label: 'Later observation of the same source',
    settle_rule:
      'A forecast is settled by the same publisher’s own later observation for the same key. The pair is admitted only when the observation was captured at or after the forecast, so nothing is graded against a value that was already known when the forecast was made.',
    independence:
      'Weak. Publisher and grader are the same organisation, so this measures self-consistency, not correspondence with the world. It is named this way on every card that uses it.',
  },
  other_source: {
    label: 'A different source',
    settle_rule:
      'A value is settled against an independent publisher measuring the same quantity, paired on the fields the catalog entry declares in anchor.pair_on.',
    independence: 'Stronger, and bounded by the anchor source’s own scorecard, which is published here like any other.',
  },
};

/**
 * The anchor registry: one entry per source that declares an anchor, joined to whatever that anchor
 * has actually settled so far. An entry with no accuracy block has an anchor and no samples yet,
 * which is a different statement from having no anchor at all.
 */
export function getAnchors() {
  const scorecards = {};
  for (const card of getScorecards()) scorecards[card.source_id] = card;
  const anchors = [];
  for (const source of getCatalog()) {
    if (!source.anchor) continue;
    const card = scorecards[source.id] ?? null;
    anchors.push({
      source_id: source.id,
      source_name: source.name ?? source.id,
      category: source.category ?? null,
      kind: source.anchor.kind,
      pair_on: source.anchor.pair_on ?? [],
      anchor_source: source.anchor.source ?? source.id,
      accuracy: card?.accuracy ?? null,
      window: card?.scoring_window ?? null,
    });
  }
  return anchors.sort((a, b) => a.source_id.localeCompare(b.source_id));
}

/** Anchor id used in links, so an accuracy figure on a card can point at the registry entry behind it. */
export function anchorSlug(sourceId, kind) {
  return `${sourceId}-${String(kind).replace(/_/g, '-')}`;
}

import type { StandardExamDataset, StandardExamRecord, StandardExamSourceLevel } from './types';

export type CalibrationBasis = 'rawScore' | 'percentile';

export type CalibrationMethod = 'exact_observed' | 'interpolated' | 'unavailable';

export interface CalibrationResult {
  method: CalibrationMethod;
  basis: CalibrationBasis;
  input: number;
  predictedConvertedScore?: number;
  interval?: [number, number];
  confidence: number;
  reason?: 'no_observed_anchors' | 'outside_observed_range' | 'insufficient_anchors';
}

interface Anchor {
  x: number;
  y: number;
}

const SOURCE_WEIGHTS: Record<StandardExamSourceLevel, number> = { A: 1, B: 0.75, C: 0.4 };
const VERIFICATION_WEIGHTS = { verified: 1, pending: 0.65, rejected: 0 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function standingPercentile(record: StandardExamRecord): number | undefined {
  if (record.percentile === undefined || record.percentileDefinition === undefined)
    return undefined;
  return record.percentileDefinition === 'above' ? record.percentile : 1 - record.percentile;
}

function observedAnchors(dataset: StandardExamDataset, basis: CalibrationBasis): Anchor[] {
  if (dataset.standardExam.verificationStatus === 'rejected') return [];
  const anchors = dataset.records
    .filter((record) => record.recordType === 'observed' && record.convertedScore !== undefined)
    .map((record) => {
      const x = basis === 'rawScore' ? record.rawScore : standingPercentile(record);
      return x === undefined ? undefined : { x, y: record.convertedScore! };
    })
    .filter((anchor): anchor is Anchor => anchor !== undefined)
    .sort((a, b) => a.x - b.x);

  const deduped: Anchor[] = [];
  for (const anchor of anchors) {
    const previous = deduped[deduped.length - 1];
    if (!previous || previous.x !== anchor.x) {
      deduped.push(anchor);
    } else {
      // Keep the conservative lower observed score if duplicated source rows exist.
      previous.y = Math.min(previous.y, anchor.y);
    }
  }
  return deduped;
}

function calibrationBaseConfidence(dataset: StandardExamDataset): number {
  return (
    SOURCE_WEIGHTS[dataset.standardExam.sourceLevel] *
    VERIFICATION_WEIGHTS[dataset.standardExam.verificationStatus]
  );
}

function interpolate(
  dataset: StandardExamDataset,
  basis: CalibrationBasis,
  input: number,
): CalibrationResult {
  const anchors = observedAnchors(dataset, basis);
  const base = calibrationBaseConfidence(dataset);

  if (anchors.length === 0) {
    return { method: 'unavailable', basis, input, confidence: 0, reason: 'no_observed_anchors' };
  }
  const exact = anchors.find((anchor) => anchor.x === input);
  if (exact) {
    return {
      method: 'exact_observed',
      basis,
      input,
      predictedConvertedScore: exact.y,
      interval: [exact.y, exact.y],
      confidence: base,
    };
  }
  if (anchors.length < 2) {
    return { method: 'unavailable', basis, input, confidence: 0, reason: 'insufficient_anchors' };
  }

  let left: Anchor | undefined;
  for (const anchor of anchors) {
    if (anchor.x < input) left = anchor;
    if (anchor.x >= input) break;
  }
  const right = anchors.find((anchor) => anchor.x > input);
  if (!left || !right) {
    return { method: 'unavailable', basis, input, confidence: 0, reason: 'outside_observed_range' };
  }

  const ratio = (input - left.x) / (right.x - left.x);
  const predicted = left.y + ratio * (right.y - left.y);
  const low = Math.min(left.y, right.y);
  const high = Math.max(left.y, right.y);
  const gap = right.x - left.x;
  const confidence = clamp(base * (1 - Math.min(0.4, gap * 0.4)), 0, 1);
  return {
    method: 'interpolated',
    basis,
    input,
    predictedConvertedScore: round(predicted),
    interval: [low, high],
    confidence: round(confidence, 3),
  };
}

/**
 * Estimate a converted score from the same standard exam's observed raw-score
 * anchors. Values outside the observed range are deliberately not extrapolated.
 */
export function calibrateRawScore(
  dataset: StandardExamDataset,
  rawScore: number,
): CalibrationResult {
  return interpolate(dataset, 'rawScore', rawScore);
}

/**
 * Estimate a converted score from a normalized standing percentile. The input
 * uses the same convention as the returned model: higher means better.
 */
export function calibratePercentile(
  dataset: StandardExamDataset,
  percentile: number,
): CalibrationResult {
  return interpolate(dataset, 'percentile', percentile);
}

export function sourceWeight(sourceLevel: StandardExamSourceLevel): number {
  return SOURCE_WEIGHTS[sourceLevel];
}

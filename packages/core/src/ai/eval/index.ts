export { runEval, evalCase } from './run';
export { computeDimensions } from './scoring';
export { allSamples, gradeMathSamples, gradeEssaySamples } from './samples';
export type { EvalCase, EvalResult, EvalReport, EvalDimension } from './types';
export { geometrySamples } from './geometry-samples';
export type { GeometryEvalCase } from './geometry-samples';
export {
  scoreGeometry,
  geometryOverallScore,
  geometryCasePassed,
  GEOMETRY_DIMENSIONS,
  GEOMETRY_CASE_PASS_THRESHOLD,
} from './geometry-scoring';
export type { GeometryDimension } from './geometry-scoring';
export { evalExpr } from './geometry-math';

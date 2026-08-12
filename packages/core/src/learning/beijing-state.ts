import { getServiceClient } from '../db';
import { beijingEducationStateSchema, standardExamDatasetSchema } from '../beijing';
import type { BeijingEducationState, StandardExamDataset, StandardExamRecord } from '../beijing';

function recordKey(record: StandardExamRecord): string {
  if (record.rawScore !== undefined) return `raw:${record.rawScore}`;
  return `range:${record.rawScoreMin}:${record.rawScoreMax}`;
}

/** Parse and persist one curated standard-exam dataset without deleting old evidence. */
export async function persistStandardExamDataset(
  input: unknown,
): Promise<{ examId: string; recordCount: number }> {
  const dataset = standardExamDatasetSchema.parse(input);
  const supabase = getServiceClient();
  const exam = dataset.standardExam;

  const { error: examError } = await supabase.from('standard_exams').upsert(
    {
      exam_id: exam.examId,
      schema_version: dataset.schemaVersion,
      exam_type: exam.examType,
      exam_stage: exam.examStage,
      subject: exam.subject,
      grade: exam.grade,
      region: exam.region,
      exam_date: exam.examDate,
      max_raw_score: exam.maxRawScore,
      max_converted_score: exam.maxConvertedScore ?? null,
      candidate_count: exam.candidateCount ?? null,
      source_level: exam.sourceLevel,
      source_name: exam.sourceName,
      source_url: exam.sourceUrl ?? null,
      verification_status: exam.verificationStatus,
      policy_version: exam.policyVersion ?? null,
      raw_payload: dataset,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'exam_id' },
  );
  if (examError) throw new Error(`standard exam metadata persist failed: ${examError.message}`);

  for (const record of dataset.records) {
    const { error } = await supabase.from('standard_exam_records').upsert(
      {
        exam_id: exam.examId,
        record_key: recordKey(record),
        raw_score: record.rawScore ?? null,
        raw_score_min: record.rawScoreMin ?? null,
        raw_score_max: record.rawScoreMax ?? null,
        rank: record.rank ?? null,
        percentile: record.percentile ?? null,
        percentile_definition: record.percentileDefinition ?? null,
        converted_score: record.convertedScore ?? null,
        grade_band: record.gradeBand ?? null,
        record_type: record.recordType,
        notes: record.notes ?? null,
      },
      { onConflict: 'exam_id,record_key' },
    );
    if (error) throw new Error(`standard exam record persist failed: ${error.message}`);
  }

  return { examId: exam.examId, recordCount: dataset.records.length };
}

/** Persist only user-declared Beijing education state; no recommendation is generated here. */
export async function persistBeijingEducationState(
  userId: string,
  input: unknown,
): Promise<BeijingEducationState> {
  const state = beijingEducationStateSchema.parse(input);
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from('beijing_education_states').upsert(
    {
      user_id: userId,
      region: state.region,
      grade: state.grade,
      stage: state.stage,
      selection_status: state.selection.status,
      selected_subjects: state.selection.subjects,
      selection_changed_at: state.selection.changedAt ?? null,
      qualification_status: state.qualificationStatus,
      subject_performance: state.subjectPerformance,
      policy_version: state.policyVersion,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(`Beijing education state persist failed: ${error.message}`);
  return { ...state, updatedAt: now };
}

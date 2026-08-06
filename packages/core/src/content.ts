import { getServiceClient } from './db';
import { requireAdmin } from './auth';
import { APP_PHASE, HIGH_SUBJECTS } from './constants';

export interface ContentRecord {
  id: string;
  phase: typeof APP_PHASE;
  subject: string;
  contentType: string;
  title: string;
  data: Record<string, unknown>;
}

/**
 * Lists all content records for the high-school phase (public read).
 */
export async function listContent(phase: typeof APP_PHASE = APP_PHASE): Promise<ContentRecord[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('app_content')
    .select('*')
    .eq('phase', phase)
    .order('subject');

  if (error) throw new Error(`listContent failed: ${error.message}`);
  return (data ?? []) as ContentRecord[];
}

export async function getContent(
  subject: string,
  contentType: string,
  phase: typeof APP_PHASE = APP_PHASE,
): Promise<ContentRecord | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('app_content')
    .select('*')
    .eq('phase', phase)
    .eq('subject', subject)
    .eq('content_type', contentType)
    .maybeSingle();

  if (error) throw new Error(`getContent failed: ${error.message}`);
  return data as ContentRecord | null;
}

export async function upsertContent(
  adminEmail: string,
  record: Omit<ContentRecord, 'id' | 'contentType' | 'phase'> & { contentType: string; phase?: typeof APP_PHASE },
): Promise<ContentRecord> {
  requireAdmin(adminEmail);

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('app_content')
    .upsert(
      {
        phase: record.phase ?? APP_PHASE,
        subject: record.subject,
        content_type: record.contentType,
        title: record.title,
        data: record.data,
      },
      { onConflict: 'phase, subject, content_type' },
    )
    .select()
    .single();

  if (error) throw new Error(`upsertContent failed: ${error.message}`);
  return data as ContentRecord;
}

export async function deleteContent(adminEmail: string, id: string): Promise<void> {
  requireAdmin(adminEmail);

  const supabase = getServiceClient();
  const { error } = await supabase.from('app_content').delete().eq('id', id);

  if (error) throw new Error(`deleteContent failed: ${error.message}`);
}

const SUBJECTS = [...HIGH_SUBJECTS];
const CONTENT_TYPES = ['system_prompt', 'exam_info', 'knowledge_tree', 'sample_questions'];

/** Seeds 9 subjects x 4 content_types placeholder records (high phase only). */
export async function seedAppContent(adminEmail: string): Promise<void> {
  requireAdmin(adminEmail);

  const supabase = getServiceClient();

  for (const subject of SUBJECTS) {
    for (const ct of CONTENT_TYPES) {
      const { error } = await supabase
        .from('app_content')
        .upsert(
          {
            phase: APP_PHASE,
            subject,
            content_type: ct,
            title: `\u9ad8\u4e2d${subject} ${ct}`,
            data: { placeholder: true, description: `\u5360\u4f4d ${subject} ${ct}` },
          },
          { onConflict: 'phase, subject, content_type' },
        );

      if (error) {
        console.warn(`seed: skip ${subject}/${ct} - ${error.message}`);
      }
    }
  }
}

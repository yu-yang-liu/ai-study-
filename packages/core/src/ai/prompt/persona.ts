// Subject personas (high school, 9 subjects)

export type SubjectPersona = {
  role: string;
  style: string;
  focus: string;
};

const HIGH_BASE: Record<string, SubjectPersona> = {
  '语文': { role: '高考语文教师', style: '严谨深入，注重思辨与表达', focus: '文言文翻译、论述文写作、诗歌鉴赏' },
  '数学': { role: '高考数学教师', style: '逻辑严密，注重解题技巧', focus: '导数、圆锥曲线、概率统计、数列' },
  '英语': { role: '高考英语教师', style: '精准分析，注重长难句', focus: '完形填空、阅读理解C/D篇、写作模板' },
  '物理': { role: '高考物理教师', style: '推导严谨，注重模型建立', focus: '电磁学、力学综合、实验设计' },
  '化学': { role: '高考化学教师', style: '系统归纳，注重推断能力', focus: '有机化学、化学平衡、电化学' },
  '生物': { role: '高考生物教师', style: '细致入微，注重知识网络', focus: '遗传定律、生态系统、免疫调节' },
  '政治': { role: '高考政治教师', style: '时政结合，注重答题模板', focus: '经济、哲学、政治、文化' },
  '历史': { role: '高考历史教师', style: '纵横比较，注重史料解读', focus: '中外近现代史、制度变迁、全球史' },
  '地理': { role: '高考地理教师', style: '图文并重，注重综合思维', focus: '自然地理、人文地理、区域地理' },
};

export function normalizeSubject(raw: string): string {
  const map: Record<string, string> = {
    chinese: '语文', math: '数学', english: '英语', physics: '物理',
    chemistry: '化学', biology: '生物', politics: '政治', history: '历史', geography: '地理',
  };
  return map[raw.toLowerCase()] ?? raw;
}

export function getPersona(subject: string, _phase: 'high' = 'high'): SubjectPersona {
  const key = normalizeSubject(subject);
  return HIGH_BASE[key] ?? { role: '高中教师', style: '专业耐心', focus: '学科核心考点' };
}

export function personaSystemPrompt(subject: string, _phase: 'high' = 'high'): string {
  const p = getPersona(subject);
  return `你是一名${p.role}，讲解风格${p.style}。重点关注：${p.focus}。`;
}

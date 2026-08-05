import type { TaskName } from '../gateway/types';

/**
 * Generates a JSON format instruction for a given task.
 * Uses a static map rather than introspecting zod internals (v4 incompatible).
 */
export function schemaToFormatInstruction(task: TaskName): string {
  const subjects = '\u8bed\u6587|\u6570\u5b66|\u82f1\u8bed|\u7269\u7406|\u5316\u5b66|\u751f\u7269|\u653f\u6cbb|\u5386\u53f2|\u5730\u7406';
  const qTypes = '\u9009\u62e9\u9898|\u586b\u7a7a\u9898|\u89e3\u7b54\u9898|\u8bc1\u660e\u9898|\u8ba1\u7b97\u9898|\u5176\u4ed6';

  const FORMATS: Record<string, string> = {
    ocr: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "text": "\u8bc6\u522b\u6587\u672c",
  "blocks": [{"type": "text"|"formula"|"image", "content": "...", "confidence": 0.95}]
}`,
    analyze: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "subject": "${subjects}",
  "questionType": "${qTypes}",
  "knowledgePoints": ["\u77e5\u8bc6\u70b91", "\u77e5\u8bc6\u70b92"],
  "difficulty": 1-10,
  "answer": "\u53c2\u8003\u7b54\u6848",
  "analysis": "\u89e3\u6790",
  "examPoints": "\u8003\u70b9\u8bf4\u660e"
}`,
    analyzeImg: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "subject": "${subjects}",
  "questionType": "${qTypes}",
  "knowledgePoints": ["\u77e5\u8bc6\u70b91"],
  "difficulty": 1-10,
  "answer": "\u53c2\u8003\u7b54\u6848",
  "analysis": "\u89e3\u6790"
}`,
    gradeMath: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "score": 85,
  "maxScore": 100,
  "isCorrect": true|false,
  "steps": [{"stepNumber": 1, "isCorrect": true, "feedback": "\u6b65\u9aa4\u8bc4\u4ef7"}],
  "summary": "\u603b\u4f53\u8bc4\u4ef7"
}`,
    gradeEssay: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "score": 45,
  "maxScore": 60,
  "dimensions": {"\u5185\u5bb9": 20, "\u8868\u8fbe": 15, "\u7ed3\u6784": 10},
  "strengths": ["\u4f18\u70b9"],
  "weaknesses": ["\u4e0d\u8db3"],
  "summary": "\u603b\u4f53\u8bc4\u4ef7"
}`,
    plan: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "title": "\u8ba1\u5212\u6807\u9898",
  "description": "\u8ba1\u5212\u8bf4\u660e",
  "tasks": [{"title": "\u4efb\u52a1", "subject": "\u5b66\u79d1", "knowledgePoints": ["\u77e5\u8bc6\u70b9"], "estimatedMinutes": 30, "priority": "\u9ad8|\u4e2d|\u4f4e", "reason": "\u539f\u56e0"}]
}`,
    chat: '',
    chatAgent: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "reply": "\u76f4\u63a5\u56de\u590d\u5b66\u751f\u7684\u6587\u672c\uff08\u65e0\u9700\u5de5\u5177\u65f6\u586b\u5199\uff09",
  "tool": {
    "name": "generate_plan|analyze_question|grade_submission|summarize_wrong_questions",
    "args": {}
  }
}
\u89c4\u5219\uff1a\u82e5\u53ef\u76f4\u63a5\u56de\u7b54\u5219\u53ea\u586b reply\uff1b\u82e5\u9700\u6267\u884c\u5de5\u5177\u5219\u586b tool\u3002\u4e0d\u8981\u540c\u65f6\u586b\u5199\u65e0\u6548\u7684 tool\u3002`,
  };

  return FORMATS[task] ?? '\u8bf7\u8f93\u51fa\u7b26\u5408\u8981\u6c42\u7684 JSON \u683c\u5f0f';
}

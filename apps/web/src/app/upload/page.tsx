'use client';

import { useState, useCallback } from 'react';
import { Button, Card, SubjectPicker, ErrorBanner, SuccessBanner, LayoutShell, PageTitle, Spinner } from '@ai-study/core/ui';

export default function UploadPage() {
  const [subject, setSubject] = useState('数学');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');
    setResult(null);
    setImageUrl(null);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) {
        setError(presign.error ?? '预签名失败');
        return;
      }

      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        setError(`上传失败 (${putRes.status})`);
        return;
      }

      setImageUrl(presign.url);
    } catch {
      setError('网络错误');
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze() {
    if (!imageUrl) return;
    setAnalyzing(true);
    setError('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? '分析失败'); return; }
      setResult(data);
    } catch {
      setError('网络错误');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <LayoutShell title={'\u0041\u0049\u9ad8\u4e2d'}>
      <PageTitle title="拍照分析" subtitle="上传题目图片，AI 自动识别并分析" />
      <Card>
        <div className="space-y-4">
          <SubjectPicker value={subject} onChange={setSubject} />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">选择图片</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFile}
              className="block w-full text-sm text-neutral-500 file:mr-4 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-700 hover:file:bg-neutral-200"
            />
          </div>
          {preview && (
            <div className="rounded-lg border p-2">
              <img src={preview} alt="预览" className="max-h-64 w-full rounded object-contain" />
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={handleUpload} loading={uploading} disabled={!file || !!imageUrl}>
              {imageUrl ? '已上传' : '上传到云端'}
            </Button>
            {imageUrl && (
              <Button variant="secondary" onClick={() => { setFile(null); setPreview(null); setImageUrl(null); setResult(null); }}>
                重新选择
              </Button>
            )}
          </div>
          {imageUrl && (
            <div className="mt-4">
              <SuccessBanner message="图片已上传，可开始分析" />
              <div className="mt-3">
                <Button onClick={handleAnalyze} loading={analyzing}>开始 AI 分析</Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {error && <div className="mt-4"><ErrorBanner message={error} onDismiss={() => setError('')} /></div>}

      {analyzing && <div className="mt-6"><Spinner /></div>}

      {result && (
        <Card className="mt-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">分析结果</h3>
          <div className="space-y-3">
            {Object.entries(result).map(([key, val]) => (
              <div key={key} className="flex gap-3">
                <span className="min-w-20 text-xs text-slate-400">{key}</span>
                <span className="text-sm font-medium text-slate-700">
                  {Array.isArray(val) ? val.join('、') : String(val)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </LayoutShell>
  );
}

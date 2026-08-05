import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { HIGH_SUBJECTS } from '../constants';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<string, string> = {
  primary: 'bg-slate-900 hover:bg-slate-800 text-white',
  secondary: 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

export function Button({ variant = 'primary', loading, children, disabled, className = '', ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded-xl bg-white p-6 border border-neutral-100 ${className}`} style={style}>{children}</div>;
}

export function Input({
  label,
  error,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>}
      <input
        className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none ${error ? 'border-red-400' : 'border-neutral-200'}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function Select({
  label,
  options,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLSelectElement> & { label?: string; options: Array<{ value: string; label: string }> }) {
  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>}
      <select
        className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Textarea({
  label,
  error,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>}
      <textarea
        className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none resize-y ${error ? 'border-red-400' : 'border-neutral-200'}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className="flex items-center justify-center py-8">
      <svg className={`animate-spin text-neutral-300 ${sizeClasses[size]}`} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600">&times;</button>
      )}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>;
}

export function SubjectPicker({
  value,
  onChange,
  label = '\u5b66\u79d1',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const subjects = [...HIGH_SUBJECTS];
  return (
    <Select
      label={label}
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      options={subjects.map((s) => ({ value: s, label: s }))}
    />
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    '高': 'bg-neutral-100 text-neutral-800',
    '中': 'bg-neutral-100 text-neutral-600',
    '低': 'bg-neutral-50 text-neutral-500',
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${map[priority] ?? 'bg-neutral-100 text-neutral-600'}`}>
      {priority}
    </span>
  );
}

export function ChatBubble({ role, content }: { role: 'user' | 'ai'; content: string }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          role === 'user' ? 'bg-slate-900 text-white' : 'bg-neutral-100 text-slate-900'
        }`}
      >
        {content}
      </div>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
    </div>
  );
}

export { LayoutShell } from './shell';

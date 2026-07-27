import { Bot, CheckCircle2, Circle, AlertCircle, Copy, Check, Clock } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';

const TOOL_LABELS = {
  get_schema:          { label: 'Reading schema',   color: 'text-blue-400'   },
  run_query:           { label: 'Executing query',  color: 'text-green-400'  },
  run_explain_analyze: { label: 'Analysing plan',   color: 'text-purple-400' },
  get_indexes:         { label: 'Checking indexes', color: 'text-yellow-400' },
  check_query_safety:  { label: 'Safety check',     color: 'text-orange-400' },
};

function parseError(raw = '') {
  if (!raw) return { title: 'Error', message: raw, isRateLimit: false };
  const isRateLimit = raw.includes('429') || raw.toLowerCase().includes('rate_limit')
    || raw.toLowerCase().includes('rate limit');
  if (isRateLimit) {
    const m = raw.match(/try again in ([0-9]+m[0-9.]+s|[0-9]+\.[0-9]+s)/i);
    return {
      title: 'Daily Token Limit Reached',
      message: `Free quota used. Try again in ${m ? m[1] : 'a few minutes'}.`,
      isRateLimit: true,
    };
  }
  return { title: 'Agent Error', message: raw, isRateLimit: false };
}

/** Bug 9: Copy button for a code block */
function CopyableCode({ children }) {
  const [copied, setCopied] = useState(false);
  const text = typeof children === 'string' ? children : String(children ?? '');
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1 rounded bg-gray-700/60 hover:bg-gray-600
                   opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy SQL"
      >
        {copied
          ? <Check size={11} className="text-green-400" />
          : <Copy size={11} className="text-gray-300" />
        }
      </button>
      <code className="block bg-[#0B0F14] p-3 pr-8 rounded-lg text-xs font-mono
                       text-green-300 overflow-x-auto whitespace-pre">
        {text}
      </code>
    </div>
  );
}

function StepItem({ step }) {
  const meta = TOOL_LABELS[step.tool] || { label: step.tool, color: 'text-gray-400' };
  return (
    <div className="step-item fade-in">
      <div className={clsx('flex-shrink-0', meta.color)}>
        {step.status === 'running'
          ? <Circle size={12} className="animate-pulse" />
          : <CheckCircle2 size={12} />
        }
      </div>
      <span className={meta.color}>{meta.label}</span>
    </div>
  );
}

function MarkdownReport({ content }) {
  return (
    <ReactMarkdown
      components={{
        code({ children, className }) {
          const isBlock = className?.includes('language-');
          return isBlock
            ? <CopyableCode>{children}</CopyableCode>
            : <code className="bg-surface px-1 py-0.5 rounded text-xs font-mono text-accent">{children}</code>;
        },
        pre({ children }) {
          return <pre className="my-2">{children}</pre>;
        },
        h2({ children }) {
          return <h2 className="text-sm font-bold text-white mt-4 mb-1.5">{children}</h2>;
        },
        p({ children }) {
          return <p className="text-xs text-gray-300 leading-relaxed mb-2">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc list-inside text-xs text-gray-300 mb-2 space-y-0.5">{children}</ul>;
        },
        li({ children }) {
          return <li className="text-xs text-gray-300">{children}</li>;
        },
        strong({ children }) {
          return <strong className="text-gray-100 font-semibold">{children}</strong>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function AIPanel({ state }) {
  const { agentStatus, agentReport, agentSteps, agentError } = state;
  const [copied, setCopied] = useState(false);

  const copyReport = () => {
    if (agentReport) {
      navigator.clipboard.writeText(agentReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const parsedError = agentError ? parseError(agentError) : null;

  // Deduplicate steps
  const uniqueSteps = agentSteps.reduce((acc, step) => {
    const idx = acc.findIndex(s => s.tool === step.tool);
    if (idx >= 0) { acc[idx] = step; } else { acc.push(step); }
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={13} className="text-accent" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            AI Assistant
          </span>
          {agentStatus === 'loading' && (
            <span className="flex gap-0.5">
              <span className="thinking-dot w-1 h-1 bg-accent rounded-full" />
              <span className="thinking-dot w-1 h-1 bg-accent rounded-full" />
              <span className="thinking-dot w-1 h-1 bg-accent rounded-full" />
            </span>
          )}
        </div>
        {agentReport && (
          <button onClick={copyReport} className="btn-ghost p-1" title="Copy report">
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* Idle */}
        {agentStatus === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Bot size={28} className="text-gray-700" />
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">AI Assistant</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Run a query, debug SQL, or ask a natural language question.
                The agent will analyse and respond here.
              </p>
            </div>
          </div>
        )}

        {/* Loading steps */}
        {agentStatus === 'loading' && (
          <div className="bg-surface rounded-lg p-3 space-y-1 fade-in">
            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Agent thinking…
            </p>
            {uniqueSteps.map((step, i) => <StepItem key={i} step={step} />)}
            {uniqueSteps.length === 0 && (
              <p className="text-xs text-gray-500 animate-pulse">Initialising…</p>
            )}
          </div>
        )}

        {/* Completed steps summary */}
        {agentStatus === 'success' && uniqueSteps.length > 0 && (
          <div className="bg-surface rounded-lg p-3 space-y-1 fade-in">
            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Completed {uniqueSteps.length} step{uniqueSteps.length !== 1 ? 's' : ''}
            </p>
            {uniqueSteps.map((step, i) => (
              <StepItem key={i} step={{ ...step, status: 'completed' }} />
            ))}
          </div>
        )}

        {/* Full report */}
        {agentStatus === 'success' && agentReport && (
          <div className="prose prose-invert prose-xs max-w-none fade-in">
            <MarkdownReport content={agentReport} />
          </div>
        )}

        {/* Error */}
        {agentStatus === 'error' && parsedError && (
          <div className={clsx(
            'rounded-lg p-3 fade-in border',
            parsedError.isRateLimit
              ? 'bg-yellow-900/20 border-yellow-800/50'
              : 'bg-red-900/20 border-red-800/50'
          )}>
            <div className="flex items-center gap-2 mb-2">
              {parsedError.isRateLimit
                ? <Clock size={13} className="text-yellow-400" />
                : <AlertCircle size={13} className="text-red-400" />
              }
              <span className={clsx(
                'text-xs font-semibold',
                parsedError.isRateLimit ? 'text-yellow-400' : 'text-red-400'
              )}>
                {parsedError.title}
              </span>
            </div>
            <p className={clsx(
              'text-xs leading-relaxed',
              parsedError.isRateLimit ? 'text-yellow-300' : 'text-red-300'
            )}>
              {parsedError.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
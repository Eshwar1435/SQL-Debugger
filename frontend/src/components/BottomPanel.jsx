import { Table2, GitBranch, AlertCircle, Loader2, Clock } from 'lucide-react';
import { ACTIONS } from '../store/useAppState';
import clsx from 'clsx';

function parseError(raw = '') {
  if (!raw) return { title: 'Error', message: raw, isRateLimit: false };
  const isRateLimit = raw.includes('429') || raw.toLowerCase().includes('rate_limit') || raw.toLowerCase().includes('rate limit');
  if (isRateLimit) {
    const waitMatch = raw.match(/try again in ([0-9]+m[0-9.]+s|[0-9]+\.[0-9]+s)/i);
    const waitTime  = waitMatch ? waitMatch[1] : 'a few minutes';
    return { title: 'Daily Token Limit Reached', message: `You've used your free daily AI quota. Please try again in ${waitTime}.`, isRateLimit: true };
  }
  if (raw.includes('ECONNREFUSED') || raw.includes('Network Error')) {
    return { title: 'Backend Offline', message: 'Cannot reach the backend. Make sure it is running on port 8000.', isRateLimit: false };
  }
  if (raw.includes('PostgreSQL error:')) {
    return { title: 'SQL Error', message: raw.replace('PostgreSQL error:', '').trim(), isRateLimit: false };
  }
  return { title: 'Error', message: raw, isRateLimit: false };
}

function ResultsTable({ result }) {
  if (!result?.rows) return null;
  const { rows, columns, row_count, truncated, total_count } = result;
  if (rows.length === 0) {
    return <div className="flex items-center justify-center h-full"><p className="text-xs text-gray-500">Query returned 0 rows.</p></div>;
  }
  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-border flex-shrink-0 flex items-center gap-3">
        <span className="text-xs text-gray-500">
          {row_count} row{row_count !== 1 ? 's' : ''}
          {truncated && <span className="ml-1 text-yellow-500">(showing {row_count} of {total_count})</span>}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead className="sticky top-0 bg-surface z-10">
            <tr>{columns.map((col) => <th key={col} className="px-3 py-2 text-left text-gray-400 font-semibold border-b border-border uppercase tracking-wider whitespace-nowrap">{col}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/30 hover:bg-surface/50 transition-colors">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 text-gray-300 whitespace-nowrap max-w-xs truncate" title={String(row[col] ?? '')}>
                    {row[col] === null ? <span className="text-gray-600 italic">null</span>
                      : typeof row[col] === 'boolean' ? <span className={row[col] ? 'text-green-400' : 'text-red-400'}>{String(row[col])}</span>
                      : typeof row[col] === 'number' ? <span className="text-blue-300">{row[col]}</span>
                      : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanNode({ node, depth = 0 }) {
  if (!node) return null;
  const nodeType  = node['Node Type'] || '';
  const relation  = node['Relation Name'] ? ` on "${node['Relation Name']}"` : '';
  const cost      = typeof node['Total Cost'] === 'number' ? node['Total Cost'].toFixed(2) : '?';
  const rows      = node['Actual Rows'] ?? node['Plan Rows'] ?? '?';
  const time      = typeof node['Actual Total Time'] === 'number' ? node['Actual Total Time'].toFixed(2) : null;
  const isSeqScan = nodeType === 'Seq Scan';
  const isExp     = (node['Total Cost'] || 0) > 500;

  return (
    <div style={{ paddingLeft: depth * 20 }} className="fade-in">
      <div className={clsx('flex items-center gap-2 py-1.5 px-2 rounded text-xs font-mono hover:bg-surface/50 transition-colors',
        isSeqScan ? 'text-yellow-400' : isExp ? 'text-orange-400' : 'text-gray-300')}>
        {depth > 0 && <span className="text-gray-600 flex-shrink-0 select-none">└─</span>}
        <span className="font-bold">{nodeType}{relation}</span>
        <span className="text-gray-500">cost={cost}</span>
        <span className="text-gray-500">rows={rows}</span>
        {time && <span className="text-gray-500">{time}ms</span>}
        {isSeqScan && <span className="ml-1 text-yellow-500 text-xs bg-yellow-900/30 px-1.5 py-0.5 rounded">⚠ seq scan</span>}
      </div>
      {(node.Plans || []).map((child, i) => <PlanNode key={i} node={child} depth={depth + 1} />)}
    </div>
  );
}

function ExecutionPlan({ plan }) {
  let planData = null;
  if (Array.isArray(plan) && plan.length > 0) planData = plan[0];
  else if (plan && typeof plan === 'object' && plan['Plan']) planData = plan;

  if (!planData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
        <GitBranch size={24} className="text-gray-700" />
        <p className="text-xs text-gray-500">No execution plan yet.</p>
        <p className="text-xs text-gray-600">Run a query in <span className="text-accent font-semibold">Query</span> mode with SQL to see the plan.</p>
      </div>
    );
  }

  const execTime = typeof planData['Execution Time'] === 'number' ? planData['Execution Time'].toFixed(2) : null;
  const planTime = typeof planData['Planning Time']  === 'number' ? planData['Planning Time'].toFixed(2)  : null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-border flex-shrink-0 flex items-center gap-4 flex-wrap">
        {execTime && <span className="text-xs text-gray-500">Execution: <span className="text-white font-mono">{execTime}ms</span></span>}
        {planTime && <span className="text-xs text-gray-500">Planning: <span className="text-white font-mono">{planTime}ms</span></span>}
        <span className="text-xs text-yellow-500/70">⚠ Yellow = sequential scan (consider index)</span>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {planData['Plan'] ? <PlanNode node={planData['Plan']} /> : <p className="text-xs text-gray-500">Plan data unavailable.</p>}
      </div>
    </div>
  );
}

export default function BottomPanel({ state, dispatch }) {
  const { queryStatus, queryResult, queryError, executionPlan, activeResultTab } = state;
  const parsedError = queryError ? parseError(queryError) : null;

  return (
    <div className="flex flex-col h-full panel">
      <div className="flex items-center border-b border-border flex-shrink-0 px-2">
        <button onClick={() => dispatch({ type: ACTIONS.SET_RESULT_TAB, payload: 'results' })} className={clsx('tab', activeResultTab === 'results' && 'tab-active')}>
          <span className="flex items-center gap-1.5"><Table2 size={12} /> Results</span>
        </button>
        <button onClick={() => dispatch({ type: ACTIONS.SET_RESULT_TAB, payload: 'plan' })} className={clsx('tab', activeResultTab === 'plan' && 'tab-active')}>
          <span className="flex items-center gap-1.5"><GitBranch size={12} /> Execution Plan</span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {queryStatus === 'loading' && (
          <div className="flex items-center justify-center h-full gap-2">
            <Loader2 size={14} className="animate-spin text-accent" />
            <span className="text-xs text-gray-400">Running...</span>
          </div>
        )}
        {queryStatus === 'error' && parsedError && (
          <div className="p-4 fade-in">
            <div className={clsx('rounded-lg p-3 border', parsedError.isRateLimit ? 'bg-yellow-900/20 border-yellow-800/50' : 'bg-red-900/20 border-red-800/50')}>
              <div className="flex items-center gap-2 mb-2">
                {parsedError.isRateLimit ? <Clock size={13} className="text-yellow-400" /> : <AlertCircle size={13} className="text-red-400" />}
                <span className={clsx('text-xs font-semibold', parsedError.isRateLimit ? 'text-yellow-400' : 'text-red-400')}>{parsedError.title}</span>
              </div>
              <p className={clsx('text-xs leading-relaxed font-mono', parsedError.isRateLimit ? 'text-yellow-300' : 'text-red-300')}>{parsedError.message}</p>
            </div>
          </div>
        )}
        {queryStatus === 'idle' && activeResultTab === 'results' && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-gray-600">Run a query to see results here.</p>
          </div>
        )}
        {queryStatus === 'success' && activeResultTab === 'results' && (
          <div className="h-full fade-in">
            {queryResult ? <ResultsTable result={queryResult} /> : (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-gray-500">Agent completed. See AI panel for the full report.</p>
              </div>
            )}
          </div>
        )}
        {activeResultTab === 'plan' && <div className="h-full fade-in"><ExecutionPlan plan={executionPlan} /></div>}
      </div>
    </div>
  );
}
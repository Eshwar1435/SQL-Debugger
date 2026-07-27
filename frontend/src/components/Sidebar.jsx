import { Trash2, Clock, Code2, MessageSquare, X, RotateCcw } from 'lucide-react';
import { ACTIONS } from '../store/useAppState';
import clsx from 'clsx';

/**
 * Bug 1 fix: ChatGPT-style relative timestamps
 * "Today 2:15 PM" / "Yesterday 4:30 PM" / "Jul 6, 2:15 PM"
 */
function formatTimestamp(iso) {
  const date  = new Date(iso);
  const now   = new Date();
  const time  = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return `Today ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;

  // Within this year: "Jul 6, 2:15 PM"
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${time}`;
  }

  // Older: "Jul 6 2024, 2:15 PM"
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + `, ${time}`;
}

export default function Sidebar({ state, dispatch, onClose }) {
  const { history } = state;

  const handleLoad = (item) => {
    // Bug 8 fix: restore full session
    dispatch({ type: ACTIONS.LOAD_HISTORY_ITEM, payload: item });
  };

  const handleDelete = (e, index) => {
    e.stopPropagation();
    dispatch({ type: ACTIONS.REMOVE_HISTORY, payload: index });
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all history? This cannot be undone.')) {
      dispatch({ type: ACTIONS.CLEAR_ALL_HISTORY });
    }
  };

  return (
    <div className="flex flex-col h-full panel">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-accent" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">History</span>
          {history.length > 0 && (
            <span className="text-xs text-gray-600">({history.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="btn-ghost p-1 hover:text-red-400"
              title="Clear all history"
            >
              <RotateCcw size={12} />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="btn-ghost p-1">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
            <Clock size={24} className="text-gray-600" />
            <p className="text-xs text-gray-500">
              No queries yet. Run your first query to see history here.
            </p>
          </div>
        ) : (
          <div className="py-1">
            {history.map((item, index) => (
              <div
                key={item.id}
                onClick={() => handleLoad(item)}
                className="group relative px-3 py-2.5 cursor-pointer border-b border-border/50 hover:bg-surface transition-colors fade-in"
              >
                {/* Row 1: mode badge + timestamp */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {item.mode === 'sql'
                      ? <Code2 size={11} className="text-accent" />
                      : <MessageSquare size={11} className="text-blue-400" />
                    }
                    <span className={clsx(
                      'text-xs font-mono font-semibold uppercase',
                      item.mode === 'sql' ? 'text-accent' : 'text-blue-400'
                    )}>
                      {item.mode}
                    </span>
                    {item.activeMode && item.activeMode !== 'query' && (
                      <span className="text-xs text-gray-600">· {item.activeMode}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600 whitespace-nowrap">
                      {formatTimestamp(item.timestamp)}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, index)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-600 hover:text-red-400 transition-all ml-1"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Row 2: query preview */}
                <p className="text-xs text-gray-400 font-mono truncate leading-relaxed">
                  {item.mode === 'sql'
                    ? (item.sql     || '').substring(0, 55) + ((item.sql     || '').length > 55 ? '…' : '')
                    : (item.nlQuery || '').substring(0, 55) + ((item.nlQuery || '').length > 55 ? '…' : '')
                  }
                </p>

                {/* Row 3: status + data indicators */}
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className={clsx(
                    'text-xs px-1.5 py-0.5 rounded font-medium',
                    item.status === 'success' ? 'bg-green-900/40 text-green-400'
                    : item.status === 'error'  ? 'bg-red-900/40 text-red-400'
                    : 'bg-gray-800 text-gray-500'
                  )}>
                    {item.status}
                  </span>
                  {item.queryResult   && <span className="text-xs text-gray-600">{item.queryResult.row_count} rows</span>}
                  {item.agentReport   && <span className="text-xs text-gray-600">· report</span>}
                  {item.executionPlan && <span className="text-xs text-gray-600">· plan</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
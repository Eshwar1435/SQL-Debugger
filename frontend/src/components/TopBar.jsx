import { Menu, Bot, Database } from 'lucide-react';
import clsx from 'clsx';
import { ACTIONS } from '../store/useAppState';

const MODES = [
  { id: 'query',     label: 'Query'    },
  { id: 'debug',     label: 'Debug'    },
  { id: 'optimize',  label: 'Optimize' },
  { id: 'explain',   label: 'Explain'  },
  { id: 'nl_to_sql', label: 'NL → SQL' },
];

export default function TopBar({
  state, dispatch,
  onMenuClick, onAiClick,
  aiPanelOpen, isMobile,
}) {
  const handleModeClick = (modeId) => {
    dispatch({ type: ACTIONS.SET_ACTIVE_MODE, payload: modeId });
    // NL→SQL mode auto-switches to natural language input
    if (modeId === 'nl_to_sql') {
      dispatch({ type: ACTIONS.SET_MODE, payload: 'nl' });
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="btn-ghost p-1.5">
          <Menu size={16} />
        </button>
        <div className="flex items-center gap-2">
          <Database size={16} className="text-accent" />
          <span className="font-serif text-sm font-bold text-white">SQL AI Agent</span>
        </div>
      </div>

      {/* Center — mode tabs */}
      {!isMobile && (
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeClick(m.id)}
              className={clsx(
                'px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150',
                state.activeMode === m.id
                  ? 'bg-accent text-black'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* SQL / NL toggle */}
        <div className="mode-toggle">
          <button
            onClick={() => dispatch({ type: ACTIONS.SET_MODE, payload: 'sql' })}
            className={clsx('mode-btn', state.mode === 'sql' && 'mode-btn-active')}
          >
            SQL
          </button>
          <button
            onClick={() => dispatch({ type: ACTIONS.SET_MODE, payload: 'nl' })}
            className={clsx('mode-btn', state.mode === 'nl' && 'mode-btn-active')}
          >
            Natural Language
          </button>
        </div>

        {/* AI panel toggle */}
        <button
          onClick={onAiClick}
          className={clsx('btn-ghost p-1.5', aiPanelOpen && 'text-accent')}
          title="Toggle AI Panel"
        >
          <Bot size={16} />
        </button>
      </div>
    </div>
  );
}
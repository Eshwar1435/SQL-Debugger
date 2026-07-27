import Editor from '@monaco-editor/react';
import { Play, Zap, Bug, Eye, RotateCcw } from 'lucide-react';
import { ACTIONS } from '../store/useAppState';
import { runQuery, explainQuery, runAgent, analyzeQuery } from '../api/client';

const MODE_LABELS = {
  query:     { label: 'Run Query', icon: Play },
  debug:     { label: 'Debug',     icon: Bug  },
  optimize:  { label: 'Optimize',  icon: Zap  },
  explain:   { label: 'Explain',   icon: Eye  },
  nl_to_sql: { label: 'Convert',   icon: Zap  },
};

/**
 * Extract the final SQL from the agent's markdown report.
 * Tries multiple patterns in order of reliability.
 */
function extractSqlFromReport(report = '') {
  if (!report) return null;

  // 1. ```sql ... ``` block (most reliable — enforced by system prompt)
  const fenced = report.match(/```sql\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();

  // 2. Plain ``` block that starts with SELECT
  const plain = report.match(/```\s*(SELECT[\s\S]*?)```/i);
  if (plain?.[1]?.trim()) return plain[1].trim();

  // 3. "Final SQL" section followed by a SELECT statement
  const finalSection = report.match(
    /##.*?final sql[^#\n]*\n+([\s\S]*?)(?=\n##|\n---|\n\*\*|$)/i
  );
  if (finalSection) {
    const candidate = finalSection[1]
      .replace(/```sql|```/gi, '')
      .trim();
    if (candidate.toUpperCase().startsWith('SELECT')) return candidate;
  }

  // 4. Any SELECT statement in the report
  const inline = report.match(/(?:^|\n)(SELECT\s[\s\S]+?)(?:;|\n\n|$)/i);
  if (inline?.[1]?.trim()) return inline[1].trim().replace(/;$/, '');

  return null;
}

export default function EditorPanel({ state, dispatch, addHistory }) {
  const { mode, sql, nlQuery, activeMode, queryStatus, agentStatus } = state;
  const isLoading = queryStatus === 'loading' || agentStatus === 'loading';

  const handleRun = async () => {
    if (isLoading) return;

    // ── Bug 7 fix: always clear old plan before running a new query ───────────
    dispatch({ type: ACTIONS.SET_EXECUTION_PLAN, payload: null });

    // ── Direct SQL Query mode ─────────────────────────────────────────────────
    if (activeMode === 'query' && mode === 'sql') {
      if (!sql.trim()) return;
      dispatch({ type: ACTIONS.QUERY_START });
      dispatch({ type: ACTIONS.AGENT_RESET });

      try {
        // Run query and EXPLAIN in parallel
        const [result, planResult] = await Promise.allSettled([
          runQuery(sql),
          explainQuery(sql),
        ]);

        const queryResult = result.status === 'fulfilled'     ? result.value          : null;
        const planData    = planResult.status === 'fulfilled' ? planResult.value?.plan : null;

        if (queryResult) {
          dispatch({ type: ACTIONS.QUERY_SUCCESS, payload: queryResult });
        } else {
          dispatch({
            type: ACTIONS.QUERY_ERROR,
            payload: result.reason?.response?.data?.detail || result.reason?.message || 'Query failed',
          });
        }

        if (planData) {
          dispatch({ type: ACTIONS.SET_EXECUTION_PLAN, payload: planData });
        }

        // Bug 3 fix: AI analysis for Query mode
        if (queryResult) {
          dispatch({ type: ACTIONS.AGENT_START });
          try {
            const { analysis } = await analyzeQuery(sql);
            dispatch({
              type: ACTIONS.AGENT_SUCCESS,
              payload: { report: analysis, finalSql: sql, steps: [] },
            });
          } catch (_) {
            // AI analysis is non-critical — don't fail the whole query
            dispatch({ type: ACTIONS.AGENT_RESET });
          }
        }

        addHistory({
          mode: 'sql', activeMode: 'query', sql,
          queryResult,
          executionPlan: planData,
          status: queryResult ? 'success' : 'error',
        });

      } catch (err) {
        dispatch({ type: ACTIONS.QUERY_ERROR, payload: err.message });
      }
      return;
    }

    // ── Agent modes (debug / optimize / explain / nl_to_sql) ─────────────────
    const agentMessage = mode === 'nl' ? nlQuery : `${activeMode} this SQL query`;
    const agentSql     = mode === 'sql' ? sql : null;
    if (!agentMessage.trim() && !agentSql) return;

    dispatch({ type: ACTIONS.AGENT_START });
    dispatch({ type: ACTIONS.QUERY_START });

    try {
      const result = await runAgent(
        agentMessage,
        agentSql,
        activeMode === 'query' ? 'auto' : activeMode,
      );

      dispatch({
        type: ACTIONS.AGENT_SUCCESS,
        payload: {
          report:   result.report,
          finalSql: result.final_sql,
          steps:    result.steps || [],
        },
      });

      // Bug 5 fix: extract SQL and actually run it so Results + Plan populate
      const extractedSql = result.final_sql || extractSqlFromReport(result.report);
      let queryResult    = null;
      let planData       = null;

      if (extractedSql) {
        // Put the generated/corrected SQL into the editor
        dispatch({ type: ACTIONS.SET_SQL, payload: extractedSql });

        try {
          const [queryRes, planRes] = await Promise.allSettled([
            runQuery(extractedSql),
            explainQuery(extractedSql),
          ]);

          if (queryRes.status === 'fulfilled') {
            queryResult = queryRes.value;
            dispatch({ type: ACTIONS.QUERY_SUCCESS, payload: queryResult });
          } else {
            dispatch({ type: ACTIONS.QUERY_SUCCESS, payload: null });
          }

          if (planRes.status === 'fulfilled') {
            planData = planRes.value?.plan ?? null;
            dispatch({ type: ACTIONS.SET_EXECUTION_PLAN, payload: planData });
          }
        } catch (_) {
          dispatch({ type: ACTIONS.QUERY_SUCCESS, payload: null });
        }
      } else {
        dispatch({ type: ACTIONS.QUERY_SUCCESS, payload: null });
      }

      addHistory({
        mode,
        activeMode,
        sql:           extractedSql || agentSql || '',
        nlQuery:       mode === 'nl' ? nlQuery : null,
        agentReport:   result.report,
        agentSteps:    result.steps || [],
        agentFinalSql: extractedSql || result.final_sql,
        queryResult,
        executionPlan: planData,
        status: 'success',
      });

    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Agent error';
      dispatch({ type: ACTIONS.AGENT_ERROR, payload: msg });
      dispatch({ type: ACTIONS.QUERY_ERROR, payload: msg });
      addHistory({
        mode, activeMode,
        sql:     agentSql || '',
        nlQuery: mode === 'nl' ? nlQuery : null,
        status:  'error',
      });
    }
  };

  const handleClear = () => {
    dispatch({ type: ACTIONS.SET_SQL,      payload: '' });
    dispatch({ type: ACTIONS.SET_NL_QUERY, payload: '' });
    dispatch({ type: ACTIONS.CLEAR_RESULTS });
  };

  const ActionIcon  = MODE_LABELS[activeMode]?.icon  || Play;
  const actionLabel = MODE_LABELS[activeMode]?.label || 'Run';

  return (
    <div className="flex flex-col h-full panel">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">
          {mode === 'sql' ? 'SQL Editor' : 'Natural Language'}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={handleClear} className="btn-ghost" title="Clear">
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Clear</span>
          </button>
          <button onClick={handleRun} disabled={isLoading} className="btn-primary">
            {isLoading ? (
              <>
                <span className="flex gap-0.5">
                  <span className="thinking-dot w-1 h-1 bg-black rounded-full" />
                  <span className="thinking-dot w-1 h-1 bg-black rounded-full" />
                  <span className="thinking-dot w-1 h-1 bg-black rounded-full" />
                </span>
                Running...
              </>
            ) : (
              <><ActionIcon size={13} />{actionLabel}</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {mode === 'sql' ? (
          <Editor
            height="100%"
            defaultLanguage="sql"
            value={sql}
            onChange={(val) => dispatch({ type: ACTIONS.SET_SQL, payload: val || '' })}
            theme="vs-dark"
            options={{
              fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
              minimap: { enabled: false }, lineNumbers: 'on',
              scrollBeyondLastLine: false, wordWrap: 'on', padding: { top: 12 },
              renderLineHighlight: 'line', cursorBlinking: 'smooth', smoothScrolling: true,
            }}
          />
        ) : (
          <div className="h-full p-4 flex flex-col gap-3">
            <textarea
              value={nlQuery}
              onChange={(e) => dispatch({ type: ACTIONS.SET_NL_QUERY, payload: e.target.value })}
              placeholder={`Ask anything about your database in plain English...\n\nExamples:\n• Show me all users who signed up in the last 7 days\n• Find the top 5 customers by total spending\n• Show completed orders from USA sorted by amount`}
              className="flex-1 w-full bg-transparent text-gray-200 text-sm font-sans
                         placeholder-gray-600 resize-none outline-none leading-relaxed"
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleRun(); }}
            />
            <p className="text-xs text-gray-600">
              Press <kbd className="px-1 py-0.5 bg-surface rounded text-gray-400">Ctrl+Enter</kbd> to run
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
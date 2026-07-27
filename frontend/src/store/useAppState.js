import { useReducer, useCallback } from 'react';

const initialState = {
  mode:      'sql',
  sql:       '',
  nlQuery:   '',
  activeMode: 'query',

  queryStatus:  'idle',
  queryResult:  null,
  queryError:   null,
  executionPlan: null,

  agentStatus:   'idle',
  agentReport:   null,
  agentSteps:    [],
  agentFinalSql: null,
  agentError:    null,

  history: JSON.parse(localStorage.getItem('queryHistory') || '[]'),

  activeResultTab: 'results',
};

export const ACTIONS = {
  SET_MODE:        'SET_MODE',
  SET_SQL:         'SET_SQL',
  SET_NL_QUERY:    'SET_NL_QUERY',
  SET_ACTIVE_MODE: 'SET_ACTIVE_MODE',

  QUERY_START:   'QUERY_START',
  QUERY_SUCCESS: 'QUERY_SUCCESS',
  QUERY_ERROR:   'QUERY_ERROR',

  AGENT_START:   'AGENT_START',
  AGENT_SUCCESS: 'AGENT_SUCCESS',
  AGENT_ERROR:   'AGENT_ERROR',
  AGENT_RESET:   'AGENT_RESET',

  SET_EXECUTION_PLAN: 'SET_EXECUTION_PLAN',
  SET_RESULT_TAB:     'SET_RESULT_TAB',

  ADD_HISTORY:       'ADD_HISTORY',
  REMOVE_HISTORY:    'REMOVE_HISTORY',
  CLEAR_ALL_HISTORY: 'CLEAR_ALL_HISTORY',
  LOAD_HISTORY_ITEM: 'LOAD_HISTORY_ITEM',
  CLEAR_RESULTS:     'CLEAR_RESULTS',
};

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_MODE:        return { ...state, mode:       action.payload };
    case ACTIONS.SET_SQL:         return { ...state, sql:        action.payload };
    case ACTIONS.SET_NL_QUERY:    return { ...state, nlQuery:    action.payload };
    case ACTIONS.SET_ACTIVE_MODE: return { ...state, activeMode: action.payload };

    case ACTIONS.QUERY_START:
      return { ...state, queryStatus: 'loading', queryError: null };
    case ACTIONS.QUERY_SUCCESS:
      return { ...state, queryStatus: 'success', queryResult: action.payload, queryError: null };
    case ACTIONS.QUERY_ERROR:
      return { ...state, queryStatus: 'error', queryError: action.payload, queryResult: null };

    case ACTIONS.AGENT_START:
      return { ...state, agentStatus: 'loading', agentReport: null, agentSteps: [], agentFinalSql: null, agentError: null };
    case ACTIONS.AGENT_SUCCESS:
      return { ...state, agentStatus: 'success', agentReport: action.payload.report, agentFinalSql: action.payload.finalSql, agentSteps: action.payload.steps || [] };
    case ACTIONS.AGENT_ERROR:
      return { ...state, agentStatus: 'error', agentError: action.payload };
    case ACTIONS.AGENT_RESET:
      return { ...state, agentStatus: 'idle', agentReport: null, agentSteps: [], agentFinalSql: null, agentError: null };

    case ACTIONS.SET_EXECUTION_PLAN: return { ...state, executionPlan: action.payload };
    case ACTIONS.SET_RESULT_TAB:     return { ...state, activeResultTab: action.payload };

    case ACTIONS.ADD_HISTORY: {
      const last = state.history[0];
      if (
        last &&
        last.sql     === action.payload.sql &&
        last.nlQuery === action.payload.nlQuery &&
        Date.now() - new Date(last.timestamp).getTime() < 2000
      ) return state;
      const updated = [action.payload, ...state.history].slice(0, 50);
      localStorage.setItem('queryHistory', JSON.stringify(updated));
      return { ...state, history: updated };
    }

    case ACTIONS.REMOVE_HISTORY: {
      const updated = state.history.filter((_, i) => i !== action.payload);
      localStorage.setItem('queryHistory', JSON.stringify(updated));
      return { ...state, history: updated };
    }

    case ACTIONS.CLEAR_ALL_HISTORY: {
      localStorage.removeItem('queryHistory');
      return { ...state, history: [] };
    }

    case ACTIONS.LOAD_HISTORY_ITEM:
      return {
        ...state,
        mode:       action.payload.mode       || 'sql',
        sql:        action.payload.sql        || '',
        nlQuery:    action.payload.nlQuery    || '',
        activeMode: action.payload.activeMode || 'query',

        queryStatus:  action.payload.queryResult  ? 'success' : 'idle',
        queryResult:  action.payload.queryResult  || null,
        executionPlan: action.payload.executionPlan || null,
        queryError:   null,

        agentStatus:   action.payload.agentReport ? 'success' : 'idle',
        agentReport:   action.payload.agentReport  || null,
        agentSteps:    action.payload.agentSteps   || [],
        agentFinalSql: action.payload.agentFinalSql || null,
        agentError:    null,
      };

    case ACTIONS.CLEAR_RESULTS:
      return {
        ...state,
        queryStatus:  'idle', queryResult: null, queryError: null, executionPlan: null,
        agentStatus:  'idle', agentReport: null, agentSteps: [], agentFinalSql: null, agentError: null,
      };

    default: return state;
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addHistory = useCallback((item) => {
    dispatch({
      type: ACTIONS.ADD_HISTORY,
      payload: {
        ...item,
        id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
      },
    });
  }, []);

  return { state, dispatch, addHistory };
}
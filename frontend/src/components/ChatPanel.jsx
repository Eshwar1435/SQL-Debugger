import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendChatMessage, streamChatMessage } from '../api/client';
import clsx from 'clsx';

const CHAT_STORAGE_KEY = 'sqlAgentChatHistory';

const SUGGESTIONS = [
  'What does EXPLAIN ANALYZE tell us?',
  'How do I add an index to speed up this query?',
  'What is a sequential scan and why is it slow?',
  'Explain what a Hash Join does',
];

export default function ChatPanel({ state }) {
  const [messages, setMessages]  = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [input, setInput]        = useState('');
  const [loading, setLoading]    = useState(false);
  const bottomRef                = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: msg, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const assistantId = Date.now() + 1;
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      id: assistantId,
      isStreaming: true,
    }]);

    try {
      // Build history for the API (exclude the message we just added)
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      let latestReply = '';
      try {
        const streamed = await streamChatMessage(
          msg,
          history,
          state.sql || null,
          (_, fullReply) => {
            latestReply = fullReply;
            setMessages(prev => prev.map((m) => (
              m.id === assistantId ? { ...m, content: fullReply } : m
            )));
          },
        );
        latestReply = streamed.reply || latestReply;
      } catch {
        const fallback = await sendChatMessage(msg, history, state.sql || null);
        latestReply = fallback.reply;
      }

      setMessages(prev => prev.map((m) => (
        m.id === assistantId ? { ...m, content: latestReply, isStreaming: false } : m
      )));
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Something went wrong.';
      setMessages(prev => prev.map((m) => (
        m.id === assistantId ? { ...m, content: errMsg, isStreaming: false, isError: true } : m
      )));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={13} className="text-accent" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Chat</span>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="btn-ghost p-1" title="Clear chat">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Bot size={28} className="text-gray-700" />
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Ask me anything</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Conversational SQL assistant. Ask follow-up questions, get explanations, discuss your query.
              </p>
            </div>
            <div className="w-full space-y-1 mt-1">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="w-full text-left text-xs text-gray-500 hover:text-gray-200 hover:bg-surface px-2 py-1.5 rounded transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={clsx('flex gap-2 fade-in', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={10} className="text-accent" />
              </div>
            )}

            <div className={clsx(
              'max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 'bg-accent text-black font-medium'
                : msg.isError
                ? 'bg-red-900/30 text-red-300 border border-red-800/50'
                : 'bg-surface text-gray-200'
            )}>
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    code({ children, className }) {
                      const isBlock = className?.includes('language-');
                      return isBlock ? (
                        <code className="block bg-[#0B0F14] p-2 rounded text-xs font-mono text-green-300 overflow-x-auto whitespace-pre my-1">
                          {children}
                        </code>
                      ) : (
                        <code className="bg-[#0B0F14] px-1 rounded text-xs font-mono text-accent">
                          {children}
                        </code>
                      );
                    },
                    pre({ children }) { return <pre className="my-1">{children}</pre>; },
                    p({ children })   { return <p className="mb-1 last:mb-0">{children}</p>; },
                    h2({ children })  { return <h2 className="text-xs font-bold text-white mt-2 mb-1">{children}</h2>; },
                    ul({ children })  { return <ul className="list-disc list-inside space-y-0.5 mb-1">{children}</ul>; },
                    li({ children })  { return <li className="text-xs">{children}</li>; },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={10} className="text-gray-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 justify-start fade-in">
            <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Bot size={10} className="text-accent" />
            </div>
            <div className="bg-surface rounded-lg px-3 py-2">
              <span className="flex gap-1">
                <span className="thinking-dot w-1.5 h-1.5 bg-gray-400 rounded-full" />
                <span className="thinking-dot w-1.5 h-1.5 bg-gray-400 rounded-full" />
                <span className="thinking-dot w-1.5 h-1.5 bg-gray-400 rounded-full" />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 p-3 border-t border-border flex-shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Ask a question... (Enter to send)"
          rows={2}
          className="flex-1 bg-surface text-gray-200 text-xs rounded-lg px-3 py-2
                     placeholder-gray-600 outline-none resize-none border border-border
                     focus:border-accent/50 transition-colors leading-relaxed"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="btn-primary px-3 py-2 flex-shrink-0"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
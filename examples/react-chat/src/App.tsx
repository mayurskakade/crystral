import { useState, useRef, useEffect } from 'react';
import './App.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Usage {
  input: number;
  output: number;
  total: number;
}

interface ChatResponse {
  content: string;
  sessionId: string;
  usage: Usage;
  durationMs: number;
}

interface InferenceLog {
  id: string;
  session_id?: string;
  agent_name: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  created_at: string;
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<InferenceLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, sessionId }),
      });

      if (!response.ok) {
        const err = await response.json() as { error?: string };
        throw new Error(err.error ?? response.statusText);
      }

      const data = await response.json() as ChatResponse;
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      setSessionId(data.sessionId);
      setUsage(data.usage);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const clearSession = () => {
    setMessages([]);
    setSessionId(undefined);
    setUsage(null);
  };

  const openLogs = async () => {
    setShowLogs(true);
    setLogsLoading(true);
    try {
      const res = await fetch('/api/logs?limit=20');
      const data = await res.json() as InferenceLog[];
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Crystral Chat</h1>
        <div className="header-actions">
          {sessionId && (
            <span className="session-id" title={sessionId}>
              Session: {sessionId.slice(0, 8)}&hellip;
            </span>
          )}
          <button onClick={() => void openLogs()} className="clear-btn">
            Logs
          </button>
          <button onClick={clearSession} className="clear-btn">
            New Chat
          </button>
        </div>
      </header>

      {showLogs && (
        <div className="logs-panel">
          <div className="logs-header">
            <span>Inference Logs (last 20)</span>
            <button onClick={() => setShowLogs(false)} className="logs-close">&times;</button>
          </div>
          <div className="logs-body">
            {logsLoading && <div className="logs-empty">Loading…</div>}
            {!logsLoading && logs.length === 0 && (
              <div className="logs-empty">No logs yet — send a message first.</div>
            )}
            {!logsLoading && logs.map(log => (
              <div key={log.id} className="log-row">
                <span className="log-agent">{log.agent_name}</span>
                <span className="log-model">{log.model}</span>
                <span className="log-tokens">{log.input_tokens}↑ {log.output_tokens}↓</span>
                <span className="log-cost">${log.cost_usd.toFixed(5)}</span>
                <span className="log-latency">{log.latency_ms}ms</span>
                <span className="log-time">{new Date(log.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Send a message to start chatting with the assistant.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="bubble">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="bubble loading">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="footer">
        {usage && (
          <div className="usage">
            Tokens &mdash; input: {usage.input} &middot; output: {usage.output} &middot; total: {usage.total}
          </div>
        )}
        <div className="input-area">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={isLoading}
          />
          <button onClick={() => void sendMessage()} disabled={!input.trim() || isLoading}>
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;

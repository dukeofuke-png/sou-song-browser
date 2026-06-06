import React, { useState } from 'react';
import './AdminAIHelper.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function AdminAIHelper({ onRunSuggestion }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [rawJsonVisible, setRawJsonVisible] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const resp = await fetch(`${API_URL}/api/ai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt })
      });
      let data = null;
      try { data = await resp.json(); } catch (_) {}
      if (!resp.ok) {
        if (resp.status === 401) {
          throw new Error('Not authenticated – please login first.');
        }
        const detail = data?.error || 'Unexpected server response';
        throw new Error(`AI assistant request failed (${resp.status}): ${detail}`);
      }
      if (!data?.success) {
        throw new Error(data?.error || 'AI returned invalid payload');
      }
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-helper">
      <h3>🤖 Song Query Assistant</h3>
      <div className="ai-input-row">
        <input
          type="text"
          placeholder="e.g., Top 10 hits 1995-2000, Add songs by Blondie"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button onClick={handleSubmit} disabled={loading || !prompt.trim()} className="ai-run-btn">
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </div>
      {error && <div className="ai-error">{error}</div>}
      {results && (
        <div className="ai-results">
          <div className="ai-meta">
            Intent: <strong>{results.intent}</strong>{' '}
            {results.sourcePreference && (
              <span className="ai-source-pref">(Source Pref: {results.sourcePreference})</span>
            )}
          </div>
          <div className="ai-suggestions">
            {results.suggestions.map((s, idx) => (
              <div key={idx} className="ai-suggestion">
                <div className="desc">{s.description}</div>
                <div className="ai-suggestion-meta">
                  {typeof s.confidence !== 'undefined' && (
                    <span className="ai-conf">Confidence: {(s.confidence * 100).toFixed(0)}%</span>
                  )}
                  {s.reason && <span className="ai-reason">Reason: {s.reason}</span>}
                  {s.params && <span className="ai-params">Params: {Object.entries(s.params).map(([k,v]) => `${k}=${v}`).join(', ')}</span>}
                </div>
                {s.type !== 'help' && (
                  <button
                    className="ai-action"
                    onClick={() => onRunSuggestion && onRunSuggestion(s)}
                  >Run</button>
                )}
              </div>
            ))}
          </div>
          <div className="ai-parsed">
            <div className="ai-parsed-header">
              <strong>Parsed Summary</strong>
              <button className="ai-toggle-raw" onClick={() => setRawJsonVisible(v => !v)}>
                {rawJsonVisible ? 'Hide Raw JSON' : 'Show Raw JSON'}
              </button>
            </div>
            <pre>{JSON.stringify(results.parsed, null, 2)}</pre>
            {rawJsonVisible && (
              <div className="ai-raw-json">
                <pre>{JSON.stringify(results, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAIHelper;

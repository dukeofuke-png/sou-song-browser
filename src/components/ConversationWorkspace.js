import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiSend, FiPlus, FiMessageSquare, FiLoader } from 'react-icons/fi';
import './ConversationWorkspace.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function ConversationWorkspace() {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages]          = useState([]);
  const [input, setInput]                = useState('');
  const [sending, setSending]            = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError]                = useState('');

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // -------------------------------------------------------------------------
  // Load conversation list on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    loadConversations();
  }, []);

  // -------------------------------------------------------------------------
  // Auto-scroll to bottom when messages change
  // -------------------------------------------------------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // -------------------------------------------------------------------------
  // API helpers
  // -------------------------------------------------------------------------
  const loadConversations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/conversations`, {
        credentials: 'include',
      });
      if (res.ok) setConversations(await res.json());
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadHistory = useCallback(async (convId) => {
    setLoadingHistory(true);
    setError('');
    try {
      const res = await fetch(
        `${API_URL}/api/chat/conversations/${convId}/messages`,
        { credentials: 'include' }
      );
      if (res.ok) {
        setMessages(await res.json());
      } else {
        setError('Failed to load conversation history.');
      }
    } catch (err) {
      setError('Could not reach the server.');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Select a past conversation
  // -------------------------------------------------------------------------
  const handleSelectConversation = (convId) => {
    setActiveConvId(convId);
    setMessages([]);
    loadHistory(convId);
    inputRef.current?.focus();
  };

  // -------------------------------------------------------------------------
  // Start a new conversation (clear active, empty message list)
  // -------------------------------------------------------------------------
  const handleNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setError('');
    inputRef.current?.focus();
  };

  // -------------------------------------------------------------------------
  // Send a message
  // -------------------------------------------------------------------------
  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    // Optimistically append the tutor message
    const optimisticTutor = {
      id: `optimistic-${Date.now()}`,
      role: 'tutor',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticTutor]);
    setInput('');
    setSending(true);
    setError('');

    const convId = activeConvId || 'new';

    try {
      const res = await fetch(
        `${API_URL}/api/chat/conversations/${convId}/messages`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const { conversationId, message: aiMessage } = await res.json();

      // If this was a new conversation, update state and reload list
      if (!activeConvId) {
        setActiveConvId(conversationId);
        await loadConversations();
      } else {
        // Bump the existing conversation to top in sidebar
        setConversations(prev => {
          const updated = prev.map(c =>
            c.id === conversationId
              ? { ...c, updated_at: new Date().toISOString() }
              : c
          );
          return [...updated].sort(
            (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
          );
        });
      }

      // Append AI response
      setMessages(prev => [...prev, aiMessage]);

    } catch (err) {
      setError(err.message || 'Failed to send message.');
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticTutor.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // -------------------------------------------------------------------------
  // Formatting helpers
  // -------------------------------------------------------------------------
  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts.replace(' ', 'T') + (ts.includes('T') ? '' : 'Z'));
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatConvDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts.replace(' ', 'T') + (ts.includes('T') ? '' : 'Z'));
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    return isToday
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="conv-workspace">

      {/* ── Conversation list sidebar ── */}
      <aside className="conv-sidebar">
        <div className="conv-sidebar-header">
          <h2>Chats</h2>
          <button
            className="btn-new-conv"
            onClick={handleNewConversation}
            title="New conversation"
          >
            <FiPlus size={16} />
            New
          </button>
        </div>

        <ul className="conv-list">
          {conversations.length === 0 && (
            <li className="conv-list-empty">No conversations yet</li>
          )}
          {conversations.map(conv => (
            <li key={conv.id}>
              <button
                className={`conv-list-item ${conv.id === activeConvId ? 'active' : ''}`}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <FiMessageSquare size={14} className="conv-list-icon" />
                <span className="conv-list-title">
                  {conv.title || 'Untitled'}
                </span>
                <span className="conv-list-date">
                  {formatConvDate(conv.updated_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Main chat area ── */}
      <section className="conv-main">

        {/* Message list */}
        <div className="conv-messages">
          {!activeConvId && messages.length === 0 && !sending && (
            <div className="conv-empty-state">
              <FiMessageSquare size={40} />
              <p>Start a new conversation</p>
              <p className="conv-empty-hint">
                Ask me about songs, lesson ideas, theory, or anything music-related.
              </p>
            </div>
          )}

          {loadingHistory && (
            <div className="conv-loading">
              <FiLoader size={20} className="spin" />
              Loading history…
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={`conv-message ${msg.role === 'tutor' ? 'tutor' : 'assistant'}`}
            >
              <div className="conv-message-bubble">
                {msg.content}
              </div>
              <div className="conv-message-meta">
                {msg.role === 'tutor' ? 'You' : 'SOU Assistant'}
                {msg.created_at && ` · ${formatTime(msg.created_at)}`}
              </div>
            </div>
          ))}

          {sending && (
            <div className="conv-message assistant">
              <div className="conv-message-bubble conv-typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="conv-error">
            {error}
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* Input row */}
        <div className="conv-input-row">
          <textarea
            ref={inputRef}
            className="conv-input"
            placeholder="Message SOU Assistant… (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending}
          />
          <button
            className="btn-send"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            title="Send"
          >
            {sending
              ? <FiLoader size={18} className="spin" />
              : <FiSend size={18} />}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConversationWorkspace;

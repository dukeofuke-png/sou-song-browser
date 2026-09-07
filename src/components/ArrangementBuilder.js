import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FiMusic, FiSearch } from 'react-icons/fi';
import './ArrangementBuilder.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/** Build the chord-row display string fresh from a line's chords[] (render-only, never stored). */
function synthesizeChordRow(chords) {
  if (!chords.length) return '';
  const end = chords.reduce((m, c) => Math.max(m, c.position + c.chord.symbol.length), 0);
  const arr = new Array(end).fill(' ');
  chords
    .slice()
    .sort((a, b) => a.position - b.position)
    .forEach((c) => {
      for (let i = 0; i < c.chord.symbol.length; i++) arr[c.position + i] = c.chord.symbol[i];
    });
  return arr.join('');
}

/** Plain whitespace-run tokenizer — not the real chord grammar, per 5.5.8. */
function tokenizeChordRowString(rowString) {
  const tokens = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(rowString)) !== null) {
    tokens.push({ position: m.index, symbol: m[0] });
  }
  return tokens;
}

/** A single draggable chord token, absolutely positioned by column. */
function ChordToken({ symbol, position, charWidth, ambiguous, onCommitPosition }) {
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startXRef = useRef(0);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    setDragOffset(0);
    setDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    setDragOffset(e.clientX - startXRef.current);
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    const deltaCols = dragOffset / charWidth;
    const newPosition = Math.max(0, Math.round(position + deltaCols));
    setDragging(false);
    setDragOffset(0);
    if (newPosition !== position) {
      onCommitPosition(newPosition);
    }
  };

  const left = Math.max(0, position * charWidth + (dragging ? dragOffset : 0));

  return (
    <span
      className={`chord-token${ambiguous ? ' chord-token-ambiguous' : ''}`}
      style={{ left: `${left}px` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      {symbol}
    </span>
  );
}

/** One paired lyric/chord row. Owns transient edit-mode + scroll-sync UI state only. */
function ArrangementLine({
  sectionId,
  lineIndex,
  lyric,
  chords,
  charWidth,
  ambiguousKeys,
  onLyricChange,
  onLyricRebase,
  onChordDrag,
  onRetokenizeRow,
}) {
  const lyricRef = useRef(null);
  const chordRowRef = useRef(null);
  const focusValueRef = useRef(lyric);
  const [editingRow, setEditingRow] = useState(false);
  const [draftText, setDraftText] = useState('');

  const keyPrefix = `${sectionId}::${lineIndex}::`;

  const rowWidthCh =
    Math.max(
      lyric.length,
      chords.reduce((m, c) => Math.max(m, c.position + c.chord.symbol.length), 0)
    ) + 4;

  const handleLyricFocus = (e) => {
    focusValueRef.current = e.target.value;
  };

  const handleLyricBlur = (e) => {
    onLyricRebase(focusValueRef.current, e.target.value);
  };

  const syncFromLyric = (e) => {
    if (chordRowRef.current) chordRowRef.current.scrollLeft = e.target.scrollLeft;
  };

  const syncFromChordRow = (e) => {
    if (lyricRef.current) lyricRef.current.scrollLeft = e.target.scrollLeft;
  };

  const enterEditMode = (e) => {
    if (e.target !== e.currentTarget) return; // clicked a token, not empty space
    setDraftText(synthesizeChordRow(chords));
    setEditingRow(true);
  };

  const commitEdit = () => {
    onRetokenizeRow(draftText);
    setEditingRow(false);
  };

  return (
    <div className="arrangement-line">
      <div className="lyric-row-wrap" onScroll={syncFromLyric}>
        <input
          ref={lyricRef}
          type="text"
          className="lyric-input"
          value={lyric}
          onFocus={handleLyricFocus}
          onBlur={handleLyricBlur}
          onChange={(e) => onLyricChange(e.target.value)}
          style={{ width: `${rowWidthCh}ch` }}
        />
      </div>
      <div className="chord-row-wrap" ref={chordRowRef} onScroll={syncFromChordRow}>
        {editingRow ? (
          <input
            type="text"
            autoFocus
            className="chord-row-input"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onBlur={commitEdit}
            style={{ width: `${rowWidthCh}ch` }}
          />
        ) : (
          <div className="chord-row" style={{ width: `${rowWidthCh}ch` }} onClick={enterEditMode}>
            {chords.map((c, idx) => (
              <ChordToken
                key={idx}
                symbol={c.chord.symbol}
                position={c.position}
                charWidth={charWidth}
                ambiguous={ambiguousKeys.has(`${keyPrefix}${idx}`)}
                onCommitPosition={(newPos) => onChordDrag(idx, newPos)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ArrangementBuilder = () => {
  const [screen, setScreen] = useState('paste'); // 'paste' | 'review'

  // Song picker (Screen 1)
  const [allSongs, setAllSongs] = useState([]);
  const [songQuery, setSongQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [titleInput, setTitleInput] = useState('');

  // Paste (Screen 1)
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [originalRawText, setOriginalRawText] = useState('');

  // Review (Screen 2) — canonical state
  const [bodyJson, setBodyJson] = useState(null);
  const [pendingKeys, setPendingKeys] = useState(new Set());
  const [ambiguousKeys, setAmbiguousKeys] = useState(new Set());

  // Persist
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | success | error
  const [saveError, setSaveError] = useState('');

  // Charwidth measured once for the whole review screen.
  const measureRef = useRef(null);
  const [charWidth, setCharWidth] = useState(8);

  useEffect(() => {
    fetch(`${API_URL}/api/songs`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAllSongs(Array.isArray(data) ? data : []))
      .catch(() => setAllSongs([]));
  }, []);

  useEffect(() => {
    if (screen === 'review' && measureRef.current) {
      const rect = measureRef.current.getBoundingClientRect();
      if (rect.width) setCharWidth(rect.width);
    }
  }, [screen]);

  const filteredSongs = useMemo(() => {
    if (!songQuery.trim()) return [];
    const q = songQuery.toLowerCase();
    return allSongs
      .filter(
        (s) =>
          (s.title || '').toLowerCase().includes(q) ||
          (s.artist || '').toLowerCase().includes(q) ||
          (s.id || '').toString().toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [allSongs, songQuery]);

  const handleSelectSong = (song) => {
    setSelectedSong(song);
    setSongQuery('');
    if (!titleInput) setTitleInput(song.title || '');
  };

  const handleParse = async () => {
    setParseError('');
    if (!selectedSong) {
      setParseError('Select a song before parsing.');
      return;
    }
    if (!rawText.trim()) {
      setParseError('Paste some arrangement text first.');
      return;
    }
    setParsing(true);
    try {
      const res = await fetch(`${API_URL}/api/arrangements/parse-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ raw_text: rawText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error || 'Failed to parse arrangement text');
        return;
      }
      setBodyJson(data.body_json);
      setOriginalRawText(rawText);
      setPendingKeys(new Set());
      setAmbiguousKeys(new Set());
      setSaveStatus('idle');
      setSaveError('');
      setScreen('review');
    } catch (err) {
      setParseError('Failed to connect to server');
    } finally {
      setParsing(false);
    }
  };

  // --- Canonical state mutations (Screen 2) ---

  const updateAnnotationText = (sectionId, newValue) => {
    const next = structuredClone(bodyJson);
    const section = next.sections.find((s) => s.id === sectionId);
    section.content.text = newValue;
    setBodyJson(next);
  };

  const updateLyricText = (sectionId, lineIndex, newValue) => {
    const next = structuredClone(bodyJson);
    const section = next.sections.find((s) => s.id === sectionId);
    section.content.lines[lineIndex].lyric = newValue;
    setBodyJson(next);
  };

  const commitChordPosition = (sectionId, lineIndex, chordIndex, newPosition) => {
    const next = structuredClone(bodyJson);
    const section = next.sections.find((s) => s.id === sectionId);
    const line = section.content.lines[lineIndex];
    line.chords[chordIndex] = { ...line.chords[chordIndex], position: Math.max(0, newPosition) };
    setBodyJson(next);

    const key = `${sectionId}::${lineIndex}::${chordIndex}`;
    setAmbiguousKeys((prev) => {
      if (!prev.has(key)) return prev;
      const nextSet = new Set(prev);
      nextSet.delete(key);
      return nextSet;
    });
  };

  const rebaseLyricLine = (sectionId, lineIndex, oldValue, newValue) => {
    if (oldValue === newValue) return;

    let start = 0;
    const minLen = Math.min(oldValue.length, newValue.length);
    while (start < minLen && oldValue[start] === newValue[start]) start++;

    let oldEnd = oldValue.length;
    let newEnd = newValue.length;
    while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    const delta = newEnd - oldEnd;

    const next = structuredClone(bodyJson);
    const section = next.sections.find((s) => s.id === sectionId);
    const line = section.content.lines[lineIndex];

    const newAmbiguous = new Set(ambiguousKeys);
    line.chords.forEach((c, idx) => {
      const key = `${sectionId}::${lineIndex}::${idx}`;
      if (c.position <= start) {
        // unchanged
      } else if (c.position >= oldEnd) {
        c.position += delta;
      } else {
        // anchor fell inside the edited span — leave position unchanged, flag it
        newAmbiguous.add(key);
      }
    });

    setBodyJson(next);
    setAmbiguousKeys(newAmbiguous);
  };

  const retokenizeRow = (sectionId, lineIndex, rowString) => {
    const section = bodyJson.sections.find((s) => s.id === sectionId);
    const oldChords = section.content.lines[lineIndex].chords;
    const tokens = tokenizeChordRowString(rowString);

    const newChords = tokens.map(({ position, symbol }) => {
      const oldMatch = oldChords.find((c) => c.position === position);
      if (oldMatch && oldMatch.chord.symbol === symbol) {
        return oldMatch;
      }
      return { position, chord: { symbol, root: null, quality: null, bass: null } };
    });

    const next = structuredClone(bodyJson);
    const nextSection = next.sections.find((s) => s.id === sectionId);
    nextSection.content.lines[lineIndex].chords = structuredClone(newChords);
    setBodyJson(next);

    setPendingKeys((prev) => {
      const nextSet = new Set(prev);
      const prefix = `${sectionId}::${lineIndex}::`;
      for (const k of Array.from(nextSet)) {
        if (k.startsWith(prefix)) nextSet.delete(k);
      }
      newChords.forEach((c, idx) => {
        const oldMatch = oldChords.find((o) => o.position === c.position);
        const isPending = !oldMatch || oldMatch.chord.symbol !== c.chord.symbol;
        if (isPending) nextSet.add(`${prefix}${idx}`);
      });
      return nextSet;
    });
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      const res = await fetch(`${API_URL}/api/arrangements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          song_id: selectedSong.id,
          title: titleInput || null,
          body_json: bodyJson,
          import_source_text: originalRawText,
          import_source_type: 'manual_paste',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveStatus('error');
        setSaveError(data.error || 'Failed to save arrangement');
        return;
      }
      setBodyJson(data.body_json);
      setPendingKeys(new Set());
      setAmbiguousKeys(new Set());
      setSaveStatus('success');
    } catch (err) {
      setSaveStatus('error');
      setSaveError('Failed to connect to server');
    }
  };

  const handleStartOver = () => {
    setScreen('paste');
    setSelectedSong(null);
    setTitleInput('');
    setRawText('');
    setParseError('');
    setOriginalRawText('');
    setBodyJson(null);
    setPendingKeys(new Set());
    setAmbiguousKeys(new Set());
    setSaveStatus('idle');
    setSaveError('');
  };

  // --- Render ---

  if (screen === 'paste') {
    return (
      <div className="arrangement-builder-page">
        <div className="page-header">
          <h1>
            <FiMusic /> Arrangement Builder
          </h1>
          <p>Paste a chord/lyric sheet, then review it before saving.</p>
        </div>

        <div className="ab-section">
          <label className="ab-label">Song</label>
          {selectedSong ? (
            <div className="ab-selected-song">
              <span>
                {selectedSong.title} — {selectedSong.artist}
              </span>
              <button className="btn-secondary" onClick={() => setSelectedSong(null)}>
                Change
              </button>
            </div>
          ) : (
            <div className="ab-song-picker">
              <div className="search-box">
                <FiSearch />
                <input
                  type="text"
                  placeholder="Search songs by title, artist, or ID..."
                  value={songQuery}
                  onChange={(e) => setSongQuery(e.target.value)}
                />
              </div>
              {filteredSongs.length > 0 && (
                <div className="ab-song-results">
                  {filteredSongs.map((s) => (
                    <button key={s.id} className="ab-song-result" onClick={() => handleSelectSong(s)}>
                      {s.title} — {s.artist}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ab-section">
          <label className="ab-label" htmlFor="ab-title-input">
            Arrangement title (optional)
          </label>
          <input
            id="ab-title-input"
            type="text"
            className="ab-title-input"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
          />
        </div>

        <div className="ab-section">
          <label className="ab-label" htmlFor="ab-paste-textarea">
            Paste chord/lyric sheet
          </label>
          <textarea
            id="ab-paste-textarea"
            className="ab-paste-textarea"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={20}
            spellCheck={false}
          />
        </div>

        {parseError && <div className="error-banner">{parseError}</div>}

        <button className="btn-primary" onClick={handleParse} disabled={parsing}>
          {parsing ? 'Parsing…' : 'Parse & Review'}
        </button>
      </div>
    );
  }

  // screen === 'review'
  return (
    <div className="arrangement-builder-page">
      <span ref={measureRef} className="ab-char-measure">
        M
      </span>

      <div className="page-header">
        <h1>
          <FiMusic /> Review Arrangement
        </h1>
        <p>Drag chord tokens to reposition. Click empty chord-row space to retype a chord.</p>
      </div>

      {bodyJson.sections.map((section) => (
        <div key={section.id} className="ab-section-block">
          {section.type === 'annotation' ? (
            <input
              type="text"
              className="ab-annotation-input"
              value={section.content.text}
              onChange={(e) => updateAnnotationText(section.id, e.target.value)}
            />
          ) : (
            <>
              <h3 className="ab-section-title">{section.title || '(untitled)'}</h3>
              {section.content.lines.map((line, lineIndex) => (
                <ArrangementLine
                  key={lineIndex}
                  sectionId={section.id}
                  lineIndex={lineIndex}
                  lyric={line.lyric}
                  chords={line.chords}
                  charWidth={charWidth}
                  ambiguousKeys={ambiguousKeys}
                  onLyricChange={(v) => updateLyricText(section.id, lineIndex, v)}
                  onLyricRebase={(oldV, newV) => rebaseLyricLine(section.id, lineIndex, oldV, newV)}
                  onChordDrag={(chordIndex, newPos) =>
                    commitChordPosition(section.id, lineIndex, chordIndex, newPos)
                  }
                  onRetokenizeRow={(rowString) => retokenizeRow(section.id, lineIndex, rowString)}
                />
              ))}
            </>
          )}
        </div>
      ))}

      {saveStatus === 'error' && <div className="error-banner">{saveError}</div>}
      {saveStatus === 'success' && (
        <div className="success-banner">
          Arrangement saved.{' '}
          <button className="btn-secondary" onClick={handleStartOver}>
            New Arrangement
          </button>
        </div>
      )}

      {saveStatus !== 'success' && (
        <button className="btn-primary" onClick={handleSave} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? 'Saving…' : 'Save Arrangement'}
        </button>
      )}
    </div>
  );
};

export default ArrangementBuilder;

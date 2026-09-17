import React, { useState, useEffect, useMemo } from 'react';
import { FiCalendar, FiArrowLeft } from 'react-icons/fi';
import './LessonPlanning.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/**
 * Converts an Europe/London wall-clock date/time (the digits exactly as
 * entered, independent of the browser/device's own timezone setting) to the
 * true UTC instant, correctly handling the GMT/BST transition for whatever
 * date is entered. No date library — double-conversion trick: format the
 * "treat entered digits as UTC" instant back into Europe/London to discover
 * that date's real London offset, then apply it.
 */
function londonWallClockToUtcIso(year, month, day, hour, minute) {
  const asIfUTC = Date.UTC(year, month - 1, day, hour, minute, 0);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(asIfUTC);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const londonAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const offsetMs = londonAsUtc - asIfUTC;
  return new Date(asIfUTC - offsetMs).toISOString();
}

function formatDateRange(start, end) {
  if (!start && !end) return null;
  if (start && end) return `${start} \u2013 ${end}`;
  return start ? `From ${start}` : `Until ${end}`;
}

/** Build the display label for a chunk's picked Arrangement from song + arrangement data already in hand (no extra fetch). */
function buildArrangementDisplay(song, arrangement) {
  const songLabel = song ? `${song.title || '?'} \u2014 ${song.artist || '?'}` : `Song #${arrangement.song_id}`;
  return `${songLabel} \u2014 ${arrangement.title || '(untitled)'} \u2014 ${arrangement.status}`;
}

function LessonPlanning() {
  const [view, setView] = useState('courses'); // 'courses' | 'lessons' | 'plan'

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [lessonsError, setLessonsError] = useState('');

  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseLevel, setNewCourseLevel] = useState('');
  const [newCourseVenue, setNewCourseVenue] = useState('');
  const [newCourseStart, setNewCourseStart] = useState('');
  const [newCourseEnd, setNewCourseEnd] = useState('');
  const [courseFormError, setCourseFormError] = useState('');
  const [courseSaving, setCourseSaving] = useState(false);

  const [newLessonDateTime, setNewLessonDateTime] = useState('');
  const [lessonFormError, setLessonFormError] = useState('');
  const [lessonSaving, setLessonSaving] = useState(false);

  // --- Plan screen (Slice 3b) ---
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [planChunks, setPlanChunks] = useState([]); // [{ arrangement_id, notes, timing_minutes, _display }]
  const [planContentUpdatedAt, setPlanContentUpdatedAt] = useState(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [planSaveError, setPlanSaveError] = useState('');

  // Song list for the Arrangement picker's first step (client-side substring filter).
  const [allSongs, setAllSongs] = useState([]);

  // Arrangement picker — one open at a time, keyed by chunk index.
  const [pickerOpenForIndex, setPickerOpenForIndex] = useState(null);
  const [pickerSongQuery, setPickerSongQuery] = useState('');
  const [pickerSelectedSong, setPickerSelectedSong] = useState(null);
  const [pickerArrangements, setPickerArrangements] = useState([]);
  const [pickerArrangementsLoading, setPickerArrangementsLoading] = useState(false);
  const [pickerArrangementsError, setPickerArrangementsError] = useState('');

  useEffect(() => {
    loadCourses();
    fetch(`${API_URL}/api/songs`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAllSongs(Array.isArray(data) ? data : []))
      .catch(() => setAllSongs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCourses = async () => {
    setCoursesLoading(true);
    setCoursesError('');
    try {
      const res = await fetch(`${API_URL}/api/courses`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCourses(Array.isArray(data) ? data : []);
      } else {
        setCoursesError(data.error || 'Failed to load courses');
      }
    } catch (err) {
      setCoursesError('Failed to connect to server');
    } finally {
      setCoursesLoading(false);
    }
  };

  const loadLessons = async (courseId) => {
    setLessonsLoading(true);
    setLessonsError('');
    try {
      const res = await fetch(`${API_URL}/api/lessons?course_id=${encodeURIComponent(courseId)}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLessons(Array.isArray(data) ? data : []);
      } else {
        setLessonsError(data.error || 'Failed to load lessons');
      }
    } catch (err) {
      setLessonsError('Failed to connect to server');
    } finally {
      setLessonsLoading(false);
    }
  };

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    setView('lessons');
    setLessonFormError('');
    setNewLessonDateTime('');
    loadLessons(course.id);
  };

  const handleBackToCourses = () => {
    setView('courses');
    setSelectedCourse(null);
    setLessons([]);
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setCourseFormError('');
    if (!newCourseTitle.trim()) {
      setCourseFormError('title is required');
      return;
    }

    const body = { title: newCourseTitle.trim() };
    if (newCourseLevel.trim()) body.level = newCourseLevel.trim();
    if (newCourseVenue.trim()) body.venue = newCourseVenue.trim();
    if (newCourseStart) body.planned_start_date = newCourseStart;
    if (newCourseEnd) body.planned_end_date = newCourseEnd;

    setCourseSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewCourseTitle('');
        setNewCourseLevel('');
        setNewCourseVenue('');
        setNewCourseStart('');
        setNewCourseEnd('');
        await loadCourses();
      } else {
        setCourseFormError(data.error || 'Failed to create course');
      }
    } catch (err) {
      setCourseFormError('Failed to connect to server');
    } finally {
      setCourseSaving(false);
    }
  };

  const handleCreateLesson = async (e) => {
    e.preventDefault();
    setLessonFormError('');
    if (!newLessonDateTime) {
      setLessonFormError('Lesson date & time is required');
      return;
    }

    // newLessonDateTime is a datetime-local value ("YYYY-MM-DDTHH:mm") — the
    // digits are entered/interpreted as Europe/London wall-clock time, never
    // the browser/device's own local timezone.
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(newLessonDateTime);
    if (!match) {
      setLessonFormError('Lesson date & time is not a recognized date/time');
      return;
    }
    const [, yStr, moStr, dStr, hStr, miStr] = match;
    const scheduledAtUtc = londonWallClockToUtcIso(
      Number(yStr), Number(moStr), Number(dStr), Number(hStr), Number(miStr)
    );

    setLessonSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ course_id: selectedCourse.id, scheduled_at: scheduledAtUtc }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewLessonDateTime('');
        await loadLessons(selectedCourse.id);
      } else {
        setLessonFormError(data.error || 'Failed to create lesson');
      }
    } catch (err) {
      setLessonFormError('Failed to connect to server');
    } finally {
      setLessonSaving(false);
    }
  };

  // --- Plan screen handlers ---

  /** Resolve a stored chunk's Arrangement identity (song title/artist + arrangement title/status) for display after a reload. */
  const resolveChunkDisplay = async (chunk) => {
    const base = {
      arrangement_id: chunk.arrangement_id ?? null,
      notes: chunk.notes || '',
      timing_minutes: chunk.timing_minutes ?? null,
      _display: null,
    };
    if (base.arrangement_id === null) return base;

    try {
      const arrRes = await fetch(`${API_URL}/api/arrangements/${base.arrangement_id}`, { credentials: 'include' });
      const arrData = await arrRes.json().catch(() => ({}));
      if (!arrRes.ok) {
        return { ...base, _display: `Arrangement #${base.arrangement_id} (details unavailable)` };
      }
      const songRes = await fetch(`${API_URL}/api/songs/${encodeURIComponent(arrData.song_id)}`, { credentials: 'include' });
      const songData = songRes.ok ? await songRes.json().catch(() => null) : null;
      return { ...base, _display: buildArrangementDisplay(songData, arrData) };
    } catch (err) {
      return { ...base, _display: `Arrangement #${base.arrangement_id} (details unavailable)` };
    }
  };

  const loadPlan = async (lessonId) => {
    setPlanLoading(true);
    setPlanError('');
    setPlanSaveError('');
    try {
      const res = await fetch(`${API_URL}/api/lessons/${lessonId}/plan`, { credentials: 'include' });
      if (res.status === 404) {
        // Expected case for a lesson with no plan yet — not an error.
        setPlanChunks([]);
        setPlanContentUpdatedAt(null);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const chunks = Array.isArray(data.plan_json?.chunks) ? data.plan_json.chunks : [];
        const resolved = await Promise.all(chunks.map(resolveChunkDisplay));
        setPlanChunks(resolved);
        setPlanContentUpdatedAt(data.plan_content_updated_at);
      } else {
        setPlanError(data.error || 'Failed to load lesson plan');
      }
    } catch (err) {
      setPlanError('Failed to connect to server');
    } finally {
      setPlanLoading(false);
    }
  };

  const handleSelectLesson = (lesson) => {
    setSelectedLesson(lesson);
    setView('plan');
    setPlanError('');
    setPlanSaveError('');
    closePicker();
    loadPlan(lesson.id);
  };

  const handleBackToLessons = () => {
    setView('lessons');
    setSelectedLesson(null);
    setPlanChunks([]);
    closePicker();
  };

  const handleAddChunk = () => {
    setPlanChunks((prev) => [...prev, { arrangement_id: null, notes: '', timing_minutes: null, _display: null }]);
  };

  const handleRemoveChunk = (index) => {
    setPlanChunks((prev) => prev.filter((_, i) => i !== index));
    if (pickerOpenForIndex === index) closePicker();
  };

  const handleMoveChunk = (index, direction) => {
    setPlanChunks((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleChunkNotesChange = (index, value) => {
    setPlanChunks((prev) => prev.map((c, i) => (i === index ? { ...c, notes: value } : c)));
  };

  const handleChunkTimingChange = (index, value) => {
    const timing = value === '' ? null : Number(value);
    setPlanChunks((prev) => prev.map((c, i) => (i === index ? { ...c, timing_minutes: timing } : c)));
  };

  const handleClearArrangement = (index) => {
    setPlanChunks((prev) => prev.map((c, i) => (i === index ? { ...c, arrangement_id: null, _display: null } : c)));
  };

  const openPickerForChunk = (index) => {
    setPickerOpenForIndex(index);
    setPickerSongQuery('');
    setPickerSelectedSong(null);
    setPickerArrangements([]);
    setPickerArrangementsError('');
  };

  const closePicker = () => {
    setPickerOpenForIndex(null);
    setPickerSongQuery('');
    setPickerSelectedSong(null);
    setPickerArrangements([]);
    setPickerArrangementsError('');
  };

  const filteredPickerSongs = useMemo(() => {
    if (!pickerSongQuery.trim()) return [];
    const q = pickerSongQuery.toLowerCase();
    return allSongs
      .filter((s) => (s.title || '').toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q))
      .slice(0, 25);
  }, [allSongs, pickerSongQuery]);

  const handlePickSong = async (song) => {
    setPickerSelectedSong(song);
    setPickerArrangementsLoading(true);
    setPickerArrangementsError('');
    try {
      const res = await fetch(`${API_URL}/api/arrangements?song_id=${encodeURIComponent(song.id)}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPickerArrangements(Array.isArray(data) ? data : []);
      } else {
        setPickerArrangementsError(data.error || 'Failed to load arrangements for this song');
      }
    } catch (err) {
      setPickerArrangementsError('Failed to connect to server');
    } finally {
      setPickerArrangementsLoading(false);
    }
  };

  const handlePickArrangement = (arrangement) => {
    const index = pickerOpenForIndex;
    const display = buildArrangementDisplay(pickerSelectedSong, arrangement);
    setPlanChunks((prev) => prev.map((c, i) => (i === index ? { ...c, arrangement_id: arrangement.id, _display: display } : c)));
    closePicker();
  };

  const handleSavePlan = async () => {
    setPlanSaveError('');
    setPlanSaving(true);
    try {
      const chunksForApi = planChunks.map((c) => {
        const chunk = {};
        if (c.arrangement_id !== null && c.arrangement_id !== undefined) chunk.arrangement_id = c.arrangement_id;
        if (c.notes) chunk.notes = c.notes;
        if (c.timing_minutes !== null && c.timing_minutes !== undefined) chunk.timing_minutes = c.timing_minutes;
        return chunk;
      });

      const res = await fetch(`${API_URL}/api/lessons/${selectedLesson.id}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan_json: { chunks: chunksForApi } }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // Keep the editor populated with what was just saved — never cleared.
        setPlanContentUpdatedAt(data.plan_content_updated_at);
      } else {
        // Leave all entered chunk content exactly as the tutor left it.
        setPlanSaveError(data.error || 'Failed to save lesson plan');
      }
    } catch (err) {
      setPlanSaveError('Failed to connect to server');
    } finally {
      setPlanSaving(false);
    }
  };

  // --- Render: Plan screen ---

  if (view === 'plan' && selectedLesson) {
    return (
      <div className="lesson-planning-page">
        <div className="page-header">
          <h1><FiCalendar /> Lesson Planning</h1>
          <p>Plan for lesson at {selectedLesson.scheduled_at}</p>
        </div>

        <button className="btn-secondary lp-back-btn" onClick={handleBackToLessons}>
          <FiArrowLeft /> Back to Lessons
        </button>

        {planError && <div className="error-banner">{planError}</div>}

        {planLoading ? (
          <div className="lp-section">Loading plan…</div>
        ) : (
          <div className="lp-section">
            {planChunks.length === 0 && <div className="lp-section">No chunks yet.</div>}

            {planChunks.map((chunk, index) => (
              <div key={index} className="lp-chunk-row">
                <div className="lp-chunk-controls">
                  <button type="button" className="btn-secondary" disabled={index === 0} onClick={() => handleMoveChunk(index, -1)}>
                    ↑
                  </button>
                  <button type="button" className="btn-secondary" disabled={index === planChunks.length - 1} onClick={() => handleMoveChunk(index, 1)}>
                    ↓
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => handleRemoveChunk(index)}>
                    Remove
                  </button>
                </div>

                <div className="lp-chunk-field">
                  <label className="lp-label">Arrangement</label>
                  {chunk._display ? (
                    <div className="lp-chunk-arrangement-picked">
                      <span>{chunk._display}</span>
                      <button type="button" className="btn-secondary" onClick={() => handleClearArrangement(index)}>
                        Clear
                      </button>
                    </div>
                  ) : (
                    <span className="lp-hint">(none selected)</span>
                  )}
                  <button type="button" className="btn-secondary" onClick={() => openPickerForChunk(index)}>
                    {chunk._display ? 'Change Arrangement' : 'Choose Arrangement'}
                  </button>

                  {pickerOpenForIndex === index && (
                    <div className="lp-arrangement-picker">
                      {!pickerSelectedSong ? (
                        <>
                          <input
                            type="text"
                            className="lp-input"
                            placeholder="Search songs by title or artist…"
                            value={pickerSongQuery}
                            onChange={(e) => setPickerSongQuery(e.target.value)}
                          />
                          <div className="lp-picker-results">
                            {filteredPickerSongs.map((song) => (
                              <button key={song.id} type="button" className="lp-picker-result" onClick={() => handlePickSong(song)}>
                                {song.title} — {song.artist}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="lp-picker-selected-song">
                            <span>{pickerSelectedSong.title} — {pickerSelectedSong.artist}</span>
                            <button type="button" className="btn-secondary" onClick={() => setPickerSelectedSong(null)}>
                              Change Song
                            </button>
                          </div>
                          {pickerArrangementsLoading ? (
                            <div className="lp-hint">Loading arrangements…</div>
                          ) : pickerArrangementsError ? (
                            <div className="error-banner">{pickerArrangementsError}</div>
                          ) : pickerArrangements.length === 0 ? (
                            <div className="lp-hint">No arrangements for this song.</div>
                          ) : (
                            <div className="lp-picker-results">
                              {pickerArrangements.map((arr) => (
                                <button key={arr.id} type="button" className="lp-picker-result" onClick={() => handlePickArrangement(arr)}>
                                  {arr.title || '(untitled)'} — {arr.status} — updated {arr.updated_at}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      <button type="button" className="btn-secondary" onClick={closePicker}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="lp-chunk-field">
                  <label className="lp-label">Notes</label>
                  <textarea
                    className="lp-input lp-chunk-notes"
                    value={chunk.notes}
                    onChange={(e) => handleChunkNotesChange(index, e.target.value)}
                  />
                </div>

                <div className="lp-chunk-field">
                  <label className="lp-label">Timing (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    className="lp-input"
                    value={chunk.timing_minutes ?? ''}
                    onChange={(e) => handleChunkTimingChange(index, e.target.value)}
                  />
                </div>
              </div>
            ))}

            <button type="button" className="btn-secondary" onClick={handleAddChunk}>
              + Add chunk
            </button>
          </div>
        )}

        {planSaveError && <div className="error-banner">{planSaveError}</div>}

        <button type="button" className="btn-primary" onClick={handleSavePlan} disabled={planSaving || planLoading}>
          {planSaving ? 'Saving\u2026' : 'Save Plan'}
        </button>
        {planContentUpdatedAt && <p className="lp-hint">Last saved: {planContentUpdatedAt}</p>}
      </div>
    );
  }

  // --- Render: Lesson view ---

  if (view === 'lessons' && selectedCourse) {
    return (
      <div className="lesson-planning-page">
        <div className="page-header">
          <h1><FiCalendar /> Lesson Planning</h1>
          <p>Lessons for "{selectedCourse.title}"</p>
        </div>

        <button className="btn-secondary lp-back-btn" onClick={handleBackToCourses}>
          <FiArrowLeft /> Back to Courses
        </button>

        {lessonsError && <div className="error-banner">{lessonsError}</div>}

        {lessonsLoading ? (
          <div className="lp-section">Loading lessons\u2026</div>
        ) : lessons.length === 0 ? (
          <div className="lp-section">No lessons yet for this Course.</div>
        ) : (
          <div className="lp-list">
            {lessons.map((lesson) => (
              <button key={lesson.id} className="lp-lesson-row" onClick={() => handleSelectLesson(lesson)}>
                <span className="lp-lesson-datetime">{lesson.scheduled_at}</span>
                <span className="lp-lesson-status">{lesson.status}</span>
              </button>
            ))}
          </div>
        )}

        <div className="lp-section lp-new-form">
          <label className="lp-label">New Lesson</label>
          <form onSubmit={handleCreateLesson} className="lp-form-row">
            <input
              type="datetime-local"
              step={300}
              value={newLessonDateTime}
              onChange={(e) => setNewLessonDateTime(e.target.value)}
              className="lp-input"
            />
            <span className="lp-hint">(Europe/London time)</span>
            <button type="submit" className="btn-primary" disabled={lessonSaving}>
              {lessonSaving ? 'Adding\u2026' : 'Add Lesson'}
            </button>
          </form>
          {lessonFormError && <div className="error-banner">{lessonFormError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-planning-page">
      <div className="page-header">
        <h1><FiCalendar /> Lesson Planning</h1>
        <p>Manage Courses and their Lessons.</p>
      </div>

      {coursesError && <div className="error-banner">{coursesError}</div>}

      {coursesLoading ? (
        <div className="lp-section">Loading courses\u2026</div>
      ) : courses.length === 0 ? (
        <div className="lp-section">No Courses yet.</div>
      ) : (
        <div className="lp-list">
          {courses.map((course) => (
            <button key={course.id} className="lp-course-item" onClick={() => handleSelectCourse(course)}>
              <span className="lp-course-title">{course.title}</span>
              {formatDateRange(course.planned_start_date, course.planned_end_date) && (
                <span className="lp-course-dates">{formatDateRange(course.planned_start_date, course.planned_end_date)}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="lp-section lp-new-form">
        <label className="lp-label">New Course</label>
        <form onSubmit={handleCreateCourse}>
          <div className="lp-form-row">
            <input
              type="text"
              placeholder="Title (required)"
              value={newCourseTitle}
              onChange={(e) => setNewCourseTitle(e.target.value)}
              className="lp-input"
            />
          </div>
          <div className="lp-form-row">
            <input
              type="text"
              placeholder="Level"
              value={newCourseLevel}
              onChange={(e) => setNewCourseLevel(e.target.value)}
              className="lp-input"
            />
            <input
              type="text"
              placeholder="Venue"
              value={newCourseVenue}
              onChange={(e) => setNewCourseVenue(e.target.value)}
              className="lp-input"
            />
          </div>
          <div className="lp-form-row">
            <label className="lp-inline-label">
              Start date
              <input
                type="date"
                value={newCourseStart}
                onChange={(e) => setNewCourseStart(e.target.value)}
                className="lp-input"
              />
            </label>
            <label className="lp-inline-label">
              End date
              <input
                type="date"
                value={newCourseEnd}
                onChange={(e) => setNewCourseEnd(e.target.value)}
                className="lp-input"
              />
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={courseSaving}>
            {courseSaving ? 'Creating\u2026' : 'Create Course'}
          </button>
        </form>
        {courseFormError && <div className="error-banner">{courseFormError}</div>}
      </div>
    </div>
  );
}

export default LessonPlanning;

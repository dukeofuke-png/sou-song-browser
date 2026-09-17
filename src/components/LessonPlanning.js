import React, { useState, useEffect } from 'react';
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

function LessonPlanning() {
  const [view, setView] = useState('courses'); // 'courses' | 'lessons'

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

  useEffect(() => {
    loadCourses();
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
              // Display-only — no click handler, this destination doesn't exist until Slice 3b.
              <div key={lesson.id} className="lp-lesson-row">
                <span className="lp-lesson-datetime">{lesson.scheduled_at}</span>
                <span className="lp-lesson-status">{lesson.status}</span>
              </div>
            ))}
          </div>
        )}

        <div className="lp-section lp-new-form">
          <label className="lp-label">New Lesson</label>
          <form onSubmit={handleCreateLesson} className="lp-form-row">
            <input
              type="datetime-local"
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

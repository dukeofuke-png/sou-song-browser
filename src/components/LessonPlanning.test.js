import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LessonPlanning from './LessonPlanning';

/**
 * Mocked GET /api/songs shape mirrors the real toCamelCase() output confirmed
 * against the live backend in the prior task's scratch-script verification
 * (id/title/artist among many other camelCase fields — only id/title/artist
 * are read by the Arrangement picker's filter).
 */
const MOCK_COURSE = { id: 1, title: 'Test Course', level: null, venue: null, planned_start_date: null, planned_end_date: null };
const MOCK_LESSON = { id: 10, course_id: 1, scheduled_at: '2026-09-20T10:00:00.000Z', status: 'scheduled' };
const MOCK_SONGS = [
  { id: 'song_a', title: 'In Da Club', artist: '50 Cent' },
  { id: 'song_b', title: 'Thriller', artist: 'Michael Jackson' },
];
const MOCK_ARRANGEMENT = { id: 100, title: 'Test Arrangement', status: 'published', created_at: '2026-09-01', updated_at: '2026-09-01', content_updated_at: '2026-09-01' };

function jsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: { get: () => null },
  });
}

function installFetchMock() {
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.endsWith('/api/courses')) return jsonResponse(200, [MOCK_COURSE]);
    if (u.includes('/api/lessons?course_id=1')) return jsonResponse(200, [MOCK_LESSON]);
    if (u.endsWith('/api/lessons/10/plan')) return jsonResponse(404, { error: 'Lesson plan not found' });
    if (u.endsWith('/api/songs')) return jsonResponse(200, MOCK_SONGS);
    if (u.includes('/api/arrangements?song_id=song_a')) return jsonResponse(200, [MOCK_ARRANGEMENT]);
    return jsonResponse(404, { error: `Unhandled mock URL in test: ${u}` });
  });
}

/** Navigate Courses -> Lessons -> Plan -> Add a chunk -> open its Arrangement picker (Song-search step). */
async function renderPickerReadyForSearch() {
  render(<LessonPlanning />);

  const courseButton = await screen.findByText('Test Course');
  fireEvent.click(courseButton);

  const lessonRow = await screen.findByText('2026-09-20T10:00:00.000Z');
  fireEvent.click(lessonRow.closest('button'));

  await screen.findByText('No chunks yet.');
  fireEvent.click(screen.getByText('+ Add chunk'));

  fireEvent.click(screen.getByText('Choose Arrangement'));

  return screen.findByPlaceholderText('Search songs by title or artist…');
}

beforeEach(() => {
  installFetchMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('clicking Search displays matching Song results', async () => {
  const searchInput = await renderPickerReadyForSearch();

  userEvent.type(searchInput, 'cent');
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));

  await waitFor(() => expect(screen.getByText('In Da Club — 50 Cent')).toBeInTheDocument());
  expect(screen.queryByText('Thriller — Michael Jackson')).not.toBeInTheDocument();
});

test('pressing Enter in the search input produces the same result as clicking Search', async () => {
  const searchInput = await renderPickerReadyForSearch();

  userEvent.type(searchInput, 'cent');
  fireEvent.submit(searchInput.closest('form'));

  await waitFor(() => expect(screen.getByText('In Da Club — 50 Cent')).toBeInTheDocument());
  expect(screen.queryByText('Thriller — Michael Jackson')).not.toBeInTheDocument();
});

test('an empty/whitespace-only query does not trigger a search', async () => {
  const searchInput = await renderPickerReadyForSearch();

  // Whitespace-only: the Search button must be disabled and clicking it must do nothing.
  userEvent.type(searchInput, '   ');
  const searchButton = screen.getByRole('button', { name: 'Search' });
  expect(searchButton).toBeDisabled();
  fireEvent.click(searchButton);

  expect(screen.queryByText('In Da Club — 50 Cent')).not.toBeInTheDocument();
  expect(screen.queryByText('Thriller — Michael Jackson')).not.toBeInTheDocument();
});

test('selecting a Song result advances the picker to that Song\u2019s Arrangement choices', async () => {
  const searchInput = await renderPickerReadyForSearch();

  userEvent.type(searchInput, 'cent');
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));

  const songResult = await screen.findByText('In Da Club — 50 Cent');
  fireEvent.click(songResult);

  await waitFor(() => expect(screen.getByText('Test Arrangement — published — updated 2026-09-01')).toBeInTheDocument());
});

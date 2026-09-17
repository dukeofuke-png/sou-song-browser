import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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

// Set per-test to control PUT /api/lessons/10/plan's response; null = default success.
let mockPutPlanResponse = null;

function installFetchMock() {
  global.fetch = jest.fn((url, options = {}) => {
    const u = String(url);
    const method = (options.method || 'GET').toUpperCase();
    if (u.endsWith('/api/courses')) return jsonResponse(200, [MOCK_COURSE]);
    if (u.includes('/api/lessons?course_id=1')) return jsonResponse(200, [MOCK_LESSON]);
    if (u.endsWith('/api/lessons/10/plan') && method === 'GET') return jsonResponse(404, { error: 'Lesson plan not found' });
    if (u.endsWith('/api/lessons/10/plan') && method === 'PUT') {
      const resp = mockPutPlanResponse || { status: 200, body: { id: 1, lesson_id: 10, plan_content_updated_at: '2026-09-17 00:00:00' } };
      return jsonResponse(resp.status, resp.body);
    }
    if (u.endsWith('/api/songs')) return jsonResponse(200, MOCK_SONGS);
    if (u.includes('/api/arrangements?song_id=song_a')) return jsonResponse(200, [MOCK_ARRANGEMENT]);
    return jsonResponse(404, { error: `Unhandled mock URL in test: ${u}` });
  });
}

/** Navigate Courses -> Lessons -> Plan (no chunks yet). */
async function renderPlanScreen() {
  render(<LessonPlanning />);

  const courseButton = await screen.findByText('Test Course');
  fireEvent.click(courseButton);

  const lessonRow = await screen.findByText('2026-09-20T10:00:00.000Z');
  fireEvent.click(lessonRow.closest('button'));

  await screen.findByText('No chunks yet.');
}

/** Navigate Courses -> Lessons -> Plan -> Add a chunk -> open its Arrangement picker (Song-search step). */
async function renderPickerReadyForSearch() {
  await renderPlanScreen();
  fireEvent.click(screen.getByText('+ Add chunk'));
  fireEvent.click(screen.getByText('Choose Song Arrangement'));

  return screen.findByPlaceholderText('Search songs by title or artist…');
}

beforeEach(() => {
  mockPutPlanResponse = null;
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

test('Lesson Activity numbering reflects array position for 1, 2, 3+ activities and after reordering', async () => {
  await renderPlanScreen();

  fireEvent.click(screen.getByText('+ Add chunk'));
  expect(screen.getByText('Lesson Activity 1')).toBeInTheDocument();

  fireEvent.click(screen.getByText('+ Add chunk'));
  expect(screen.getByText('Lesson Activity 1')).toBeInTheDocument();
  expect(screen.getByText('Lesson Activity 2')).toBeInTheDocument();

  fireEvent.click(screen.getByText('+ Add chunk'));
  expect(screen.getByText('Lesson Activity 3')).toBeInTheDocument();

  // Mark the second activity's row via its Lesson Notes field, so it can be tracked by
  // content (not a stored id) through the reorder.
  const secondRow = screen.getByText('Lesson Activity 2').closest('.lp-chunk-row');
  fireEvent.change(within(secondRow).getByRole('textbox'), { target: { value: 'SECOND ACTIVITY MARKER' } });
  fireEvent.click(within(secondRow).getByText('↑'));

  const movedRow = screen.getByText('SECOND ACTIVITY MARKER').closest('.lp-chunk-row');
  expect(within(movedRow).getByText('Lesson Activity 1')).toBeInTheDocument();
});

test('relabeled chunk-editor fields render: "Song Arrangement (optional)" and "Lesson Notes"', async () => {
  await renderPlanScreen();
  fireEvent.click(screen.getByText('+ Add chunk'));

  expect(screen.getByText('Song Arrangement (optional)')).toBeInTheDocument();
  expect(screen.getByText('Lesson Notes')).toBeInTheDocument();
});

test('a timing_minutes validation failure renders "Lesson Activity 2: Timing must be zero or more."', async () => {
  await renderPlanScreen();
  fireEvent.click(screen.getByText('+ Add chunk'));
  fireEvent.click(screen.getByText('+ Add chunk'));

  mockPutPlanResponse = { status: 400, body: { error: 'chunks[1]: timing_minutes must be a non-negative number' } };
  fireEvent.click(screen.getByRole('button', { name: 'Save Plan' }));

  await waitFor(() => expect(screen.getByText('Lesson Activity 2: Timing must be zero or more.')).toBeInTheDocument());
});

test('a different validation failure shape renders the honest fallback, not the timing-specific message', async () => {
  await renderPlanScreen();
  fireEvent.click(screen.getByText('+ Add chunk'));

  mockPutPlanResponse = { status: 400, body: { error: 'chunks[0]: arrangement_id 999 does not exist' } };
  fireEvent.click(screen.getByRole('button', { name: 'Save Plan' }));

  await waitFor(() => expect(screen.getByText('Could not save the plan: chunks[0]: arrangement_id 999 does not exist')).toBeInTheDocument());
  expect(screen.queryByText(/Timing must be zero or more/)).not.toBeInTheDocument();
});

test('"No Songs found" does not appear before any search, and not while the song list is still loading', async () => {
  let resolveSongsFetch;
  const pendingSongsPromise = new Promise((resolve) => { resolveSongsFetch = resolve; });
  global.fetch = jest.fn((url, options = {}) => {
    const u = String(url);
    const method = (options.method || 'GET').toUpperCase();
    if (u.endsWith('/api/courses')) return jsonResponse(200, [MOCK_COURSE]);
    if (u.includes('/api/lessons?course_id=1')) return jsonResponse(200, [MOCK_LESSON]);
    if (u.endsWith('/api/lessons/10/plan') && method === 'GET') return jsonResponse(404, { error: 'Lesson plan not found' });
    if (u.endsWith('/api/songs')) return pendingSongsPromise; // stays pending until resolved below
    return jsonResponse(404, { error: `Unhandled mock URL in test: ${u}` });
  });

  await renderPlanScreen();
  fireEvent.click(screen.getByText('+ Add chunk'));
  fireEvent.click(screen.getByText('Choose Song Arrangement'));

  const searchInput = await screen.findByPlaceholderText('Search songs by title or artist…');
  expect(searchInput).toBeDisabled(); // song list still loading
  expect(screen.queryByText('No Songs found')).not.toBeInTheDocument();

  resolveSongsFetch(jsonResponse(200, MOCK_SONGS));
  await waitFor(() => expect(searchInput).not.toBeDisabled());
  expect(screen.queryByText('No Songs found')).not.toBeInTheDocument();
});

test('"No Songs found" appears after a submitted search with no matches, and disappears after a search that returns results', async () => {
  const searchInput = await renderPickerReadyForSearch();

  userEvent.type(searchInput, 'zzz_no_such_song');
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() => expect(screen.getByText('No Songs found')).toBeInTheDocument());

  userEvent.clear(searchInput);
  userEvent.type(searchInput, 'cent');
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));

  await waitFor(() => expect(screen.getByText('In Da Club — 50 Cent')).toBeInTheDocument());
  expect(screen.queryByText('No Songs found')).not.toBeInTheDocument();
});

test('with exactly one activity, both Move buttons are disabled and clicking them does nothing', async () => {
  await renderPlanScreen();
  fireEvent.click(screen.getByText('+ Add chunk'));

  const row = screen.getByText('Lesson Activity 1').closest('.lp-chunk-row');
  const upButton = within(row).getByText('↑');
  const downButton = within(row).getByText('↓');
  expect(upButton).toBeDisabled();
  expect(downButton).toBeDisabled();

  fireEvent.click(upButton);
  fireEvent.click(downButton);

  // Still exactly one activity, still labeled "Lesson Activity 1" — nothing changed.
  expect(screen.getByText('Lesson Activity 1')).toBeInTheDocument();
  expect(screen.queryByText('Lesson Activity 2')).not.toBeInTheDocument();
});

test('with 2+ activities, only the boundary Move buttons are disabled', async () => {
  await renderPlanScreen();
  fireEvent.click(screen.getByText('+ Add chunk'));
  fireEvent.click(screen.getByText('+ Add chunk'));
  fireEvent.click(screen.getByText('+ Add chunk'));

  const firstRow = screen.getByText('Lesson Activity 1').closest('.lp-chunk-row');
  const middleRow = screen.getByText('Lesson Activity 2').closest('.lp-chunk-row');
  const lastRow = screen.getByText('Lesson Activity 3').closest('.lp-chunk-row');

  expect(within(firstRow).getByText('↑')).toBeDisabled();
  expect(within(firstRow).getByText('↓')).not.toBeDisabled();

  expect(within(middleRow).getByText('↑')).not.toBeDisabled();
  expect(within(middleRow).getByText('↓')).not.toBeDisabled();

  expect(within(lastRow).getByText('↑')).not.toBeDisabled();
  expect(within(lastRow).getByText('↓')).toBeDisabled();
});


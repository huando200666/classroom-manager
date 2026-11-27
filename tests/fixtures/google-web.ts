import type { Page } from '@playwright/test';
export async function mockGoogleWeb(page: Page) {
  const requests: URL[] = [];
  const controls = { unauthorized: false, denied: false };
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization',
    'access-control-allow-methods': 'GET, OPTIONS',
  };
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.google={accounts:{oauth2:{initTokenClient:(config)=>({requestAccessToken:()=>setTimeout(()=>config.callback({access_token:'TEST_TOKEN',expires_in:3600,scope:config.scope}),0)})}}};`,
    }),
  );
  await page.route('https://www.googleapis.com/oauth2/v3/userinfo', (route) =>
    route.fulfill({
      headers,
      json: { sub: 'SELF', name: 'Người dùng thử', email: 'teacher@example.test' },
    }),
  );
  await page.route('https://classroom.googleapis.com/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const url = new URL(route.request().url());
    requests.push(url);
    if (controls.unauthorized) {
      await route.fulfill({ status: 401, headers, json: { error: {} } });
      return;
    }
    if (controls.denied) {
      await route.fulfill({ status: 403, headers, json: { error: {} } });
      return;
    }
    if (route.request().headers().authorization !== 'Bearer TEST_TOKEN') {
      await route.fulfill({ status: 401, headers, json: { error: {} } });
      return;
    }
    let data: object = {};
    if (url.pathname === '/v1/courses')
      data = {
        courses: url.searchParams.has('teacherId')
          ? [
              {
                id: 'C1',
                name: 'Lớp A',
                section: 'Python',
                alternateLink: 'https://classroom.google.com/c/C1',
              },
            ]
          : [{ id: 'S1', name: 'Lớp B', section: 'Học viên' }],
      };
    else if (url.pathname.endsWith('/courseWork'))
      data = {
        courseWork: [
          {
            id: 'A1',
            title: 'Bài tập tuần 7',
            maxPoints: 10,
            description: 'Nộp bài thực hành Python.',
            alternateLink: 'https://classroom.google.com/c/C1/a/A1/details',
            dueDate: { year: 2026, month: 11, day: 30 },
          },
        ],
      };
    else if (url.pathname.endsWith('/students'))
      data = url.searchParams.has('pageToken')
        ? { students: [{ userId: 'U3', profile: { name: { fullName: 'Lê Chi' } } }] }
        : {
            students: [
              { userId: 'U1', profile: { name: { fullName: 'Nguyễn An' } } },
              { userId: 'U2', profile: { name: { fullName: 'Trần Bình' } } },
            ],
            nextPageToken: 'p2',
          };
    else if (url.pathname.endsWith('/studentSubmissions'))
      data = {
        studentSubmissions: url.pathname.includes('/S1/')
          ? [
              {
                id: 'OWN',
                userId: 'SELF',
                courseWorkId: 'A1',
                state: 'TURNED_IN',
                shortAnswerSubmission: { answer: 'Câu trả lời của tôi' },
              },
            ]
          : [
              {
                id: 'R1',
                userId: 'U1',
                courseWorkId: 'A1',
                state: 'TURNED_IN',
                late: true,
                assignedGrade: 0,
                assignmentSubmission: {
                  attachments: [{ driveFile: { id: 'FILE', title: 'Bai_lam.zip' } }],
                },
              },
              { id: 'R2', userId: 'U2', courseWorkId: 'A1', state: 'CREATED' },
            ],
      };
    await route.fulfill({ headers, json: data });
  });
  return { requests, controls };
}

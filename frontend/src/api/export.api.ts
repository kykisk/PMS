const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getJwt() {
  const store = JSON.parse(localStorage.getItem('pms-auth') || '{}');
  return store?.state?.accessToken ?? '';
}

async function fetchExcel(url: string, filename: string) {
  const res = await fetch(`/api/v1${url}`, { headers: { Authorization: `Bearer ${getJwt()}` } });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  downloadBlob(new Blob([await blob.arrayBuffer()], { type: EXCEL_TYPE }), filename);
}

async function fetchJson(url: string) {
  const res = await fetch(`/api/v1${url}`, { headers: { Authorization: `Bearer ${getJwt()}` } });
  if (!res.ok) throw new Error('Fetch failed');
  return res.json();
}

async function buildPdf(title: string, head: string[], rows: (string | number)[][], filename: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: rows[0]?.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString('ko-KR'), doc.internal.pageSize.width - 30, 16);
  autoTable(doc, {
    head: [head],
    body: rows.map(r => r.map(c => String(c ?? ''))),
    startY: 22,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  doc.save(filename);
}

async function requirementsPdf(projectId: string) {
  const data = await fetchJson(`/projects/${projectId}/export/requirements-json`);
  buildPdf('요구사항 정의서',
    ['ID', '분류', '요구사항명', '우선순위', '상태', '입력경로'],
    data.map((r: any) => [r.code, r.category ?? '', r.title, r.priority, r.status, r.source]),
    'requirements.pdf');
}

async function wbsPdf(projectId: string) {
  const data = await fetchJson(`/projects/${projectId}/export/wbs-json`);
  buildPdf('WBS',
    ['Task ID', '상위 기능', '기능명', '진척율(%)', '상태', '이슈수'],
    data.map((t: any) => [t.code, t.featureCode ?? '', t.title, t.progress, t.status, t.issueCount]),
    'wbs.pdf');
}

async function rtmPdf(projectId: string) {
  const data = await fetchJson(`/projects/${projectId}/export/rtm-json`);
  buildPdf('요구사항 추적표 (RTM)',
    ['요구사항 ID', '요구사항명', '기능 ID', '기능명', 'Task ID', '시나리오 ID'],
    data.map((r: any) => [r.reqCode, r.reqTitle, r.featCode ?? '', r.featTitle ?? '', r.taskCode ?? '', r.scenarioCode ?? '']),
    'rtm.pdf');
}

async function testPlanPdf(projectId: string) {
  const data = await fetchJson(`/projects/${projectId}/export/test-plan-json`);
  buildPdf('테스트 계획서',
    ['시나리오 ID', '시나리오명', '유형', '케이스수', '상태'],
    data.scenarios.map((s: any) => [s.code, s.title, s.type, s.caseCount, s.status]),
    'test-plan.pdf');
}

export const exportApi = {
  requirements: (projectId: string) => fetchExcel(`/projects/${projectId}/export/requirements`, 'requirements.xlsx'),
  wbs: (projectId: string) => fetchExcel(`/projects/${projectId}/export/wbs`, 'wbs.xlsx'),
  rtm: (projectId: string) => fetchExcel(`/projects/${projectId}/export/rtm`, 'rtm.xlsx'),
  testPlan: (projectId: string) => fetchExcel(`/projects/${projectId}/export/test-plan`, 'test-plan.xlsx'),
  dbDesign: (projectId: string) => fetchExcel(`/projects/${projectId}/export/db-design`, 'db-design.xlsx'),
  apiDesign: (projectId: string) => fetchExcel(`/projects/${projectId}/export/api-design`, 'api-design.xlsx'),
  useCases: (projectId: string) => fetchExcel(`/projects/${projectId}/export/use-cases`, 'use-cases.xlsx'),
  userStories: (projectId: string) => fetchExcel(`/projects/${projectId}/export/user-stories`, 'user-stories.xlsx'),
  testResult: (projectId: string, cycleId: string) => {
    window.open(`/api/v1/projects/${projectId}/export/test-result?cycleId=${cycleId}`, '_blank')
  },
  testResultPivot: (projectId: string) => {
    window.open(`/api/v1/projects/${projectId}/export/test-result-pivot`, '_blank')
  },
  defectReport: (projectId: string) => {
    window.open(`/api/v1/projects/${projectId}/export/defect-report`, '_blank')
  },
  requirementsPdf,
  wbsPdf,
  rtmPdf,
  testPlanPdf,
};

import styles from "./guardian.module.css";
export const revalidate = 300;

type WorkflowRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  event: string;
  head_branch: string | null;
  html_url: string;
  created_at: string;
};
type ApiPayload = { workflow_runs?: WorkflowRun[]; message?: string };
const REPOSITORY = "duyuyd/goc-hop-am";
const ACTIONS_URL = "https://github.com/duyuyd/goc-hop-am/actions";

async function getRealWorkflowRuns(): Promise<{ runs: WorkflowRun[]; error: string | null }> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPOSITORY}/actions/runs?per_page=30`,
      { headers: { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, next: { revalidate: 300 } }
    );
    if (!response.ok) return { runs: [], error: `GitHub API HTTP ${response.status}; dữ liệu không khả dụng.` };
    const data: ApiPayload = await response.json();
    if (!Array.isArray(data.workflow_runs)) return { runs: [], error: "GitHub API không trả về danh sách hợp lệ." };
    return {
      runs: data.workflow_runs.filter((r) =>
        typeof r.id === "number" && r.id > 0 &&
        typeof r.name === "string" && typeof r.status === "string" &&
        r.html_url === `https://github.com/${REPOSITORY}/actions/runs/${r.id}`
      ).slice(0, 24),
      error: null,
    };
  } catch (error) {
    return { runs: [], error: error instanceof Error ? error.message : "Không kết nối được GitHub." };
  }
}

function state(run: WorkflowRun): "pass" | "fail" | "pending" {
  if (run.status !== "completed") return "pending";
  if (run.conclusion === "success") return "pass";
  return "fail";
}
const stateLabels = { pass: "Đạt", fail: "Chưa đạt", pending: "Đang chạy" } as const;
function formatDate(input: string) {
  const value = new Date(input);
  return Number.isNaN(value.getTime()) ? "Không rõ thời gian" : value.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
}

export default async function GithubGuardianPage() {
  const { runs, error } = await getRealWorkflowRuns();
  const passed = runs.filter(r => state(r) === "pass").length;
  const failed = runs.filter(r => state(r) === "fail").length;
  const pending = runs.filter(r => state(r) === "pending").length;
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>Góc Hợp Âm · GitHub Guardian</div>
        <h1 className={styles.title}>Trung tâm tự động hóa GitHub</h1>
        <p className={styles.description}>Trạng thái thực từ GitHub Actions, không sử dụng dữ liệu giả và không tự kích hoạt thao tác ghi. Danh sách được cập nhật từ GitHub API với bộ nhớ đệm tối đa 5 phút.</p>
        <div className={styles.headerLinks}>
          <a className={styles.primaryLink} href={ACTIONS_URL} target="_blank" rel="noopener noreferrer">Xem GitHub Actions ↗</a>
          <a className={styles.secondaryLink} href="https://github.com/duyuyd/goc-hop-am/pulls" target="_blank" rel="noopener noreferrer">Duyệt Pull Requests ↗</a>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Thống kê các lượt chạy được tải">
        <div className={styles.metric}><span className={styles.metricLabel}>Thành công</span><strong className={styles.metricValue}>{passed}</strong></div>
        <div className={styles.metric}><span className={styles.metricLabel}>Cần xử lý / bị hủy</span><strong className={styles.metricValue}>{failed}</strong></div>
        <div className={styles.metric}><span className={styles.metricLabel}>Đang chạy / chờ</span><strong className={styles.metricValue}>{pending}</strong></div>
      </section>
      {error ? <p className={styles.error} role="alert">Không thể đọc dữ liệu GitHub: {error}. <a href={ACTIONS_URL}>Mở GitHub Actions</a> để kiểm tra trực tiếp.</p> : null}
      <section className={styles.runs} aria-label="Các lượt chạy workflow">
        <h2 className={styles.sectionTitle}>Workflow mới nhất</h2>
        {!error && runs.length === 0 ? <p className={styles.empty}>Chưa có lượt chạy nào được GitHub trả về.</p> : null}
        <div className={styles.runList}>
          {runs.map((run) => {
            const status = state(run);
            return (
              <a key={run.id} href={run.html_url} target="_blank" rel="noopener noreferrer" className={styles.run}>
                <span className={styles.runMain}>
                  <span className={styles.runName}>{run.name}</span>
                  <span className={styles.meta}>{run.head_branch || "Không rõ nhánh"} · {run.event} · {formatDate(run.created_at)}</span>
                </span>
                <span className={styles.status} data-state={status}>{stateLabels[status]}</span>
                <span className={styles.arrow} aria-hidden="true">↗</span>
              </a>
            );
          })}
        </div>
        <p className={styles.footnote}>Thống kê chỉ tính các lượt chạy được tải gần nhất; không đại diện cho toàn bộ lịch sử. Đăng nhập, database, ký APK và triển khai Production được kiểm tra trong các quy trình riêng.</p>
      </section>
    </main>
  );
}

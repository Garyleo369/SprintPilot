import { useEffect, useId, useRef, useState } from "react";
import { api } from "./api";
import "./App.css";
const statuses = ["backlog", "in_progress", "done"];
const label = (s) =>
  s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
function Modal({ title, close, children }) {
  const ref = useRef(null),
    titleId = useId();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      ref={ref}
      onCancel={close}
      onClick={(e) => e.target === ref.current && close()}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button aria-label="Close modal" onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const [page, setPage] = useState("Overview");
  const [projects, setProjects] = useState([]),
    [tasks, setTasks] = useState([]);
  const [ai, setAi] = useState(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null),
    [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState(""),
    [projectFilter, setProjectFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState("");
  const [prompt, setPrompt] = useState(""),
    [messages, setMessages] = useState([]);
  async function refresh() {
    try {
      const [p, t, a] = await Promise.all([
        api("/projects"),
        api("/tasks"),
        api("/ai/status"),
      ]);
      setProjects(p);
      setProjectFilter((current) =>
        !current || p.some((project) => project.id === Number(current))
          ? current
          : "",
      );
      setTasks(t);
      setAi(a);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Initial synchronization with the external REST service.
    refresh();
  }, []);
  function close() {
    setModal(null);
    setDeleting(false);
  }
  async function mutate(path, method, body) {
    setBusy(true);
    setError("");
    try {
      await api(path, { method, body });
      close();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (modal.type === "tasks") data.project_id = Number(data.project_id);
    await mutate(
      `/${modal.type}${modal.item ? `/${modal.item.id}` : ""}`,
      modal.item ? "PATCH" : "POST",
      data,
    );
  }
  async function ask(e) {
    e.preventDefault();
    if (!prompt.trim() || busy) return;
    const message = prompt.trim();
    setPrompt("");
    setBusy(true);
    setError("");
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    try {
      const data = await api("/ai/chat", { method: "POST", body: { message } });
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const done = tasks.filter((t) => t.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const filtered = tasks.filter(
    (t) =>
      (!projectFilter || t.project_id === Number(projectFilter)) &&
      (!statusFilter || t.status === statusFilter) &&
      `${t.title} ${t.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  function newItem(type) {
    setDeleting(false);
    setModal({ type });
  }
  function edit(type, item) {
    setDeleting(false);
    setModal({ type, item });
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
        >
          <b>S</b>SprintPilot <small>BETA</small>
        </a>
        <div className="workspace">
          <span className="avatar">W</span>
          <div>
            My workspace<small>Personal workspace</small>
          </div>
          <span>⌄</span>
        </div>
        <p className="eyebrow nav-label">WORKSPACE</p>
        <nav>
          {Object.entries({
            Overview: "◈",
            Projects: "▦",
            Tasks: "☷",
            "AI Assistant": "✧",
          }).map(([name, icon]) => (
            <button
              key={name}
              className={`nav ${page === name ? "active" : ""}`}
              onClick={() => setPage(name)}
            >
              <span>{icon}</span>
              {name}
              {name === "AI Assistant" && <small>AI</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="ai-note">
            <strong>✧ A little clarity goes a long way.</strong>
            <p>Turn your project context into a focused plan with Claude.</p>
            <button onClick={() => setPage("AI Assistant")}>
              Open assistant ↗
            </button>
          </div>
          <div className="profile">
            <span className="avatar">Y</span>
            <div>
              Your workspace<small>Local MVP</small>
            </div>
            <i />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>
            <strong>{page}</strong>
          </span>
          <span className="connection">
            <i className={error ? "offline" : ""} />
            {loading
              ? "Connecting…"
              : error
                ? "Check connection"
                : "Workspace synced"}
          </span>
        </header>
        <div className="content">
          <div className="page-head">
            <div>
              <p className="eyebrow">YOUR WORK, IN FOCUS</p>
              <h1>{page === "Overview" ? "Workspace overview" : page}</h1>
              <p className="subtitle">
                {page === "AI Assistant"
                  ? "Less planning overhead. More meaningful progress."
                  : "A clear view of what matters, and what comes next."}
              </p>
            </div>
            {page !== "AI Assistant" && (
              <button
                className="primary"
                disabled={loading}
                onClick={() =>
                  newItem(
                    page === "Projects" || !projects.length
                      ? "projects"
                      : "tasks",
                  )
                }
              >
                ＋{" "}
                {page === "Projects" || !projects.length
                  ? "New project"
                  : "New task"}
              </button>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              {error} <button onClick={refresh}>Retry connection</button>
            </div>
          )}
          {loading ? (
            <div className="empty">Loading your workspace…</div>
          ) : page === "AI Assistant" ? (
            <section className="assistant">
              <div className="assistant-intro">
                <span className="spark">✧</span>
                <h2>Your next step, made clearer.</h2>
                <p>
                  Ask about priorities, blockers, or your next sprint.
                  <br />
                  Claude receives a snapshot of your projects and tasks.
                </p>
                <span className="badge">
                  {ai?.connected
                    ? "● Claude configured"
                    : "○ Disconnected · API key required"}
                </span>
              </div>
              {!ai?.connected && (
                <div className="disconnected">
                  <h3>Connect Claude to get started</h3>
                  <p>
                    The assistant is disconnected. No AI responses are
                    simulated. Add your Anthropic API key to the backend
                    environment and restart the server.
                  </p>
                </div>
              )}
              <div className="suggestions">
                {[
                  "What should I prioritize next?",
                  "Summarize the project risks",
                  "Suggest a focused sprint plan",
                ].map((p) => (
                  <button
                    key={p}
                    disabled={!ai?.connected}
                    onClick={() => setPrompt(p)}
                  >
                    {p} ↗
                  </button>
                ))}
              </div>
              <div className="messages" aria-live="polite">
                {messages.map((m, i) => (
                  <article className={`message ${m.role}`} key={i}>
                    <strong>{m.role === "user" ? "You" : "Claude"}</strong>
                    <p>{m.text}</p>
                  </article>
                ))}
                {busy && <p className="muted">Claude is thinking…</p>}
              </div>
              <form className="prompt-box" onSubmit={ask}>
                <input
                  aria-label="Message Claude"
                  disabled={!ai?.connected || busy}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={4000}
                  placeholder={
                    ai?.connected
                      ? "Ask your project assistant…"
                      : "Connect Claude to start a conversation"
                  }
                />
                <button
                  className="primary"
                  disabled={!ai?.connected || busy || !prompt.trim()}
                >
                  Send ↑
                </button>
              </form>
              <p className="fine-print">
                Review AI suggestions before acting. The assistant is read-only;
                each request uses the current workspace snapshot.
              </p>
            </section>
          ) : (
            <>
              {page === "Overview" && (
                <>
                  <div className="stats">
                    {[
                      [
                        "Total projects",
                        projects.length,
                        "Across your workspace",
                        "▦",
                      ],
                      [
                        "Open tasks",
                        tasks.length - done,
                        "Ready to move forward",
                        "◷",
                      ],
                      ["Completed", done, "One step closer", "✓"],
                      [
                        "Completion rate",
                        `${progress}%`,
                        "Of all workspace tasks",
                        "↗",
                      ],
                    ].map(([name, value, note, icon]) => (
                      <article className="stat" key={name}>
                        <div>
                          {name}
                          <span>{icon}</span>
                        </div>
                        <strong>{value}</strong>
                        <small>{note}</small>
                      </article>
                    ))}
                  </div>
                  <div className="focus-banner">
                    <span className="spark small">✧</span>
                    <div>
                      <strong>Make room for your best work.</strong>
                      <p>
                        Get a fresh perspective on priorities with your AI
                        planning assistant.
                      </p>
                    </div>
                    <button onClick={() => setPage("AI Assistant")}>
                      Explore assistant ↗
                    </button>
                  </div>
                </>
              )}
              {page !== "Tasks" && (
                <section>
                  <div className="section-head">
                    <h2>
                      Projects <span className="count">{projects.length}</span>
                    </h2>
                    <button onClick={() => newItem("projects")}>
                      ＋ Add project
                    </button>
                  </div>
                  {projects.length ? (
                    <div className="projects">
                      {projects.map((p, i) => {
                        const pt = tasks.filter((t) => t.project_id === p.id),
                          pd = pt.filter((t) => t.status === "done").length,
                          percent = pt.length
                            ? Math.round((pd / pt.length) * 100)
                            : 0;
                        return (
                          <article className="project-card" key={p.id}>
                            <div className="card-top">
                              <span className={`project-icon color-${i % 3}`}>
                                ▦
                              </span>
                              <span className="badge">
                                {pt.length && pd === pt.length
                                  ? "Completed"
                                  : "Active"}
                              </span>
                              <button
                                aria-label={`Edit ${p.name}`}
                                onClick={() => edit("projects", p)}
                              >
                                •••
                              </button>
                            </div>
                            <button
                              className="project-title"
                              onClick={() => {
                                setProjectFilter(String(p.id));
                                setPage("Tasks");
                              }}
                            >
                              {p.name}
                            </button>
                            <p>
                              {p.description ||
                                "No description yet. Give this project a little context."}
                            </p>
                            <div className="progress-label">
                              <span>Progress</span>
                              <strong>{percent}%</strong>
                            </div>
                            <progress
                              max="100"
                              value={percent}
                              aria-label={`${p.name} progress`}
                            />
                            <div className="card-footer">
                              <span>
                                ✓ {pd} / {pt.length} tasks
                              </span>
                              <button
                                onClick={() => {
                                  setProjectFilter(String(p.id));
                                  setPage("Tasks");
                                }}
                              >
                                View project ↗
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty">
                      <h3>A fresh start for your next big idea.</h3>
                      <p>
                        Create a project, then break it into manageable tasks.
                      </p>
                      <button
                        className="primary"
                        onClick={() => newItem("projects")}
                      >
                        ＋ Create your first project
                      </button>
                    </div>
                  )}
                </section>
              )}
              {page !== "Projects" && (
                <section className="task-section">
                  <div className="section-head">
                    <h2>
                      {page === "Overview" ? "Your tasks" : "All tasks"}{" "}
                      <span className="count">{filtered.length}</span>
                    </h2>
                    <span className="muted">Every step counts.</span>
                  </div>
                  <div className="toolbar">
                    <input
                      type="search"
                      aria-label="Search tasks"
                      placeholder="Search tasks…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <select
                      aria-label="Filter by project"
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                    >
                      <option value="">All projects</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filter by status"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">All statuses</option>
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {label(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="task-table">
                    <div className="task-row table-head">
                      <span>Task name</span>
                      <span>Project</span>
                      <span>Priority</span>
                      <span>Status</span>
                      <span>Due date</span>
                    </div>
                    {filtered.map((t) => (
                      <div className="task-row" key={t.id}>
                        <button
                          className="task-title"
                          onClick={() => edit("tasks", t)}
                        >
                          <span className={`task-circle ${t.status}`}>
                            {t.status === "done" ? "✓" : ""}
                          </span>
                          <span>
                            <small>SP-{t.id}</small>
                            {t.title}
                          </span>
                        </button>
                        <span className="task-project">
                          {projects.find((p) => p.id === t.project_id)?.name}
                        </span>
                        <span className={`priority ${t.priority}`}>
                          ▥ {label(t.priority)}
                        </span>
                        <select
                          aria-label={`Status for ${t.title}`}
                          className={`status-select ${t.status}`}
                          value={t.status}
                          disabled={busy}
                          onChange={(e) =>
                            mutate(`/tasks/${t.id}`, "PATCH", {
                              status: e.target.value,
                            })
                          }
                        >
                          {statuses.map((s) => (
                            <option key={s} value={s}>
                              {label(s)}
                            </option>
                          ))}
                        </select>
                        <span className="due">
                          {t.due_date || "No due date"}
                        </span>
                      </div>
                    ))}
                    {!filtered.length && (
                      <div className="empty compact">
                        <h3>
                          {tasks.length
                            ? "No matching tasks"
                            : "Your next step starts here."}
                        </h3>
                        <p>
                          {tasks.length
                            ? "Try changing your search or filters."
                            : "Add a task to turn your plan into progress."}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            SprintPilot<span>Built for focus. Designed for momentum.</span>
          </footer>
        </div>
      </main>
      {modal && (
        <Modal
          title={`${modal.item ? "Edit" : "New"} ${modal.type === "tasks" ? "task" : "project"}`}
          close={close}
        >
          <form onSubmit={save}>
            <label>
              {modal.type === "tasks" ? "Task title" : "Project name"}
              <input
                name={modal.type === "tasks" ? "title" : "name"}
                required
                autoFocus
                maxLength={160}
                defaultValue={modal.item?.title || modal.item?.name || ""}
                placeholder="What are we working on?"
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                rows="3"
                maxLength={4000}
                defaultValue={modal.item?.description || ""}
                placeholder="Add a little context…"
              />
            </label>
            {modal.type === "tasks" && (
              <>
                <label>
                  Project
                  <select
                    name="project_id"
                    required
                    defaultValue={
                      modal.item?.project_id || projectFilter || projects[0]?.id
                    }
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    Priority
                    <select
                      name="priority"
                      defaultValue={modal.item?.priority || "medium"}
                    >
                      {["low", "medium", "high", "urgent"].map((p) => (
                        <option key={p} value={p}>
                          {label(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      name="status"
                      defaultValue={modal.item?.status || "backlog"}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {label(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Due date
                  <input
                    type="date"
                    name="due_date"
                    defaultValue={modal.item?.due_date || ""}
                  />
                </label>
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              {modal.item && (
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => setDeleting(true)}
                >
                  Delete
                </button>
              )}
              <button type="button" onClick={close}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
            {deleting && (
              <div className="delete-confirm">
                <p>
                  Delete this{" "}
                  {modal.type === "tasks"
                    ? "task"
                    : "project and all its tasks"}
                  ? This cannot be undone.
                </p>
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    mutate(`/${modal.type}/${modal.item.id}`, "DELETE")
                  }
                >
                  Yes, delete permanently
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

import React from "react";
export const previewText = (en, zh) =>
  document.documentElement.lang === "zh-CN" ? zh : en;
export const components = {
  Callout: ({
    children,
    title = previewText("A note", "提示"),
    tone = "note",
  }) => (
    <aside className={"callout " + (tone === "warning" ? "warning" : "")}>
      <strong>{title}</strong>
      <div>{children}</div>
    </aside>
  ),
  Badge: ({ children }) => <span className="badge">{children}</span>,
  Card: ({ children, title }) => (
    <section className="card">
      <strong>{title}</strong>
      {children}
    </section>
  ),
  Counter: () => {
    const [n, set] = React.useState(0);
    return (
      <button className="counter" onClick={() => set(n + 1)}>
        {previewText(`Clicked ${n} times`, `已点击 ${n} 次`)} <span>＋</span>
      </button>
    );
  },
};
export class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <pre className="error">
        {previewText("Runtime error: ", "运行时错误：")}
        {String(this.state.error.message)}
      </pre>
    ) : (
      this.props.children
    );
  }
}

export function installErrorReporting() {
  // React boundaries do not catch event-handler errors or rejected promises.
  function reportAsyncError(message) {
    const error = document.createElement("pre");
    error.className = "error";
    error.textContent =
      previewText("Runtime error: ", "运行时错误：") + message;
    document.body.append(error);
  }
  window.addEventListener("error", (event) => reportAsyncError(event.message));
  window.addEventListener("unhandledrejection", (event) =>
    reportAsyncError(String(event.reason)),
  );
}

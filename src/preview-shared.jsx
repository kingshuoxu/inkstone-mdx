import React from "react";
export const components = {
  Callout: ({ children, title = "A note", tone = "note" }) => (
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
        Clicked {n} times <span>＋</span>
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
        Runtime error: {String(this.state.error.message)}
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
    error.textContent = "Runtime error: " + message;
    document.body.append(error);
  }
  window.addEventListener("error", (event) => reportAsyncError(event.message));
  window.addEventListener("unhandledrejection", (event) =>
    reportAsyncError(String(event.reason)),
  );
}

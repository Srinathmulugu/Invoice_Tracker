import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep a console trail for debugging in devtools.
    console.error('UI crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' }}>
          <h2 style={{ margin: 0, marginBottom: 12 }}>App crashed</h2>
          <p style={{ marginTop: 0, marginBottom: 12 }}>
            The UI hit a runtime error. The message below tells us exactly what to fix.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#111827', color: '#fff', padding: 12, borderRadius: 8 }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}


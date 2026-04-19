import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { installGlobalErrorHandlers, postError } from './lib/errorLog';

installGlobalErrorHandlers();

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { err?: Error }
> {
  state = {} as { err?: Error };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error, info: React.ErrorInfo) {
    postError({
      type: 'react.render',
      message: err.message,
      stack: err.stack,
      context: { componentStack: info.componentStack },
    });
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 32, fontFamily: 'ui-monospace,monospace', color: '#f87171', background: '#07071a', minHeight: '100vh' }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>render crashed · logged to web/.errors.log</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{String(this.state.err)}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, opacity: 0.6 }}>{this.state.err.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

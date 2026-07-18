import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: 'var(--canvas)' }}>
            <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
              Algo se rompió en esta vista.
            </p>
            <button
              onClick={this.reset}
              className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600"
            >
              Reintentar
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

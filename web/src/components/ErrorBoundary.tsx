import React from 'react';

/** Keeps one broken widget (e.g. a chart) from blanking the whole dashboard. */
export class ErrorBoundary extends React.Component<{ label: string; children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}]`, error);
  }
  render() {
    if (this.state.error)
      return (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
          {this.props.label} could not be displayed: {this.state.error.message}
        </div>
      );
    return this.props.children;
  }
}

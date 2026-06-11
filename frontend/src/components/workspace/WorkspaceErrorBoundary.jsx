import React, { Component } from "react";

export default class WorkspaceErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
          <h1 className="m-0 text-lg font-bold text-slate-900">Workspace failed to load</h1>
          <p className="m-0 max-w-md text-sm text-slate-600">{this.state.error.message}</p>
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

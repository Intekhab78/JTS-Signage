import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white border rounded-xl shadow-sm p-8 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 text-sm mb-4">
              An unexpected error occurred while rendering this page.
            </p>
            {import.meta.env.DEV && this.state.error?.message && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded p-2 mb-5 break-words">
                {this.state.error.message}
              </p>
            )}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
              >
                Reload Page
              </button>
              <a
                href="/"
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

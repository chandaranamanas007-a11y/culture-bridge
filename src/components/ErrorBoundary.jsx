import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Culture Bridge UI Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#10122B] text-[#F5F1E8]">
          <div className="max-w-md card p-8 border border-white/10 rounded-2xl bg-[#191B3A] shadow-2xl">
            <div className="w-16 h-16 bg-[#22254A] text-[#F2A93B] rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl font-bold">
              ⚠️
            </div>
            <h1 className="font-display text-3xl font-bold mb-3 text-[#F5F1E8]">
              Something went wrong
            </h1>
            <p className="text-[#8B8FB8] text-sm mb-6 leading-relaxed">
              An unexpected display error occurred. Please refresh the page to continue.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="w-full bg-[#2FBFAE] text-[#10122B] font-bold py-3.5 rounded-xl hover:bg-[#1E8F82] transition-all shadow-lg"
            >
              Refresh Page
            </button>
            <a
              href="/"
              onClick={() => localStorage.clear()}
              className="block mt-4 text-xs text-[#8B8FB8] hover:text-[#F5F1E8] underline"
            >
              Clear Session & Return Home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

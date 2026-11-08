import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-900 border border-slate-700 rounded-2xl text-white max-w-lg mx-auto my-4 text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
          <h3 className="font-black text-base text-white">
            {this.props.fallbackTitle || 'Terjadi Gangguan Tampilan'}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Komponen ini mengalami kendala rendering. Data laporan Anda tetap aman tersimpan di formulir.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 mx-auto transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Muat Ulang Komponen</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

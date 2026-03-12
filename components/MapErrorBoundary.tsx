"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * จับ runtime error จากแผนที่ (เช่น PIXI/GridMap) เพื่อไม่ให้ error ไป trigger
 * Fast Refresh full reload — แสดง fallback แทน และมีปุ่มลองใหม่
 */
export class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[MapErrorBoundary]", error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center w-full h-screen bg-slate-950 text-slate-200 p-6">
          <p className="text-pink-400 font-medium mb-2">โหลดแผนที่ไม่สำเร็จ</p>
          <p className="text-sm text-slate-400 mb-4 text-center max-w-md">
            กดปุ่มด้านล่างเพื่อโหลดใหม่
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium"
          >
            โหลดใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportAppError } from '@/lib/app-diagnostics';

type Props = { children: ReactNode; scope: string; fallback: (error: Error, retry: () => void) => ReactNode; onError?: () => void };
export class RecoveryBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportAppError(this.props.scope, { message: error.message, stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}` });
    this.props.onError?.();
  }
  retry = () => this.setState({ error: null });
  render() { return this.state.error ? this.props.fallback(this.state.error, this.retry) : this.props.children; }
}

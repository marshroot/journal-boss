import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка интерфейса',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[UI] Unhandled render error', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-error-screen" role="alert">
        <div className="app-error-card">
          <div className="app-error-icon"><ShieldAlert size={24} /></div>
          <p className="page-eyebrow">myJournal</p>
          <h1>Не удалось отобразить раздел</h1>
          <p>Ошибка произошла в интерфейсе. Ваши данные не были удалены.</p>
          {this.state.message && <code>{this.state.message}</code>}
          <button type="button" className="primary-btn" onClick={this.reset}>
            <RefreshCw size={15} /> Попробовать снова
          </button>
        </div>
      </main>
    );
  }
}

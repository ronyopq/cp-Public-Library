import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
  message: string | null
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: null,
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application render failure', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      message: null,
    })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="app-error-screen">
        <article className="content-card app-error-card">
          <p className="muted">সাময়িক সমস্যা</p>
          <h1>অ্যাপটি এই মুহূর্তে ঠিকভাবে লোড হয়নি</h1>
          <p>
            আপনি চাইলে আবার চেষ্টা করতে পারেন। সমস্যা থাকলে পৃষ্ঠা রিফ্রেশ করলে সাধারণত
            ঠিক হয়ে যায়।
          </p>
          {this.state.message ? (
            <div className="json-preview">
              <strong>ত্রুটির বার্তা</strong>
              <pre>{this.state.message}</pre>
            </div>
          ) : null}
          <div className="page-actions">
            <Button type="button" onClick={this.handleReset}>
              আবার চেষ্টা করুন
            </Button>
            <Button type="button" variant="ghost" onClick={() => window.location.reload()}>
              পৃষ্ঠা রিফ্রেশ
            </Button>
          </div>
        </article>
      </div>
    )
  }
}

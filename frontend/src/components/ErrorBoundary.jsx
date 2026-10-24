import { Component } from 'react'

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught error:', error, errorInfo)

        const isChunkError = /failed to fetch dynamically imported module|importing a module script failed|loading chunk|chunkloaderror/i.test(
            error?.message || ''
        )

        if (isChunkError && typeof window !== 'undefined') {
            const hasRetried = window.sessionStorage.getItem('chunk_eb_reloaded')
            if (!hasRetried) {
                window.sessionStorage.setItem('chunk_eb_reloaded', 'true')
                window.location.reload()
            }
        }
    }

    handleReload = () => {
        if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('chunk_eb_reloaded')
        }
        this.setState({ hasError: false, error: null })
        window.location.reload()
    }

    handleHome = () => {
        if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('chunk_eb_reloaded')
        }
        this.setState({ hasError: false, error: null })
        window.location.href = '/'
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '60vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                    color: '#e2e8f0'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px', color: '#f5af19' }}>
                        Something went wrong
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '420px', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                        An unexpected issue occurred while rendering this view. You can reload the game or return to the casino lobby.
                    </p>
                    {this.state.error && (
                        <details style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            color: '#f87171',
                            fontSize: '0.8rem',
                            textAlign: 'left',
                            maxWidth: '650px',
                            width: '100%',
                            marginBottom: '1.5rem',
                            cursor: 'pointer'
                        }}>
                            <summary style={{ fontWeight: 600, color: '#fca5a5' }}>
                                View Diagnostic Information ({this.state.error.message || 'Error details'})
                            </summary>
                            <pre style={{
                                marginTop: '10px',
                                fontSize: '0.75rem',
                                maxHeight: '180px',
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                color: '#fecaca'
                            }}>
                                {this.state.error.stack || this.state.error.toString()}
                            </pre>
                        </details>
                    )}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            type="button"
                            onClick={this.handleReload}
                            style={{
                                padding: '8px 18px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #f5af19, #d49110)',
                                border: 'none',
                                color: '#0b0f19',
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                cursor: 'pointer'
                            }}
                        >
                            Reload
                        </button>
                        <button
                            type="button"
                            onClick={this.handleHome}
                            style={{
                                padding: '8px 18px',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#e2e8f0',
                                fontWeight: 600,
                                fontSize: '0.88rem',
                                cursor: 'pointer'
                            }}
                        >
                            Back to Casino
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary

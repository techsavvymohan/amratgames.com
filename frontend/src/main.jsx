import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { ThemeProvider, useThemeSettings } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { WalletProvider } from './context/WalletContext'
import App from './App'
import './styles/index.css'

function ThemedApp() {
    const { antdTheme } = useThemeSettings()

    return (
        <ConfigProvider theme={antdTheme}>
            <BrowserRouter>
                <AuthProvider>
                    <WalletProvider>
                        <App />
                    </WalletProvider>
                </AuthProvider>
            </BrowserRouter>
        </ConfigProvider>
    )
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider>
            <ThemedApp />
        </ThemeProvider>
    </React.StrictMode>
)

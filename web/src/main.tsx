import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Polyfill для Buffer (нужен для @octokit/rest в браузере)
window.global = window
if (typeof window.Buffer === 'undefined') {
  window.Buffer = {
    from: (data: string | number[], encoding?: string) => {
      if (typeof data === 'string') {
        if (encoding === 'base64') {
          const binary = atob(data)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
          }
          return {
            toString: () => new TextDecoder().decode(bytes)
          }
        } else {
          const bytes = new TextEncoder().encode(data)
          return {
            toString: () => data
          }
        }
      }
      return {
        toString: () => String.fromCharCode(...data)
      }
    }
  } as any
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

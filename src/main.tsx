import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { redirectToPreferredLang } from './i18n'
import { interceptLinks, upgradeHashUrl } from './router'

upgradeHashUrl()
redirectToPreferredLang()
interceptLinks()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

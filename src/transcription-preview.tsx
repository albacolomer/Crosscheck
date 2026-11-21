import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { TranscriptionPreview } from './pages/TranscriptionPreview.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TranscriptionPreview />
  </StrictMode>,
)

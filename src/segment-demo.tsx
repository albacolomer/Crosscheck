import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SegmentDemo } from './pages/SegmentDemo.tsx'
import './index.css'

const initialInterviewId = new URLSearchParams(window.location.search).get('interviewId')?.trim() || undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SegmentDemo initialInterviewId={initialInterviewId} />
  </StrictMode>,
)

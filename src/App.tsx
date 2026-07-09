import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ImportPage } from './pages/ImportPage'
import { LibraryPage } from './pages/LibraryPage'
import { PracticePage } from './pages/PracticePage'
import { ReviewPage } from './pages/ReviewPage'
import { WordDetailPage } from './pages/WordDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ImportPage />} />
          <Route path="review/:importId" element={<ReviewPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="word/:wordId" element={<WordDetailPage />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

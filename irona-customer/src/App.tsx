import { Navigate, Route, Routes } from 'react-router';
import { COMING_SOON_PATHS } from './constants/navigation';
import ComingSoonScreen from './screens/ComingSoonScreen';
import HomeScreen from './screens/HomeScreen';
import SiteLayout from './screens/SiteLayout';

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomeScreen />} />
        {COMING_SOON_PATHS.map((path) => (
          <Route key={path} path={path} element={<ComingSoonScreen />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

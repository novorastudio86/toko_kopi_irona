import { Navigate, Route, Routes } from 'react-router';
import { COMING_SOON_PATHS } from './constants/navigation';
import CheckoutScreen from './screens/CheckoutScreen';
import ComingSoonScreen from './screens/ComingSoonScreen';
import HomeScreen from './screens/HomeScreen';
import MenuDetailScreen from './screens/MenuDetailScreen';
import MenuScreen from './screens/MenuScreen';
import SiteLayout from './screens/SiteLayout';

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomeScreen />} />
        <Route path="/menu" element={<MenuScreen />} />
        <Route path="/menu/:id" element={<MenuDetailScreen />} />
        <Route path="/keranjang" element={<CheckoutScreen />} />
        {COMING_SOON_PATHS.map((path) => (
          <Route key={path} path={path} element={<ComingSoonScreen />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

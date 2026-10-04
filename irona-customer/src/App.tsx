import { Route, Routes } from 'react-router';
import CheckoutScreen from './screens/CheckoutScreen';
import EventDetailScreen from './screens/tentang/EventDetailScreen';
import HomeScreen from './screens/HomeScreen';
import LegalScreen from './screens/LegalScreen';
import MenuDetailScreen from './screens/MenuDetailScreen';
import MenuScreen from './screens/MenuScreen';
import MembershipScreen from './screens/membership/MembershipScreen';
import NotFoundScreen from './screens/NotFoundScreen';
import OrderScreen from './screens/order/OrderScreen';
import SiteLayout from './screens/SiteLayout';
import TentangScreen from './screens/tentang/TentangScreen';

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomeScreen />} />
        <Route path="/menu" element={<MenuScreen />} />
        <Route path="/menu/:id" element={<MenuDetailScreen />} />
        <Route path="/keranjang" element={<CheckoutScreen />} />
        <Route path="/pesanan/:id" element={<OrderScreen />} />
        <Route path="/tentang" element={<TentangScreen />} />
        <Route path="/tentang/:id" element={<EventDetailScreen />} />
        <Route path="/membership" element={<MembershipScreen />} />
        <Route path="/kebijakan-privasi" element={<LegalScreen doc="privasi" />} />
        <Route path="/syarat-ketentuan" element={<LegalScreen doc="sk" />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  );
}

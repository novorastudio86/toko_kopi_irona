import { Navigate, Route, Routes } from 'react-router';
import LoginScreen from './screens/LoginScreen';
import DashboardLayout from './screens/DashboardLayout';
import PlaceholderPage from './screens/PlaceholderPage';
import CategoryListScreen from './screens/products/CategoryListScreen';
import ProductListScreen from './screens/products/ProductListScreen';
import { GuestOnly, RequireAdmin } from './components/RouteGuards';
import MasterRecipeScreen from './screens/products/MasterRecipeScreen';
import RawMaterialListScreen from './screens/inventory/RawMaterialListScreen';
import StockCardScreen from './screens/inventory/StockCardScreen';
import AssetListScreen from './screens/inventory/AssetListScreen';
import EmployeeListScreen from './screens/employees/EmployeeListScreen';
import RoleListScreen from './screens/employees/RoleListScreen';
import AttendanceScreen from './screens/employees/AttendanceScreen';
import ScanAttendanceScreen from './screens/attendance/ScanAttendanceScreen';
import ShiftScreen from './screens/employees/ShiftScreen';
import KasbonListScreen from './screens/employees/KasbonListScreen';
import CustomerListScreen from './screens/customers/CustomerListScreen';
import DiscountListScreen from './screens/promotions/DiscountListScreen';
import PointRewardScreen from './screens/promotions/PointRewardScreen';
import StoreHoursScreen from './screens/sales/StoreHoursScreen';
import OrderTypeScreen from './screens/sales/OrderTypeScreen';
import OnlineOrderScreen from './screens/sales/OnlineOrderScreen';
import ReceiptSettingsScreen from './screens/sales/ReceiptSettingsScreen';
import TransactionAdjustmentScreen from './screens/sales/TransactionAdjustmentScreen';
import CashFlowScreen from './screens/finance/CashFlowScreen';
import DashboardScreen from './screens/dashboard/DashboardScreen';
import CashFlowReportScreen from './screens/reports/CashFlowReportScreen';
import OnlineBalanceReportScreen from './screens/reports/OnlineBalanceReportScreen';
import SalesSummaryReportScreen from './screens/reports/SalesSummaryReportScreen';
import SalesDetailReportScreen from './screens/reports/SalesDetailReportScreen';
import SalesByPeriodReportScreen from './screens/reports/SalesByPeriodReportScreen';
import PaymentReportScreen from './screens/reports/PaymentReportScreen';
import OnlineSalesReportScreen from './screens/reports/OnlineSalesReportScreen';
import AdjustmentReportScreen from './screens/reports/AdjustmentReportScreen';
import ProductSalesReportScreen from './screens/reports/ProductSalesReportScreen';
import CategorySalesReportScreen from './screens/reports/CategorySalesReportScreen';
import AttendanceReportScreen from './screens/reports/AttendanceReportScreen';
import CashierIncomeReportScreen from './screens/reports/CashierIncomeReportScreen';
import OpeningHoursReportScreen from './screens/reports/OpeningHoursReportScreen';
import MembershipReportScreen from './screens/reports/MembershipReportScreen';
import RedeemReportScreen from './screens/reports/RedeemReportScreen';
import StockSummaryReportScreen from './screens/reports/StockSummaryReportScreen';
import StockPurchaseReportScreen from './screens/reports/StockPurchaseReportScreen';
import StockAdjustmentReportScreen from './screens/reports/StockAdjustmentReportScreen';
import PeakProductScreen from './screens/analysis/PeakProductScreen';
import PeakTransactionScreen from './screens/analysis/PeakTransactionScreen';
import StockCycleScreen from './screens/analysis/StockCycleScreen';

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginScreen />
          </GuestOnly>
        }
      />

      <Route
        element={
          <RequireAdmin>
            <DashboardLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardScreen />} />

        {/* Produk & Menu */}
        <Route path="/product/category" element={<CategoryListScreen />} />
        <Route path="/product/list" element={<ProductListScreen />} />
        <Route path="/product/recipe" element={<MasterRecipeScreen />} />

        <Route path="/inventory/list-stock" element={<RawMaterialListScreen />} />
        <Route path="/inventory/manage-stock" element={<StockCardScreen />} />
        <Route path="/inventory/assets" element={<AssetListScreen />} />

        <Route path="/employee/list-employee" element={<EmployeeListScreen />} />
        <Route path="/employee/privilege" element={<RoleListScreen />} />
        <Route path="/employee/presence" element={<AttendanceScreen />} />
        <Route path="/absensi" element={<ScanAttendanceScreen />} />
        <Route path="/employee/shift" element={<ShiftScreen />} />
        <Route path="/employee/cash-bon" element={<KasbonListScreen />} />
        <Route path="/membership" element={<CustomerListScreen />} />
        <Route path="/promotion/discount" element={<DiscountListScreen />} />
        <Route path="/promotion/reward" element={<PointRewardScreen />} />
        <Route path="/sales/service-hours" element={<StoreHoursScreen />} />
        <Route path="/sales/order-type" element={<OrderTypeScreen />} />
        <Route path="/sales/online-order" element={<OnlineOrderScreen />} />
        <Route path="/sales/custom-receipt" element={<ReceiptSettingsScreen />} />
        <Route path="/sales/transaction-adjustment" element={<TransactionAdjustmentScreen />} />
        <Route path="/accountant/cashflow" element={<CashFlowScreen />} />
        <Route
          path="/report/cash-flow/hpp"
          element={<CashFlowReportScreen key="hpp" bucket="hpp" />}
        />
        <Route
          path="/report/cash-flow/fixed-cost"
          element={<CashFlowReportScreen key="fixed_cost" bucket="fixed_cost" />}
        />
        <Route
          path="/report/cash-flow/net-profit"
          element={<CashFlowReportScreen key="net_profit" bucket="net_profit" />}
        />
        <Route path="/report/cash-flow/online-balance" element={<OnlineBalanceReportScreen />} />
        <Route path="/report/sales/sales-summary" element={<SalesSummaryReportScreen />} />
        <Route path="/report/sales/detail" element={<SalesDetailReportScreen />} />
        <Route path="/report/sales/detail-by-periode" element={<SalesByPeriodReportScreen />} />
        <Route path="/report/sales/payment" element={<PaymentReportScreen />} />
        <Route path="/report/sales/online-order" element={<OnlineSalesReportScreen />} />
        <Route path="/report/sales/adjustment-order" element={<AdjustmentReportScreen />} />
        <Route path="/report/product/sales-product" element={<ProductSalesReportScreen />} />
        <Route path="/report/product/product-category" element={<CategorySalesReportScreen />} />
        <Route path="/report/employee/presence" element={<AttendanceReportScreen />} />
        <Route path="/report/store/cashier-income" element={<CashierIncomeReportScreen />} />
        <Route path="/report/store/opening-hour" element={<OpeningHoursReportScreen />} />
        <Route path="/report/membership/list-member" element={<MembershipReportScreen />} />
        <Route path="/report/membership/redeem" element={<RedeemReportScreen />} />
        <Route path="/report/inventory/summary-stock" element={<StockSummaryReportScreen />} />
        <Route path="/report/inventory/purchase-stock" element={<StockPurchaseReportScreen />} />
        <Route path="/report/inventory/stock-adjustment" element={<StockAdjustmentReportScreen />} />
        <Route path="/analyst/peak-product" element={<PeakProductScreen />} />
        <Route path="/analyst/peak-transaction" element={<PeakTransactionScreen />} />
        <Route path="/analyst/stock-cycle" element={<StockCycleScreen />} />

        {/* Halaman yang belum dibangun jatuh ke placeholder */}
        <Route path="*" element={<PlaceholderPage />} />
      </Route>
    </Routes>
  );
}

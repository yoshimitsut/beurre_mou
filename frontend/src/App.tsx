import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ListOrder from './pages/ListOrder';
import OrderCake from './pages/OrderCake';
import SalesOrder from './pages/SalesOrder';
import Check from './pages/Check';
import Hero from './pages/Hero';
import CakeInformation from './pages/CakeInformations';
import CakeInformationSize from './pages/CakeInformationsSize';
import OrderCakeStore from './pages/OrderCakeStore';
import StoreLogin from './pages/StoreLogin';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/cakeinformation" element={<CakeInformation />} />
        <Route path="/cakeinformationsize" element={<CakeInformationSize />} />
        <Route path="/order" element={<OrderCake />} />

        <Route path="/orderstore" element={
        <ProtectedRoute>
          <OrderCakeStore />
        </ProtectedRoute>
        } />

        <Route path="/list" element={
          <ProtectedRoute>
            <ListOrder />
          </ProtectedRoute>
        } />
        
        <Route path="/ordertable" element={
          <ProtectedRoute>
            <SalesOrder />
          </ProtectedRoute>
        } />

        <Route path="/store-login" element={<StoreLogin />} />
        
        <Route path="/order/check" element={<Check />} />
      </Routes>

    </Router>
  );
}

export default App;

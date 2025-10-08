import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ListOrder from './pages/ListOrder';
import OrderCake from './pages/OrderCake';
import SalesOrder from './pages/SalesOrder';
import Check from './pages/Check';
import Hero from './pages/Hero';
import CakeInformation from './pages/CakeInformations';
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/cakeinformation" element={<CakeInformation />} />
        <Route path="/order" element={<OrderCake />} />
        <Route path="/list" element={<ListOrder />} />
        <Route path="/ordertable" element={<SalesOrder />} />
        <Route path="/order/check" element={<Check />} />
      </Routes>
    </Router>
  );
}

export default App;

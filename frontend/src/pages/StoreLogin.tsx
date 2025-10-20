import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './StoreLogin.css';

export default function StoreLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Senha para a loja (você pode mudar isso)
  const STORE_PASSWORD = '123';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === STORE_PASSWORD) {
      localStorage.setItem('store_authenticated', 'true');
      const from = location.state?.from?.pathname || '/list';
      navigate(from, { replace: true });
    } else {
      setError('パスワードが正しくありません');
    }
  };

//Pedir sempre a senha:

//   const handleLogin = (e: React.FormEvent) => {
//   e.preventDefault();
  
//   if (password === STORE_PASSWORD) {
//     sessionStorage.setItem('store_authenticated', 'true'); // Mude para sessionStorage
//     const from = location.state?.from?.pathname || '/list';
//     navigate(from, { replace: true });
//   } else {
//     setError('パスワードが正しくありません');
//   }
// };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>店舗管理画面</h1>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="password">パスワード:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-button">
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
}
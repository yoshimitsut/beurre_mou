import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Pedia apenas 1 vez
  // useEffect(() => {
  //   // Verificar se o usuário está autenticado
  //   const authStatus = localStorage.getItem('store_authenticated') === 'true';
  //   setIsAuthenticated(authStatus);
  // }, []);

  //Pedir senha sempre
  useEffect(() => {
    const authStatus = sessionStorage.getItem('store_authenticated') === 'true';
    setIsAuthenticated(authStatus);
  }, []);

  if (isAuthenticated === null) {
    return <div>読み込み中...</div>; // Loading
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/store-login" replace />;
}
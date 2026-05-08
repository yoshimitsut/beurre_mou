import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import './Hero.css'
import type { Cake } from '../types/types'

const API_URL = import.meta.env.VITE_API_URL;
const FOLDER_URL = import.meta.env.VITE_FOLDER_URL;

export default function Hero() {
  const [cakes, setCakes] = useState<Cake[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch(`${API_URL}/api/cake`)
      .then((res) => res.json())
      .then((data) => {
        const activeCakes = (data.cakes || []).filter((cake: Cake) => cake.is_active !== 0);
        setCakes(activeCakes);
      })
      .catch((err) => console.error("Erro ao carregar bolos:", err));
  }, []);

  const handleClick = (cake: Cake) => {
    navigate(`/cakeinformationSize?cake=${encodeURIComponent(cake.name)}`);
  };

  return (
    <div className="hero-page">
      <div className="hero-blur-bg"></div>

      <header className="hero-header">
        <div className="header-left"></div>
        <div className="header-center">
          <img src="/logo.png" alt="Beurre-mou" className="logo-img" onClick={() => navigate("/")} />
        </div>
        <div className="header-right">
          <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className="instagram-link">
            <img src="/instagram-icon.png" alt="Instagram" />
          </a>
          <button className="menu-toggle">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      <div className="hero-main-image">
        <div className="fadeOverlay">ホールケーキ</div>
      </div>

      <main className="hero-main">
        <div className="hero-grid">
          {cakes.map((cake, index) => (
            <div
              className="hero-item"
              key={`${cake.id ?? index}-${index}`}
              onClick={() => handleClick(cake)}
            >
              <div className="hero-item-image-wrapper">
                <img src={`${API_URL}/image/${FOLDER_URL}/${cake.image}`} alt={cake.name} loading="lazy" />
              </div>
              <div className="hero-item-info">
                <h3>{cake.name}</h3>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="hero-footer">
        <div className="footer-links">
          <a href="#">特定商取引法に基づく表記</a>
          <a href="#">プライバシーポリシー</a>
          <a href="#">お問い合わせ</a>
        </div>
        <div className="footer-bottom-logo">
          <img src="/logo.png" alt="LIEN DE GATEAU" className="footer-logo" />
        </div>
      </footer>
    </div>
  );
}

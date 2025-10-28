import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import './Hero.css'
import type { Cake } from '../types/types'

const API_URL = import.meta.env.VITE_API_URL;



export default function Hero() {
  const [cakes, setCakes] = useState<Cake[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/api/cake`)
      .then((res) => res.json())
      .then((data) => {
        setCakes(data.cakes || []);
      })
      .catch((err) => console.error("Erro ao carregar bolos:", err));
  }, []);

  const handleClick = (cake: Cake) => {
    // const totalStock = cake.sizes?.reduce((sum, s) => sum + (s.stock || 0), 0) || 0;
    // if (totalStock <= 0) return;
    navigate(`/cakeinformation?cake=${encodeURIComponent(cake.name)}`);
  };

  // const isDisabled = (cake: Cake) => {
  //   const totalStock = cake.sizes?.reduce((sum, s) => sum + (s.stock || 0), 0) || 0;
  //   return totalStock <= 0;
  // };

  return (

    <div>
      
      {/* <div className="christmas-cake-open">
        <div>
          <h2>2025</h2>
          <h2 className="title-christmas-cake">Christmas Cake</h2>
          <p>ご予約締切日12月20日迄</p>
        </div>
      </div> */}

    <div className="hero-main">
    <div className="hero-wrapper">
  <div className="hero-grid">
    {cakes.map((cake, index) => {
      let extraClass = "";
      if (index === 0) extraClass = "big";
      if (index === 1) extraClass = "tall";
      if (index === 2) extraClass = "wide";

      // const disabled = isDisabled(cake);

      return (
        <div
          key={`${cake.id ?? index}-${index}`}
          className={`hero-cell ${extraClass}`} //${disabled ? "disabled" : ""}
          onClick={() => handleClick(cake)}
          // style={{ cursor: disabled ? "not-allowed" : "pointer" }}
        >
          <img
            src={`/image/${cake.image}`}
            alt={cake.name}
            className="hero-img"
          />
          {/* {disabled && <div className="overlay">完売</div>} */}
        </div>
      );
    })}
  </div>
</div>
</div>
</div>
  );
}

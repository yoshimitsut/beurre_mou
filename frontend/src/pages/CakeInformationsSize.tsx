import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { Cake } from "../types/types";
import "./CakeInformations.css";

const API_URL = import.meta.env.VITE_API_URL;

export default function CakeInformations() {
  const [cakes, setCakes] = useState<Cake[]>([]);
  const [searchParams] = useSearchParams();
  const cakeName = searchParams.get("cake") ?? "";
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/api/cake`)
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar os dados dos bolos.");
        return res.json();
      })
      .then((data) => {
        setCakes(data.cakes || []);
      })
      .catch((err) => {
        console.error("Erro ao carregar bolos:", err);
      });
  }, []);

  const selectedCake = cakes.find(
    (cake) =>
      cake.name.trim().toLowerCase() === cakeName.trim().toLowerCase()
  );

  const handleReserve = () => {
    if (!selectedCake) return;
    navigate(`/order?cake=${encodeURIComponent(selectedCake.name.trim())}`);
  };

  // 🔹 Se não encontrar o bolo, mostra mensagem
  if (!selectedCake) {
    return (
      <div className="cake-screen"></div>
    );
  }

  // 🔹 TypeScript agora sabe que selectedCake existe
  return (
    <div className="cake-screen">
      <div className="cake-wrapper">
        <div className="cake-main">
          
          <div className="main-left">
            <table
              style={{
                margin: "20px auto",
                borderCollapse: "collapse",
                fontSize: "1.3rem"
              }}
            >
              <tbody>
                {selectedCake.sizes?.map((size, index) => (
                  <tr key={index}>
                    <td style={{ padding: "8px" }}>
                      {size.size}
                    </td>
                     <td style={{ padding: "8px" }}>
                      ¥
                      {/* {size.price.toLocaleString("ja-JP")} */}
                      {size.price.toLocaleString("ja-JP")} 税込
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={handleReserve} style={{display: "none"}} className="reserve-btn">
              予約
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  // 🔹 Gerar nome da classe baseado no nome do bolo
  const getCakeClassName = (cakeName: string): string => {
    // Remove caracteres especiais e espaços, converte para minúsculas
    return `cake-${cakeName
      .toLowerCase()
      .replace(/[^a-z0-9\u3040-\u309F\u30A0-\u30FF]/g, '') // Mantém letras, números e caracteres japoneses
      .replace(/\s+/g, '-')}`;
  };

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
        <div className={`cake-main ${getCakeClassName(selectedCake.name)}`}>
          <div className="main-right">
            {selectedCake.image && (
              <img
                src={`image/${selectedCake.image}`}
                alt={selectedCake.name}
              />
            )}
          </div>

          <div className="main-left">
            <h2 className="cake-name">{selectedCake.name}</h2>
            <p className="cake-description">{selectedCake.description}</p>

            <table className="cake-inf-table"
              style={{
                margin: "20px auto",
                borderCollapse: "collapse",
                fontSize: "2rem"
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
                      {size.stock === 0 && <span style={{ color: "red"}}>  完売</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={handleReserve} className="reserve-btn">
               
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Cake } from "../types/types";
import './CakeInformations.css'

const API_URL = import.meta.env.VITE_API_URL;

export default function CakeInformations() {
  const [cakes, setCakes] = useState<Cake[]>([]);

  // const [searchParams] = useSearchParams();
  // const cakeName = searchParams.get("cake");

  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/api/cake`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Falha ao carregar os dados dos bolos.");
        }
        return res.json();
      })
      .then((data) => {
        setCakes(data.cakes || []);
      })
      .catch((err) => {
        console.error("Erro ao carregar bolos:", err);
      });
  }, []);

  // const selectedCake = cakes.find(
  //   (cake) => cake.name.trim().toLowerCase() === cakeName?.trim().toLowerCase()
  // );

  const handleReserve = (cakeName: string) => {
    navigate(`/order?cake=${encodeURIComponent(cakeName.trim())}`);
  };

  return (
  <div className="cake-screen">
    <div className="cake-wrapper" >

      {cakes.map((cake, index) => (
      <div key={index} className="cake-main" >
        <div className="main-right">
          <img
            src={`image/${cake.image}`}
            alt={cake.name}
            style={{ maxWidth: "448px"}}
            />
        </div>

        <div className="main-left">
            <h2 className="cake-name">{cake.name}</h2>
            <p className="cake-description">{cake.description}</p>
          {/* <p><strong>Estoque:</strong> {selectedCake.stock}</p> */}

          <table
            style={{
              margin: "20px auto",
              borderCollapse: "collapse",
              minWidth: "300px",
            }}
          >
            <tbody>
              {cake.sizes.map((size, index) => (
                
                <tr key={index}>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                    {size.size}
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                    ¥ {size.price.toLocaleString("ja-JP")} （{(size.price+size.price*0.08).toLocaleString("ja-JP")}税込）
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
              onClick={() => handleReserve(cake.name)}
              className="reserve-btn"
          >
            予約
          </button>
        </div>

      </div>
      ))}
    </div>
  </div>
  );
}

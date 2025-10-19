import { useEffect, useState } from "react";
import "./SalesOrder.css";
import type { Order } from "../types/types";
import { STATUS_OPTIONS } from "../types/types";
import { useNavigate } from "react-router-dom";
import { formatDateJP } from "../utils/formatDateJP";

// Interfaces para tipagem correta
interface CakeSizeData {
  stock: number;
  days: Record<string, number>;
}

interface SummaryType {
  [cakeName: string]: {
    [size: string]: CakeSizeData;
  };
}

interface StatusDayCountsType {
  [date: string]: {
    [status: string]: number;
  };
}

export default function SalesOrder() {
  const [summary, setSummary] = useState<SummaryType>({});
  const [dates, setDates] = useState<string[]>([]);
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusDayCounts, setStatusDayCounts] = useState<StatusDayCountsType>({}); 

  const navigate = useNavigate();

  const statusOptions = STATUS_OPTIONS;

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/list`)
      .then((res) => res.json())
      .then((data) => {
        console.log("Resposta completa da API:", data);
        
        let orders: Order[] = [];
        
        if (Array.isArray(data)) {
          orders = data;
        } else if (data.orders && Array.isArray(data.orders)) {
          orders = data.orders;
        } else if (data.data && Array.isArray(data.data)) {
          orders = data.data;
        } else {
          throw new Error("Formato de resposta inesperado da API");
        }

        console.log("Pedidos processados:", orders);

        const grouped: SummaryType = {};
        const allDates = new Set<string>();
        const statusCounterByDate: StatusDayCountsType = {};

        orders.forEach((order) => {
          const status = order.status?.toLowerCase() || '';
          const date = order.date;
          
          allDates.add(date);
          
          // Inicializa o contador de status para esta data
          if (!statusCounterByDate[date]) {
            statusCounterByDate[date] = {};
          }
          statusCounterByDate[date][status] = (statusCounterByDate[date][status] || 0) + 1;
          
          if (status !== "e") {
            order.cakes.forEach((cake) => {
              const name = cake.name.trim();
              const size = cake.size.trim();
              const amount = Number(cake.amount) || 0;
              const stock = Number(cake.stock) || 0;

              if (!grouped[name]) grouped[name] = {};
              if (!grouped[name][size]) {
                grouped[name][size] = {
                  stock: stock,
                  days: {}
                };
              }
              
              // Atualiza o stock se for o primeiro bolo encontrado
              if (grouped[name][size].stock === 0 && stock > 0) {
                grouped[name][size].stock = stock;
              }
              
              if (!grouped[name][size].days[date]) {
                grouped[name][size].days[date] = 0;
              }

              grouped[name][size].days[date] += amount;
            });
          }
        });

        console.table(grouped);
        setSummary(grouped);
        setDates([...allDates].sort());
        setStatusDayCounts(statusCounterByDate);
        setLoading(false);
        setError(null);
      })
      .catch((error) => {
        console.error("Erro ao carregar pedidos:", error);
        setError("Erro ao carregar dados: " + error.message);
        setLoading(false);
      });
  }, []);

  // 🔹 Cálculo do total geral de todos os bolos por dia
  const totalGeralPorDia: Record<string, number> = dates.reduce((acc: Record<string, number>, date) => {
    let total = 0;
    Object.values(summary).forEach((sizes) => {
      Object.values(sizes).forEach((sizeData) => {
        total += sizeData.days[date] || 0;
      });
    });
    acc[date] = total;
    return acc;
  }, {});

  if (error) return (
    <div className="error-container">
      <p>{error}</p>
      <button onClick={() => window.location.reload()}>Tentar Novamente</button>
    </div>
  );

  const totalGlobal = Object.values(totalGeralPorDia).reduce((a, b) => a + b, 0);

  return (
    <div className="summary-table-container">
      <div className="list-order-actions">
        <div className='btn-actions'>
          <div onClick={() => navigate("/list")} className='btn-back'>
            <img src="/icons/btn-back.png" alt="list icon" />
          </div>
        </div>
      </div>

      {/* 🔹 Tabela final com o total geral de todos os bolos */}
      <div className="cake-table-wrapper">
        <div>
          <table className="summary-table total-summary">
            <thead>
              <tr>
                <th>日付毎の合計</th>
                {dates.map((date) => (
                  <th key={date}>{formatDateJP(date)}</th>
                ))}
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              <tr className="total-row">
                <td></td>
                {dates.map((date) => (
                  <td key={date}><strong>{totalGeralPorDia[date] || 0}</strong></td>
                ))}
                <td><strong>{totalGlobal}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 🔹 Tabelas individuais por bolo */}
      {Object.entries(summary).map(([cakeName, sizes]) => {
        // Total por dia desse bolo
        const totalPorDia: Record<string, number> = dates.reduce((acc: Record<string, number>, date) => {
          let total = 0;
          Object.values(sizes).forEach((sizeData) => {
            total += sizeData.days[date] || 0;
          });
          acc[date] = total;
          return acc;
        }, {});

        const totalGeral = Object.values(totalPorDia).reduce((a, b) => a + b, 0);

        return (
          <div key={cakeName} className={`cake-table-wrapper`}>
            <div className={`table-${cakeName} table-wrapper-info`}>
              <table className={`summary-table`}>
                <thead>
                  <tr>
                    <th>{cakeName}</th>
                    {dates.map((date) => (
                      <th key={date}>{formatDateJP(date)}</th>
                    ))}
                    <th>合計</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sizes).map(([size, sizeData]) => {
                    const total = Object.values(sizeData.days).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={`${cakeName}-${size}`}>
                        {/* 🔹 AQUI: Tamanho + Estoque */}
                        <td>
                          {size} <span className="stock-info">(在庫: {sizeData.stock})</span>
                        </td>
                        {dates.map((date) => (
                          <td key={date}>{sizeData.days[date] || 0}</td>
                        ))}
                        <td className="total-cell">{total}</td>
                      </tr>
                    );
                  })}

                  {/* 🔹 Linha de total diário desse bolo */}
                  <tr className="total-row">
                    <td><strong>合計 →</strong></td>
                    {dates.map((date) => (
                      <td key={date}><strong>{totalPorDia[date] || 0}</strong></td>
                    ))}
                    <td><strong>{totalGeral}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Tabela de status de pagamento */}
      <div className="data-percentage">
        <h3 className="table-title"></h3>
        <table className="summary-table total-summary">
          <thead>
            <tr>
              <th>支払い状況</th>
              {dates.map((date) => (
                <th key={date}>{formatDateJP(date)}</th>
              ))}
              <th>合計</th>
            </tr>
          </thead>
          <tbody>
            {statusOptions.map(({ value, label }) => {
              let totalStatus = 0;
              return (
                <tr key={value} className={`title-${label}`}>
                  <td>{label}</td>
                  {dates.map((date) => {
                    const count = statusDayCounts[date]?.[value] || 0;
                    totalStatus += count;
                    return <td key={`${value}-${date}`}>{count}</td>;
                  })}
                  <td><strong>{totalStatus}</strong></td>
                </tr>
              );
            })}
            <tr className="total-row">
              <td><strong>合計</strong></td>
              {dates.map((date) => {
                const totalDay = statusOptions.reduce((sum, {value}) => {
                  return sum + (statusDayCounts[date]?.[value] || 0);
                }, 0);
                return <td key={`total-${date}`}><strong>{totalDay}</strong></td>
              })}
              <td>
                <strong>
                  {dates.reduce((sum, date) => {
                    return sum + statusOptions.reduce((subSum, {value}) => {
                      return subSum + (statusDayCounts[date]?.[value] || 0);
                    }, 0);
                  }, 0)}
                </strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
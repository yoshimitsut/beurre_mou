import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { Html5QrcodeScanner } from 'html5-qrcode';
import Select from "react-select";

import ExcelExportButton from '../components/ExcelExportButton';
import EditOrderModal from "../components/EditOrderModal";

import type { StylesConfig, SingleValue } from 'react-select';
import type { Order, StatusOption } from '../types/types';
import { STATUS_OPTIONS } from '../types/types';

import { formatDateJP } from "../utils/formatDateJP";

import './ListOrder.css';

export default function ListOrder() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedOrderId, setScannedOrderId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode,] = useState<"date" | "order">("order");

  const [isUpdating, setIsUpdating] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("すべて");
  const [cakeFilter, setCakeFilter] = useState("すべて");
  const [dateFilter, setDateFilter] = useState("すべて");
  const [hourFilter, setHourFilter] = useState("すべて");

  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);

  type FilterOption = {
    value: string;
    label: string;
  };

  const statusOptions = STATUS_OPTIONS;

  const filterOptions: FilterOption[] = [
    { value: "すべて", label: "すべて" },
    ...statusOptions.filter(opt => opt.value !== "e"),
  ];

  const navigate = useNavigate();
  const handleSearch = useRef<number | null>(null);
useEffect(() => {
  if (orders.length > 0) {
    console.log('Debug - Datas:', {
      dataOriginal: orders[0].date,
      formatada: formatDateJP(orders[0].date),
      timezoneNavegador: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }
}, [orders]);
  // Efeito para lidar com navegação e recarga
  useEffect(() => {
    if (location.state?.newOrderCreated) {
      navigate(location.pathname, { replace: true, state: {} });
      setRefreshKey(prev => prev + 1);
    }
  }, [location.state, navigate, location.pathname]);

  // Efeito para carregar pedidos
  useEffect(() => {
    setLoading(true);
    if (handleSearch.current) {
      clearTimeout(handleSearch.current);
    }

    handleSearch.current = setTimeout(() => {
      const searchUrl = search
        ? `${import.meta.env.VITE_API_URL}/api/list?search=${encodeURIComponent(search)}`
        : `${import.meta.env.VITE_API_URL}/api/list`;
      
      fetch(searchUrl)
        .then((res) => res.json())
        .then((data) => {
          const normalized = Array.isArray(data) ? data : (data.orders || []);
          setOrders(normalized);
        })
        .catch((error) => {
          console.error('Erro ao carregar pedidos:', error);
        })
        .finally(() => setLoading(false));
    }, 500);

    return () => {
      if (handleSearch.current) {
        clearTimeout(handleSearch.current);
      }
    };
  }, [search, refreshKey]);

  // UseMemo para encontrar o pedido escaneado
  const foundScannedOrder = useMemo(() => {
    if (scannedOrderId) {
      return orders.find((o) => o.id_order === scannedOrderId);
    }
    return null;
  }, [scannedOrderId, orders]);

  // Agrupar pedidos por data
  const groupedOrders = useMemo(() => {
    return orders.reduce((acc, order) => {
      const dateKey = formatDateJP(order.date); 
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(order);
      return acc;
    }, {} as Record<string, Order[]>);
  }, [orders]);

  // Efeito para o scanner QR Code
  useEffect(() => {
    if (!showScanner) return;

    const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 250 }, false);

    scanner.render(
      async (decodedText: string) => {
        setShowScanner(false);
        await scanner.clear();

        const found = orders.find((o) => o.id_order === Number(decodedText));
        if (found) {
          setScannedOrderId(found.id_order);
        } else {
          alert('注文が見つかりません。');
        }
      },
      (err) => console.warn('QR コードの読み取りエラー:', err)
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [showScanner, orders]);

  // Ordenar pedidos agrupados
  const sortedGroupedOrders = useMemo(() => {
    return Object.entries(groupedOrders) as [string, Order[]][];
  }, [groupedOrders]);

  // Definir como exibir os pedidos
  const displayOrders: [string, Order[]][] = useMemo(() => {
    if (viewMode === 'date') {
      return sortedGroupedOrders;
    } else {
      return [["注文順", [...orders].sort((a, b) => a.id_order - b.id_order)]];
    }
  }, [viewMode, sortedGroupedOrders, orders]);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // Função para alterar status
  async function handleStatusChange(id: number, newStatus: "a" | "b" | "c" | "d" | "e") {
    const order = orders.find((o) => o.id_order === id);
    if (!order) return;

    const statusMap: Record<string, string> = {
      a: "未",
      b: "オンライン予約",
      c: "店頭支払い済",
      d: "お渡し済",
      e: "キャンセル",
    };

    const currentStatus = statusMap[order.status ?? "a"];
    const nextStatus = statusMap[newStatus];

    const confirmed = window.confirm(
      `(確認)ステータスを変更しますか？\n\n` +
      `受付番号: ${String(order.id_order).padStart(4, "0")}\n` +
      `お名前: ${order.first_name} ${order.last_name}\n\n` +
      `${currentStatus} → ${nextStatus}`
    );
    if (!confirmed) return;

    const previousStatus = order.status;

    setIsUpdating(true);
    setUpdatingOrderId(id);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/reservar/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        console.error(e);
        throw new Error(`Resposta inválida do servidor (status ${res.status})`);
      }

      if (!res.ok || !data || !data.success) {
        throw new Error(data?.error || `Falha ao salvar (status ${res.status})`);
      }

      setOrders((old) =>
        old.map((o) => (o.id_order === id ? { ...o, status: newStatus } : o))
      );

      console.log("Status atualizado no servidor:", data);

    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      alert("Erro ao salvar status no servidor. A lista será recarregada.");

      setRefreshKey((k) => k + 1);

      setOrders((old) =>
        old.map((o) => (o.id_order === id ? { ...o, status: previousStatus } : o))
      );
    } finally {
      setIsUpdating(false);
      setUpdatingOrderId(null);
    }
  }

  // Função para salvar edição
  const handleSaveEdit = async (updatedOrder: Order) => {
    if (!updatedOrder) return;

    // const confirmed = window.confirm("変更を保存しますか？");
    // if (!confirmed) return;

    try {
      console.log("📤 Enviando para API:", updatedOrder);

      // Use o novo endpoint para edição completa
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${updatedOrder.id_order}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedOrder),
      });

      const data = await res.json();
      console.log("📥 Resposta da API:", data);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "更新に失敗しました。");
      }

      // Atualiza localmente
      setOrders((old) =>
        old.map((o) =>
          o.id_order === updatedOrder.id_order ? updatedOrder : o
        )
      );

      // Força refresh dos dados do servidor
      setRefreshKey(prev => prev + 1);
      
      setEditingOrder(null);
      alert("✅ 注文が更新されました。");
    } catch (err) {
      console.error("❌ Erro ao salvar edição:", err);
      alert("更新エラーが発生しました。");
    }
  };

  const customStyles: StylesConfig<StatusOption, false> = {
    control: (provided, state) => {
      const selected = state.selectProps.value as StatusOption | null;

      let bgColor = "#000";
      let fontColor = "#fff";

      if (selected) {
        switch (selected.value) {
          case "a":
            bgColor = "#C40000";
            fontColor = "#FFF";
            break;
          case "b":
            bgColor = "#000DBD";
            fontColor = "#FFF";
            break;
          case "c":
            bgColor = "#287300";
            fontColor = "#FFF";
            break;
          case "d":
            bgColor = "#6B6B6B";
            fontColor = "#FFF";
            break;
          case "e":
            bgColor = "#000";
            fontColor = "#fff";
            break;
          default:
            bgColor = "#fff";
            fontColor = "#000";
        }
      }

      return {
        ...provided,
        borderRadius: 8,
        borderColor: "none",
        minHeight: 36,
        backgroundColor: bgColor,
        color: fontColor,
      };
    },
    singleValue: (provided) => {
      return {
        ...provided,
        color: "white",
      };
    },
    option: (provided, state) => {
      let bgColor = "#000";
      let fontColor = "#FFF";

      switch ((state.data as StatusOption).value) {
        case "a":
          bgColor = state.isFocused ? "#C40000" : "white";
          fontColor = state.isFocused ? "white" : "black";
          break;
        case "b":
          bgColor = state.isFocused ? "#000DBD" : "white";
          fontColor = state.isFocused ? "white" : "black";
          break;
        case "c":
          bgColor = state.isFocused ? "#287300" : "white";
          fontColor = state.isFocused ? "white" : "black";
          break;
        case "d":
          bgColor = state.isFocused ? "#6B6B6B" : "white";
          fontColor = state.isFocused ? "white" : "black";
          break;
        case "e":
          bgColor = state.isFocused ? "#000" : "white";
          fontColor = state.isFocused ? "white" : "black";
          break;
      }

      return {
        ...provided,
        backgroundColor: bgColor,
        color: fontColor,
      };
    },
    dropdownIndicator: (provided) => ({
      ...provided,
      padding: "1px",
    }),
  };

  return (
    <div className='list-order-container'>
      <div className="list-order-actions">
        <input
          type="text"
          placeholder='検索：お名前、電話番号、受付番号などを入力'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='list-order-input'
        />

        <div className='btn-actions'>
          <ExcelExportButton data={orders} filename='注文ケーキ.xlsx' sheetName='注文' />
          <button onClick={() => setShowScanner(true)} className='list-btn qrcode-btn'>
            <img src="/icons/qrCodeImg.avif" alt="qrcode icon" />
          </button>
          <button onClick={() => navigate("/ordertable")} className='list-btn'>
            <img src="/icons/table.avif" alt="graphic icon" />
          </button>
        </div>
      </div>

      {showScanner && (
        <div id="reader" style={{ width: '300px', marginBottom: 20 }}></div>
      )}

      {foundScannedOrder && (
        <div style={{ border: '1px solid #007bff', padding: 12, marginBottom: 20 }}>
          <strong>
            <Select
              options={statusOptions}
              value={statusOptions.find((opt) => String(opt.value) === String(foundScannedOrder.status))}
              onChange={(selected) =>
                handleStatusChange(
                  foundScannedOrder.id_order,
                  selected?.value as "a" | "b" | "c" | "d" | "e"
                )
              }
              isDisabled={isUpdating}
              isLoading={isUpdating}
              styles={customStyles}
              isSearchable={false}
            />
          </strong>
          <strong>受付番号: </strong> {String(foundScannedOrder.id_order).padStart(4, "0")}<br />
          <strong>お名前: </strong> {foundScannedOrder.first_name} {foundScannedOrder.last_name}<br />
          <strong>電話番号: </strong> {foundScannedOrder.tel}<br />
          <strong>受取日: </strong> {formatDateJP(foundScannedOrder.date)} - {foundScannedOrder.pickupHour}<br />
          <strong>ご注文のケーキ: </strong>
          <ul className='cake-list'>
            {foundScannedOrder.cakes.map((cake, index) => (
              <li key={`${cake.cake_id}-${index}`}>
                <span className='cake-name'>{cake.name}</span>
                <span className='cake-amount'>¥{cake.size}</span>
                <span className='cake-size'>個数: {cake.amount}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : orders.length === 0 ? (
        <p>注文が見つかりません。</p>
      ) : (
        <>
          {/* Tabelas (desktop) */}
          {displayOrders.map(([groupTitles, ordersForGroup]: [string, Order[]]) => {
            const activeOrdersForGroup = ordersForGroup;
            // .filter(order => {
              // if (search.trim() === "キャンセル") return order.status === "e";
            //   return order.status !== "e";
            // });

            return (
              <div key={groupTitles} className="table-wrapper scroll-cell table-order-container">
                <table className="list-order-table table-order">
                  <thead>
                    <tr>
                      <th className='id-cell'>受付番号</th>
                      <th className='situation-cell'>
                        <div className='filter-column'>
                          お会計
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                          >
                            {filterOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </th>
                      <th>お名前</th>
                      <th>
                        <div className='filter-column'>
                          受取希望日時
                          <div className='filter-column-date'>
                            <select
                              value={dateFilter}
                              onChange={(e) => {
                                setDateFilter(e.target.value);
                                setHourFilter("すべて");
                              }}
                            >
                              <option value="すべて">すべて</option>
                              {Array.from(new Set(orders.map((o) => o.date)))
                                .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                                .map((date) => (
                                  <option key={date} value={date}>
                                    {formatDate(date)}
                                  </option>
                                ))}
                            </select>

                            <select
                              value={hourFilter}
                              onChange={(e) => setHourFilter(e.target.value)}
                              style={{ marginLeft: "6px" }}
                            >
                              <option value="すべて">すべて</option>
                              {Array.from(
                                new Set(
                                  orders
                                    .filter((o) => dateFilter === "すべて" || o.date === dateFilter)
                                    .map((o) => o.pickupHour)
                                )
                              )
                                .sort((a, b) => {
                                  const numA = parseInt(a);
                                  const numB = parseInt(b);
                                  return numA - numB;
                                })
                                .map((hour) => (
                                  <option key={hour} value={hour}>
                                    {hour}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      </th>
                      <th>
                        <div className='filter-column'>
                          ご注文のケーキ
                          <select value={cakeFilter} onChange={(e) => setCakeFilter(e.target.value)}>
                            <option value="すべて">すべて</option>
                            {Array.from(
                              new Set(
                                orders.flatMap((o) => (o.cakes ?? []).map((c) => c.name))
                              )
                            ).map((cake) => (
                              <option key={cake} value={cake}>{cake}</option>
                            ))}
                          </select>
                        </div>
                      </th>
                      <th>個数</th>
                      <th className='message-cell'>メッセージ</th>
                      <th>その他</th>
                      <th>電話番号</th>
                      <th>メールアドレス</th>
                      <th>編集</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrdersForGroup
                      .filter((order) => {
                        const matchesStatus = statusFilter === "すべて" || order.status === statusFilter;
                        const matchesCake = cakeFilter === "すべて" || order.cakes.some(cake => cake.name === cakeFilter);
                        const matchesDate = dateFilter === "すべて" || formatDateJP(order.date) === formatDateJP(dateFilter);
                        const matchesHour = hourFilter === "すべて" || order.pickupHour === hourFilter;
                        
                        return matchesStatus && matchesCake && matchesDate && matchesHour;
                      })
                      .sort((a, b) => {
                        if (dateFilter !== "すべて") {
                          const hourA = a.pickupHour || "";
                          const hourB = b.pickupHour || "";
                          return hourA.localeCompare(hourB, "ja");
                        } else {
                          const idA = Number(a.id_order) || 0;
                          const idB = Number(b.id_order) || 0;
                          return idA - idB;
                        }
                      })
                      .map((order) => (
                        <tr key={order.id_order}>
                          <td>{String(order.id_order).padStart(4, "0")}</td>
                          <td className='situation-cell'>
                            <Select<StatusOption, false>
                              options={statusOptions}
                              value={statusOptions.find((opt) => opt.value === order.status)}
                              onChange={(selected: SingleValue<StatusOption>) => {
                                if (selected) handleStatusChange(order.id_order, selected.value);
                              }}
                              styles={customStyles}
                              isSearchable={false}
                              isDisabled={isUpdating}
                              isLoading={isUpdating && updatingOrderId === order.id_order}
                            />
                          </td>
                          <td>
                            {order.first_name} {order.last_name}
                          </td>
                          <td>{formatDateJP(order.date)} {order.pickupHour}</td>
                          <td>
                            <ul>
                              {order.cakes.map((cake, index) => (
                                <li key={`${order.id_order}-${cake.cake_id}-${index}`}>
                                  {cake.name}
                                  {cake.size} - ¥{cake.price}<br />
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td style={{ textAlign: "left" }}>
                            <ul>
                              {order.cakes.map((cake, index) => (
                                <li key={`${order.id_order}-${cake.cake_id}-${index}`}>
                                  {cake.amount}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className='message-cell' style={{ textAlign: "left" }}>
                            <ul>
                              {order.cakes.map((cake, index) => (
                                <li key={`${order.id_order}-${cake.cake_id}-${index}`} >
                                  <div
                                    className={`ellipsis-text ${expandedOrderId === order.id_order ? 'expanded' : ''}`}
                                    onClick={() => setExpandedOrderId(expandedOrderId === order.id_order ? null : order.id_order)}
                                    title={expandedOrderId ? "" : "クリックして全メッセージを表示"}
                                    style={{ cursor: "pointer" }}
                                  >
                                    {cake.message_cake}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className='message-cell'>
                            <div
                              className={`ellipsis-text ${expandedOrderId === order.id_order ? 'expanded' : ''}`}
                              onClick={() => setExpandedOrderId(expandedOrderId === order.id_order ? null : order.id_order)}
                              title={expandedOrderId ? "" : "クリックして全メッセージを表示"}
                              style={{ cursor: "pointer" }}
                            >
                              {order.message || " "}
                            </div>
                          </td>
                          <td>{order.tel}</td>
                          <td>{order.email}</td>
                          <td>
                            <button
                              onClick={() => setEditingOrder(order)}
                              style={{
                                padding: "0.25rem 0.5rem",
                                backgroundColor: "#007bff",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem"
                              }}
                            >
                              編集
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Modal de edição */}
          {editingOrder && (
            <EditOrderModal
              editingOrder={editingOrder}
              setEditingOrder={setEditingOrder}
              handleSaveEdit={handleSaveEdit}
            />
          )}

          {/* Cards (mobile) */}
          <div className="mobile-orders">
            {orders.map((order) => (
              <div className="order-card" key={order.id_order}>
                <Select<StatusOption, false>
                  options={statusOptions}
                  value={statusOptions.find((opt) => opt.value === order.status)}
                  onChange={(selected: SingleValue<StatusOption>) => {
                    if (selected) handleStatusChange(order.id_order, selected.value);
                  }}
                  styles={customStyles}
                  isSearchable={false}
                  isDisabled={isUpdating}
                  isLoading={isUpdating && updatingOrderId === order.id_order}
                />
                <div className="order-header">
                  <span>受付番号: {String(order.id_order).padStart(4, "0")}</span>
                </div>
                <p>お名前: {order.first_name} {order.last_name}</p>
                <p>受取日: {formatDateJP(order.date)} {order.pickupHour}</p>
                <details>
                  <summary>ご注文内容</summary>
                  <ul>
                    {order.cakes.map((cake, index) => (
                      <li key={`${cake.cake_id}-${index}`}>
                        {cake.name} - 個数: {cake.amount} - {cake.size}
                      </li>
                    ))}
                  </ul>
                  <p>電話番号: {order.tel}</p>
                  <p>メッセージ: {order.message || " "}</p>
                </details>
                <button
                  onClick={() => setEditingOrder(order)}
                  style={{
                    marginTop: "0.5rem",
                    padding: "0.5rem 1rem",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  編集
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
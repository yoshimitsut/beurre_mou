import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { Html5Qrcode } from 'html5-qrcode';
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
  const [viewMode] = useState<"date" | "order">("order");
  const [activeTab, setActiveTab] = useState<"today" | "active" | "completed" | "cancelled" | "past">("today");

  const [isUpdating, setIsUpdating] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("すべて");
  const [cakeFilter, setCakeFilter] = useState("すべて");
  const [dateFilter, setDateFilter] = useState("すべて");
  const [hourFilter, setHourFilter] = useState("すべて");

  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);

  const [isSavingEdit, setIsSavingEdit] = useState(false);

  type FilterOption = {
    value: string;
    label: string;
  };

  const statusOptions = STATUS_OPTIONS;

  const filterOptions: FilterOption[] = [
    { value: "すべて", label: "すべて" },
    ...statusOptions
  ];

  const navigate = useNavigate();
  const handleSearch = useRef<number | null>(null);

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
          console.log("---"+normalized);
        })
        .catch((error) => {
          console.error('注文の読み込みエラー:', error);
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
  // No seu componente ListOrder, substitua o useEffect do scanner por:

useEffect(() => {
  let html5QrCode: Html5Qrcode | null = null;

  if (showScanner) {
    html5QrCode = new Html5Qrcode("reader");

    html5QrCode.start(
      { facingMode: "environment" },
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 } // 🔹 Corrigido formato
      },
      (decodedText) => {
        console.log("QR Code lido:", decodedText);
        setShowScanner(false);
        
        const orderId = Number(decodedText);
        if (!isNaN(orderId)) {
          const found = orders.find((o) => o.id_order === orderId);
          if (found) {
            setScannedOrderId(found.id_order);
          } else {
            alert("注文が見つかりません。");
          }
        } else {
          alert("QRコードが無効です。");
        }
      },
      (error) => {
        // Apenas log errors, não mostrar alertas para cada frame
        if (!error.includes("NotFoundException")) {
          console.warn("QRコード読み取りエラー:", error);
        }
      }
    ).catch((err) => {
      console.error("Erro ao iniciar câmera:", err);
      alert("カメラの起動に失敗しました。");
      setShowScanner(false);
    });
  }

  return () => {
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().then(() => {
        html5QrCode?.clear();
      }).catch((err) => {
        console.error("Erro ao parar scanner:", err);
      });
    }
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

  // 🔹 SEPARAR PEDIDOS POR CATEGORIAS
  const today = new Date().setHours(0, 0, 0, 0);

  // 🔹 Pedidos de Hoje: todos os status com data de hoje
  const todayOrders = useMemo(() => {
    return orders.filter(o => {
      const date = new Date(o.date).setHours(0, 0, 0, 0);
      const isFinish = o.status !== "d";  
      const orderNoCanceled = o.status !== "e";
      return date === today && isFinish && orderNoCanceled;
    });
  }, [orders, today]);

  // Pedidos Ativos: status a, b, c com data futura ou hoje
  const activeOrders = useMemo(() => {
    return orders.filter(o => {
      const date = new Date(o.date).setHours(0, 0, 0, 0);
      const isActiveStatus = o.status === "a" || o.status === "b" || o.status === "c";
      const isFutureOrToday = date >= today;
      return isActiveStatus && isFutureOrToday;
    });
  }, [orders, today]);

  // 🔹 Pedidos com Data Anterior: status a, b, c com data passada
  const pastDateOrders = useMemo(() => {
    return orders.filter(o => {
      const date = new Date(o.date).setHours(0, 0, 0, 0);
      const isActiveStatus = o.status === "a" || o.status === "b" || o.status === "c";
      const isPastDate = date < today;
      return isActiveStatus && isPastDate;
    });
  }, [orders, today]);

  // Pedidos Finalizados: status d (お渡し済み)
  const completedOrders = useMemo(() => {
    return orders.filter(o => o.status === "d");
  }, [orders]);

  // Pedidos Cancelados: status e (キャンセル)
  const cancelledOrders = useMemo(() => {
    return orders.filter(o => o.status === "e");
  }, [orders]);

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
      `【確認】ステータスを変更しますか？\n\n` +
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
        throw new Error(`サーバーからの応答が無効です（ステータス ${res.status}）`);
      }

      if (!res.ok || !data || !data.success) {
        throw new Error(data?.error || `保存に失敗しました（ステータス ${res.status}）`);
      }

      setOrders((old) =>
        old.map((o) => (o.id_order === id ? { ...o, status: newStatus } : o))
      );

    } catch (err) {
      console.error("ステータス更新エラー:", err);
      alert("サーバーへのステータス保存中にエラーが発生しました。リストを再読み込みします。");

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

    setIsSavingEdit(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${updatedOrder.id_order}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedOrder),
      });
      const data = await res.json();
      
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || "更新に失敗しました。");
      }
      
      setOrders((old) =>
        old.map((o) =>
          o.id_order === updatedOrder.id_order ? updatedOrder : o
    )
  );
  
      setRefreshKey(prev => prev + 1);
      
      setEditingOrder(null);
      alert("✅ 注文が正常に更新されました。");
    } catch (err) {
      console.error("❌ 編集保存エラー:", err);
      alert("❌ 更新中にエラーが発生しました。");
    } finally {
      setIsSavingEdit(false); 
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

  // 🔹 COMPONENTE PARA PEDIDOS DE HOJE
  const TodayOrdersTable = () => {
    const sortedTodayOrders = useMemo(() => {
      return [...todayOrders].sort((a, b) => {
        // Ordena por horário de retirada
        const timeA = a.pickupHour || "";
        const timeB = b.pickupHour || "";
        return timeA.localeCompare(timeB, "ja");
      });
    }, [todayOrders]);

    return (
      <>
        {sortedTodayOrders.length === 0 ? (
          <p>本日の注文はありません。</p>
        ) : (
          <div className="table-wrapper scroll-cell table-order-container">
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
                      受取希望時間
                      <select
                        value={hourFilter}
                        onChange={(e) => setHourFilter(e.target.value)}
                      >
                        <option value="すべて">すべて</option>
                        {Array.from(
                          new Set(todayOrders.map((o) => o.pickupHour))
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
                  </th>
                  <th>
                    <div className='filter-column'>
                      ご注文のケーキ
                      <select value={cakeFilter} onChange={(e) => setCakeFilter(e.target.value)}>
                        <option value="すべて">すべて</option>
                        {Array.from(
                          new Set(
                            todayOrders.flatMap((o) => (o.cakes ?? []).map((c) => c.name))
                          )
                        ).map((cake) => (
                          <option key={cake} value={cake}>{cake}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th>個数</th>
                  <th>フルーツ盛り</th>
                  <th className='message-cell'>メッセージプレート</th>
                  <th className='message-cell'>その他メッセージ</th>
                  <th>電話番号</th>
                  <th>メールアドレス</th>
                  <th>編集</th>
                </tr>
              </thead>
              <tbody>
                {sortedTodayOrders
                  .filter((order) => {
                    const matchesStatus = statusFilter === "すべて" || order.status === statusFilter;
                    const matchesCake = cakeFilter === "すべて" || order.cakes.some(cake => cake.name === cakeFilter);
                    const matchesHour = hourFilter === "すべて" || order.pickupHour === hourFilter;
                    
                    return matchesStatus && matchesCake && matchesHour;
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
                      <td>{order.first_name} {order.last_name}</td>
                      <td>{order.pickupHour}</td>
                      <td>
                        <ul>
                          {order.cakes.map((cake, index) => (
                            <li key={`${order.id_order}-${cake.cake_id}-${index}`}>
                              {cake.name} {cake.size} - ¥{cake.price}
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
                      <td style={{ textAlign: "left" }}>
                        <ul>
                          {order.cakes.map((cake, index) => (
                            <li key={`${order.id_order}-${cake.cake_id}-${index}`}>
                              {cake.fruit_option}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className='message-cell' style={{ textAlign: "left" }}>
                        <ul>
                          {order.cakes.map((cake, index) => (
                            <li key={`${order.id_order}-${cake.cake_id}-${index}`} >
                              {cake.message_cake}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className='message-cell'>
                        {order.message || " "}
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
        )}
      </>
    );
  };

  // 🔹 COMPONENTE PARA PEDIDOS ATIVOS
  const ActiveOrdersTable = () => (
    <>
      {activeOrders.length === 0 ? (
        <p>現在の注文はありません。</p>
      ) : (
        <>
          {/* Tabelas (desktop) */}
          {displayOrders
            .filter(([, list]) => list.some(o => activeOrders.includes(o)))
            .map(([groupTitles, ordersForGroup]: [string, Order[]]) => {
              const activeOrdersForGroup = ordersForGroup.filter(order => 
                activeOrders.includes(order)
              );

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
                                {Array.from(new Set(activeOrders.map((o) => o.date)))
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
                                    activeOrders
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
                                  activeOrders.flatMap((o) => (o.cakes ?? []).map((c) => c.name))
                                )
                              ).map((cake) => (
                                <option key={cake} value={cake}>{cake}</option>
                              ))}
                            </select>
                          </div>
                        </th>
                        <th>個数</th>
                        <th>フルーツ盛り</th>
                        <th className='message-cell'>プレートメッセージ</th>
                        <th className='message-cell'>その他メッセージ</th>
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
                            <td style={{ textAlign: "left" }}>
                              <ul>
                                {order.cakes.map((cake, index) => (
                                  <li key={`${order.id_order}-${cake.cake_id}-${index}`}>
                                    {cake.fruit_option}
                                  </li>
                                ))}
                              </ul>
                            </td>
                            <td className='message-cell' style={{ textAlign: "left" }}>
                              <ul>
                                {order.cakes.map((cake, index) => (
                                  <li key={`${order.id_order}-${cake.cake_id}-${index}`} >
                                    {cake.message_cake}
                                  </li>
                                ))}
                              </ul>
                            </td>
                            <td className='message-cell'>
                              <li>
                                {order.message || " "}
                              </li>
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

          {/* Cards (mobile) */}
          <div className="mobile-orders">
            {activeOrders.map((order) => (
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
                  
                  <ul>
                    {order.cakes.map((cake, index) => (
                      <li key={`${cake.cake_id}-${index}`}>
                        {cake.name} - フルーツ盛り: {cake.fruit_option}
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
    </>
  );

  // 🔹 COMPONENTE PARA PEDIDOS COM DATA ANTERIOR
  const PastDateOrdersTable = () => {
    const sortedPastDateOrders = useMemo(() => {
      return [...pastDateOrders].sort((a, b) => {
        // Ordena por data (mais recente primeiro)
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        
        if (dateA !== dateB) {
          return dateB - dateA; // Mais recente primeiro
        }
        
        // Se for a mesma data, ordena por horário
        const timeA = a.pickupHour || "";
        const timeB = b.pickupHour || "";
        return timeA.localeCompare(timeB, "ja");
      });
    }, [pastDateOrders]);

    return (
      <>
        {sortedPastDateOrders.length === 0 ? (
          <p>過去の日付の注文はありません。</p>
        ) : (
          <div className="table-wrapper scroll-cell table-order-container">
            <table className="list-order-table table-order">
              <thead>
                <tr>
                  <th>受付番号</th>
                  <th className='situation-cell'>お会計</th>
                  <th>お名前</th>
                  <th>受取希望日時</th>
                  <th>ご注文のケーキ</th>
                  <th>個数</th>
                  <th>フルーツ盛り</th>
                  <th className='message-cell'>メッセージプレート</th>
                  <th className='message-cell'>その他メッセージ</th>
                  <th>電話番号</th>
                  <th>メールアドレス</th>
                  <th>編集</th>
                </tr>
              </thead>
              <tbody>
                {sortedPastDateOrders.map(order => (
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
                    <td>{order.first_name} {order.last_name}</td>
                    <td>{formatDateJP(order.date)} {order.pickupHour}</td>
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.name} {cake.size}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.amount}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.fruit_option}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.message_cake}</li>
                        ))}
                      </ul>
                    </td>
                    <td>{order.message}</td>
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
        )}
      </>
    );
  };

  // 🔹 COMPONENTE PARA PEDIDOS FINALIZADOS
  const CompletedOrdersTable = () => {
    const sortedCompletedOrders = useMemo(() => {
      return [...completedOrders].sort((a, b) => {
        // Ordena por data (mais recente primeiro)
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        
        if (dateA !== dateB) {
          return dateB - dateA; // Mais recente primeiro
        }
        
        // Se for a mesma data, ordena por horário
        const timeA = a.pickupHour || "";
        const timeB = b.pickupHour || "";
        return timeA.localeCompare(timeB, "ja");
      });
    }, [completedOrders]);

    return (
      <>
        {sortedCompletedOrders.length === 0 ? (
          <p>お渡し済みの注文はありません。</p>
        ) : (
          <div className="table-wrapper scroll-cell table-order-container">
            <table className="list-order-table table-order">
              <thead>
                <tr>
                  <th>受付番号</th>
                  <th>お名前</th>
                  <th>受取希望日時</th>
                  <th>ご注文のケーキ</th>
                  <th>個数</th>
                  <th>フルーツ盛り</th>
                  <th>メッセージプレート</th>
                  <th>その他メッセージ</th>
                  <th>電話番号</th>
                  <th>メールアドレス</th>
                </tr>
              </thead>
              <tbody>
                {sortedCompletedOrders.map(order => (
                  <tr key={order.id_order}>
                    <td>{String(order.id_order).padStart(4, "0")}</td>
                    <td>{order.first_name} {order.last_name}</td>
                    <td>{formatDateJP(order.date)} {order.pickupHour}</td>
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.name} {cake.size}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.amount}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.fruit_option}</li>
                        ))}
                      </ul>
                    </td>
                    
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.message_cake}</li>
                        ))}
                      </ul>
                    </td>
                    <td>{order.message}</td>
                    <td>{order.tel}</td>
                    <td>{order.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  };

  // 🔹 COMPONENTE PARA PEDIDOS CANCELADOS
  const CancelledOrdersTable = () => {
    const sortedCancelledOrders = useMemo(() => {
      return [...cancelledOrders].sort((a, b) => {
        // Ordena por data (mais recente primeiro)
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        
        if (dateA !== dateB) {
          return dateB - dateA; // Mais recente primeiro
        }
        
        // Se for a mesma data, ordena por horário
        const timeA = a.pickupHour || "";
        const timeB = b.pickupHour || "";
        return timeA.localeCompare(timeB, "ja");
      });
    }, [cancelledOrders]);

    return (
      <>
        {sortedCancelledOrders.length === 0 ? (
          <p>キャンセルされた注文はありません。</p>
        ) : (
          <div className="table-wrapper scroll-cell table-order-container">
            <table className="list-order-table table-order">
              <thead>
                <tr>
                  <th>受付番号</th>
                  <th>お名前</th>
                  <th>受取希望日時</th>
                  <th>ご注文のケーキ</th>
                  <th>個数</th>
                  <th>フルーツ盛り</th>
                  <th>メッセージプレート</th>
                  <th>その他メッセージ</th>
                  <th>電話番号</th>
                  <th>メールアドレス</th>
                </tr>
              </thead>
              <tbody>
                {sortedCancelledOrders.map(order => (
                  <tr key={order.id_order}>
                    <td>{String(order.id_order).padStart(4, "0")}</td>
                    <td>{order.first_name} {order.last_name}</td>
                    <td>{formatDateJP(order.date)} {order.pickupHour}</td>
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.name} {cake.size}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.amount}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.fruit_option}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <ul>
                        {order.cakes.map((cake, i) => (
                          <li key={i}>{cake.message_cake}</li>
                        ))}
                      </ul>
                    </td>
                    <td>{order.message}</td>
                    <td>{order.tel}</td>
                    <td>{order.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
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
            <img src="/icons/qr-code.ico" alt="QRコードアイコン" />
          </button>
          <button onClick={() => navigate("/ordertable")} className='list-btn'>
            <img src="/icons/graph.ico" alt="グラフアイコン" />
          </button>
        </div>
      </div>

      {showScanner && (
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <button 
            onClick={() => setShowScanner(false)}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 1000,
              background: 'red',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
          <div id="reader" style={{ width: '100%', maxWidth: '300px' }}></div>
        </div>
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
                <span className='cake-amount'>¥{cake.price.toLocaleString()}</span>
                <span className='cake-size'>サイズ: {cake.size}</span>
                <span className='cake-quantity'>個数: {cake.amount}</span>
                <span className='cake-fruitop'>フルーツ盛り: {cake.fruit_option}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p>読み込み中...</p>
      ) : orders.length === 0 ? (
        <p>注文が見つかりません。</p>
      ) : (
        <>
          {/* 🔹 ABAS ATUALIZADAS - 5 ABAS AGORA */}
          <div className="tabs-container">
            <div className="tabs-header">
              <button
                className={`tab-button ${activeTab === "today" ? "active" : ""}`}
                onClick={() => setActiveTab("today")}
              >
                🎂 本日お渡し予定分 ({todayOrders.length})
              </button>
              <button
                className={`tab-button ${activeTab === "active" ? "active" : ""}`}
                onClick={() => setActiveTab("active")}
              >
                📅 現在の注文 ({activeOrders.length})
              </button>
              <button
                className={`tab-button ${activeTab === "past" ? "active" : ""}`}
                onClick={() => setActiveTab("past")}
              >
                ⏰ 過去の日付 ({pastDateOrders.length})
              </button>
              <button
                className={`tab-button ${activeTab === "completed" ? "active" : ""}`}
                onClick={() => setActiveTab("completed")}
              >
                ✅ お渡し済み ({completedOrders.length})
              </button>
              <button
                className={`tab-button ${activeTab === "cancelled" ? "active" : ""}`}
                onClick={() => setActiveTab("cancelled")}
              >
                ❌ キャンセル ({cancelledOrders.length})
              </button>
            </div>

            <div className="tab-content">
              {activeTab === "today" && <TodayOrdersTable />}
              {activeTab === "active" && <ActiveOrdersTable />}
              {activeTab === "past" && <PastDateOrdersTable />}
              {activeTab === "completed" && <CompletedOrdersTable />}
              {activeTab === "cancelled" && <CancelledOrdersTable />}
            </div>
          </div>

          {/* Modal de edição */}
          {editingOrder && (
            <EditOrderModal
              editingOrder={editingOrder}
              setEditingOrder={setEditingOrder}
              handleSaveEdit={handleSaveEdit}
              isSaving={isSavingEdit}
            />
          )}
        </>
      )}
    </div>
  );
}
// components/EditOrderModal.tsx
import { useState, useEffect } from "react";
import Select, { type SingleValue, type StylesConfig } from "react-select";
import type { CSSObjectWithLabel, GroupBase } from "react-select";
import DateTimePicker from "./DateTimePicker";
import type { Order, Cake, OrderCake, SizeOption } from "../types/types";
import './EditOrderModal.css';
import { formatDateForBackend } from "../utils/dateUtils";

type Props = {
  editingOrder: Order;
  setEditingOrder: (order: Order | null) => void;
  handleSaveEdit: (updatedOrder: Order) => void;
};

const API_URL = import.meta.env.VITE_API_URL;

export default function EditOrderModal({ editingOrder, setEditingOrder, handleSaveEdit }: Props) {
  const [cakesData, setCakesData] = useState<Cake[]>([]);
  const [cakes, setCakes] = useState<OrderCake[]>(editingOrder.cakes ? [...editingOrder.cakes] : []);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTime, setSelectedTime] = useState(editingOrder.pickupHour || "");
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(
  editingOrder.date ? 
    (() => {
      const [year, month, day] = editingOrder.date.split('-').map(Number);
      return new Date(year, month - 1, day);
    })()
    : null
  );

  // Fetch bolos
  useEffect(() => {
    fetch(`${API_URL}/api/cake`)
      .then(res => res.json())
      .then(data => setCakesData(data.cakes || []))
      .catch(err => console.error(err));
  }, []);

  const updateCake = (index: number, field: keyof OrderCake, value: string | number) => {
    setCakes(prev => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const addCake = () => {
    if (cakesData.length > 0) {
      const firstCake = cakesData[0];
      const firstSize = firstCake.sizes[0];
      
      const newCake: OrderCake = {
        cake_id: firstCake.id,
        name: firstCake.name,
        amount: 1,
        size: firstSize?.size || "",
        price: firstSize?.price || 0,
        message_cake: ""
      };
      
      setCakes(prev => [...prev, newCake]);
    }
  };

  const removeCake = (index: number) => {
    if (cakes.length > 1) {
      setCakes(prev => prev.filter((_, i) => i !== index));
    } else {
      alert("少なくとも1つのケーキが必要です。");
    }
  };

  const getCakeDataById = (cakeId: number): Cake | undefined => {
    return cakesData.find(cake => cake.id === cakeId);
  };

  const getSizeOptions = (cakeId: number): SizeOption[] => {
    const cakeData = getCakeDataById(cakeId);
    if (!cakeData) return [];

    return cakeData.sizes.map(s => ({
      ...s,
      label: `${s.size} ￥${s.price.toLocaleString()}`
    }));
  };

  const cakeOptions = cakesData.map(c => ({ value: String(c.id), label: c.name }));

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const updatedOrder: Order = {
        ...editingOrder,
        cakes: cakes,
        date: selectedDate
          ? formatDateForBackend(selectedDate)
          : editingOrder.date,
        pickupHour: selectedTime || editingOrder.pickupHour,
      };

      await handleSaveEdit(updatedOrder);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("エラーが発生しました。もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  };

  type OptionType = { value: string; label: string };

  const customStyles: StylesConfig<OptionType, false, GroupBase<OptionType>> = {
    control: (base: CSSObjectWithLabel) => ({
      ...base,
      minWidth: "200px",
      width: "100%",
      borderRadius: "6px",
      borderColor: "#ccc",
      boxShadow: "none",
      "&:hover": { borderColor: "#007bff" },
    }),
    menu: (base: CSSObjectWithLabel) => ({ ...base, zIndex: 9999 }),
    valueContainer: (base: CSSObjectWithLabel) => ({ ...base, padding: "4px 8px" }),
    placeholder: (base: CSSObjectWithLabel) => ({ ...base, color: "#aaa" }),
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-top">
          <h2 className="modal-title">注文の編集 - 受付番号 {String(editingOrder.id_order).padStart(4, "0")}</h2>
          <button className="modal-close-button"
              onClick={() => setEditingOrder(null)}
          >
            閉じる
          </button>
        </div>

        {/* Dados do cliente */}
        <div className="modal-edit-content" >
          <div className="modal-name">
            <label>姓(カタカナ)：</label>
            <input 
              className="input-text-modal"
              type="text" 
              value={editingOrder.first_name || ""} 
              onChange={(e) => setEditingOrder({ ...editingOrder, first_name: e.target.value })} 
            />
          </div>
          <div style={{ width: "50%" }}>
            <label>名(カタカナ)：</label>
            <input 
              className="input-text-modal"
              type="text" 
              value={editingOrder.last_name || ""} 
              onChange={(e) => setEditingOrder({ ...editingOrder, last_name: e.target.value })} 
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "2rem", marginTop: "1rem" }}>
          <div style={{ width: "50%" }}>
            <label>メールアドレス：</label>
            <input 
              className="input-text-modal"
              type="text" 
              value={editingOrder.email || ""} 
              onChange={(e) => setEditingOrder({ ...editingOrder, email: e.target.value })} 
            />
          </div>
          <div style={{ width: "50%" }}>
            <label>お電話番号：</label>
            <input 
              className="input-text-modal"
              type="text" 
              value={editingOrder.tel || ""} 
              onChange={(e) => setEditingOrder({ ...editingOrder, tel: e.target.value })} 
            />
          </div>
        </div>

        {/* Resumo do pedido */}
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3>ご注文のケーキ:</h3>
            <button 
              onClick={addCake}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              + ケーキを追加
            </button>
          </div>
          
          {cakes.map((cake, index) => (
            <div key={index} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem", position: "relative" }}>
              {cakes.length > 1 && (
                <button 
                  onClick={() => removeCake(index)}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    width: "24px",
                    height: "24px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px"
                  }}
                  title="ケーキを削除"
                >
                  ×
                </button>
              )}
              
              <div
  style={{
    marginBottom: 16,
    display: "flex",
    gap: "1rem",
    alignItems: "flex-start",
    flexWrap: "wrap",
  }}
  className="cake-container"
>
  <div className="cake-number">{index + 1}</div>

  <div style={{ flex: 1, minWidth: "280px" }}>
    {/* Linha com tipo, tamanho e quantidade */}
    <div
      style={{
        marginBottom: 8,
        display: "flex",
        gap: "1rem",
        alignItems: "center",
        flexWrap: "wrap",
      }}
      className="cake-row"
    >
      {/* ケーキ名 */}
      <div style={{ flex: 1, minWidth: "200px" }} className="cake-info-1">
        <label>ケーキ名:</label>
        <Select<OptionType, false, GroupBase<OptionType>>
          styles={customStyles}
          options={cakeOptions}
          value={cakeOptions.find(opt => String(opt.value) === String(cake.cake_id))}
          onChange={(val: SingleValue<OptionType>) => {
            if (val) {
              const newCakeId = Number(val.value);
              const selectedCake = getCakeDataById(newCakeId);
              if (selectedCake) {
                const firstSize = selectedCake.sizes[0];
                setCakes(prev =>
                  prev.map((c, i) =>
                    i === index
                      ? {
                          ...c,
                          cake_id: newCakeId,
                          name: val.label,
                          size: firstSize?.size || "",
                          price: firstSize?.price || 0,
                        }
                      : c
                  )
                );
              }
            }
          }}
        />
      </div>

      {/* サイズ */}
      <div style={{ flex: 1, minWidth: "200px" }}>
        <label>サイズを選択:</label>
        <Select<SizeOption, false, GroupBase<SizeOption>>
          options={getSizeOptions(cake.cake_id)}
          value={
            getSizeOptions(cake.cake_id).find(
              s => s.size === cake.size
            ) || null
          }
          onChange={selected => {
            if (selected) {
              setCakes(prev =>
                prev.map((c, i) =>
                  i === index ? { ...c, size: selected.size, price: selected.price } : c
                )
              );
            }
          }}
          placeholder="サイズを選択"
          isSearchable={false}
          classNamePrefix="react-select-edit"
          required
          formatOptionLabel={option =>
            `${option.size} ￥${option.price.toLocaleString()}`
          }
        />
      </div>

      {/* 数量 */}
      <div style={{ minWidth: "100px" }}>
        <label>数量:</label>
        <input
          className="input-text-modal"
          type="number"
          min="1"
          value={cake.amount}
          onChange={e => updateCake(index, "amount", Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>
    </div>

    {/* メッセージ */}
    <div>
      <label>メッセージプレート:</label>
      <input
        type="text"
        className="input-text-modal"
        value={cake.message_cake || ""}
        onChange={e => updateCake(index, "message_cake", e.target.value)}
        style={{ width: "100%" }}
        placeholder="メッセージを入力（任意）"
      />
    </div>
  </div>
</div>

            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "2rem", marginTop: "1rem" }}>
          <DateTimePicker
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedTime={selectedTime}
            setSelectedTime={setSelectedTime}
          />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <label>メッセージ：</label>
          <textarea 
            value={editingOrder.message || ""} 
            onChange={(e) => setEditingOrder({ ...editingOrder, message: e.target.value })} 
            style={{ width: "100%", minHeight: "80px" }}
            placeholder="全体メッセージを入力（任意）"
          />
        </div>

        <div className="modal-buttons" style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexDirection: "row-reverse" }}>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: isSaving ? "#6c757d" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? "保存中..." : "保存"}
          </button>

        </div>
      </div>
    </div>
  );
}
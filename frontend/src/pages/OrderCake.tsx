import { useState, useEffect } from 'react';
import Select, { type StylesConfig, type GroupBase } from 'react-select';
import DatePicker, { CalendarContainer } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ja } from 'date-fns/locale';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, isAfter, isSameDay, format, endOfMonth, getDay } from 'date-fns';

import type { Cake, OrderCake, OptionType, MyContainerProps, SizeOption, TimeOptionType } from "../types/types.ts";
import "./OrderCake.css";

const API_URL = import.meta.env.VITE_API_URL;

type CustomOptionType = OptionType & {
  isDisabled?: boolean;
};

// type TimeOptionType = OptionType & {
//   id: number;
//   isDisabled?: boolean;
// };

export default function OrderCake() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [cakesData, setCakesData] = useState<Cake[]>();
  const [cakes, setCakes] = useState<OrderCake[]>([
    { cake_id: 0, name: "", amount: 1, size: "", price: 1, message_cake: "", fruit_option: "無し" }
  ]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // const [timeSlotsData, setTimeSlotsData] = useState<TimeslotSQL[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickupHour, setPickupHour] = useState("時間を選択");
  const [, setText] = useState("");

  // Datas e calendário
  const today = new Date();
  const diasABloquear = 2;
  const maxDate = endOfMonth(addDays(today, 90));

  const [, setFruitOption] = useState<"有り" | "無し">("無し");

  const diasEspecificosPorMes = [
    { day: 2, month: 10 }, { day: 3, month: 10 }, { day: 9, month: 10 }, { day: 10, month: 10 },
    { day: 16, month: 10 }, { day: 17, month: 10 }, { day: 23, month: 10 }, { day: 24, month: 10 },
    { day: 30, month: 11 }, { day: 1, month: 11 }, { day: 7, month: 11 }, { day: 8, month: 11 },
    { day: 9, month: 11 }, { day: 13, month: 11 }, { day: 18, month: 11 }, { day: 19, month: 11 },
    { day: 25, month: 12 }, { day: 26, month: 12 }, { day: 4, month: 12 }, { day: 5, month: 12 },
    { day: 7, month: 12 }, { day: 8, month: 12 }, { day: 9, month: 12 }, { day: 13, month: 12 },
    { day: 18, month: 12 }, { day: 19, month: 12 }, { day: 25, month: 12 }, { day: 26, month: 12 },
  ];

  const gerarDiasBloqueadosInicio = () => {
    const datas = [];
    let data = today;
    while (datas.length < diasABloquear) {
      datas.push(data);
      data = addDays(data, 1);
    }
    return datas;
  };

  const gerarDatasEspecificasComMes = () => {
    const datas: Date[] = [];
    diasEspecificosPorMes.forEach(({ day, month }) => {
      const date = new Date(today.getFullYear(), month, day);
      if (isAfter(date, today)) {
        datas.push(date);
      }
    });
    return datas;
  };

  const excludedDates = [
    ...gerarDiasBloqueadosInicio(),
    ...gerarDatasEspecificasComMes(),
  ];

  const isDateAllowed = (date: Date) => !excludedDates.some((d) => isSameDay(d, date));

  const timeSlots: TimeOptionType[] = [
    { id: 1, value: "11:00〜12:00", label: "11:00〜12:00" },
    { id: 2, value: "12:00〜13:00", label: "12:00〜13:00" },
    { id: 3, value: "13:00〜14:00", label: "13:00〜14:00" },
    { id: 4, value: "14:00〜15:00", label: "14:00〜15:00" },
    { id: 5, value: "15:00〜16:00", label: "15:00〜16:00" },
    { id: 6, value: "16:00〜17:00", label: "16:00〜17:00" },
    { id: 7, value: "17:00〜18:00", label: "17:00〜18:00" },
    { id: 8, value: "18:00〜19:00", label: "18:00〜19:00" }
  ];

  // Efeitos
  useEffect(() => {
    fetch(`${API_URL}/api/cake`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.cakes)) {
          setCakesData(data.cakes);
        } else {
          console.error("Formato inesperado:", data);
        }
      })
      .catch(err => console.error("Erro ao carregar bolos:", err));
  }, []);

  // useEffect(() => {
  //   fetch(`${API_URL}/api/timeslots`)
  //     .then(res => res.json())
  //     .then((data) => {
  //       if (Array.isArray(data.timeslots)) {
  //         setTimeSlotsData(data.timeslots);
  //       } else {
  //         console.error("Formato inesperado de timeslots:", data);
  //         setTimeSlotsData([]);
  //       }
  //     })
  //     .catch(err => console.error("Erro ao carregar datas:", err));
  // }, []);

  const selectedCakeName = searchParams.get("cake");
  useEffect(() => {
    if (!cakesData) return;

    if (selectedCakeName) {
      const selectedCake = cakesData.find(c => String(c.id) === selectedCakeName || c.name === selectedCakeName);
      if (selectedCake) {
        setCakes([{
          cake_id: selectedCake.id,
          name: selectedCake.name,
          amount: 1,
          size: "",
          price: 1,
          message_cake: "",
          fruit_option: "無し"
        }]);
      }
    }
  }, [cakesData, selectedCakeName]);

  // Funções do componente
  const MyContainer = ({ className, children }: MyContainerProps) => {
    return (
      <div>
        <CalendarContainer className={className}>{children}</CalendarContainer>
        <div className='calendar-notice'>
          <div style={{ padding: "20px" }}>
            <p>３日前よりご予約可能</p>
          </div>
          <div className='notice'>
            <div className='selectable'></div>
            <span>予約可能日  /  <span className='yassumi'>x</span> 予約不可</span>
          </div>
        </div>
      </div>
    );
  };

  const addCake = () => {
    setCakes(prev => [
      ...prev,
      { cake_id: 0, name: "", amount: 1, size: "", price: 1, message_cake: "", fruit_option: "無し" }
    ]);
  };

  const removeCake = (index: number) => {
    setCakes(prev => prev.filter((_, i) => i !== index));
  };

  const updateCake = <K extends keyof OrderCake>(
    index: number,
    field: K,
    value: OrderCake[K]
  ) => {
    setCakes(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  // const handleDateChange = (date: Date | null) => {
  //   setSelectedDate(date);
  // };

  const renderDayContents = (day: number, date: Date) => {
    const isBlocked = excludedDates.some(d => isSameDay(d, date));
    const dayOfWeek = getDay(date);
    
    const extraClass =
      dayOfWeek === 0 ? "domingo-vermelho" :
      dayOfWeek === 6 ? "sabado-azul" : "";

    return (
      <div className={`day-cell ${extraClass}`}>
        <span>{day}</span>
        {isBlocked && <span className="yassumi">x</span>}
        {!isBlocked && isAfter(date, today) && <div className="selectable"></div>}
      </div>
    );
  };
  
const customStylesHour: StylesConfig<TimeOptionType, false> = {
  option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? '#fdd111' : state.isFocused ? '#fdeca2' : 'white',
      color: state.isDisabled ? '#999' : '#333',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    }),
    control: (provided, state) => ({
      ...provided,
      borderColor: state.isFocused ? '#fdeca2' : '#ddd',
      boxShadow: state.isFocused ? '0 0 0 1px #fdeca2' : 'none',
      '&:hover': { borderColor: '#fdeca2' },
    }),
    singleValue: (provided) => ({
      ...provided,
      color: '#333',
      borderRadius: '4px',
      padding: '2px 6px',
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999,
    }),
};

  const customStyles: StylesConfig<OptionType, false, GroupBase<OptionType>> = {
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? '#fdd111' : state.isFocused ? '#fdeca2' : 'white',
      color: state.isDisabled ? '#999' : '#333',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    }),
    control: (provided, state) => ({
      ...provided,
      borderColor: state.isFocused ? '#fdeca2' : '#ddd',
      boxShadow: state.isFocused ? '0 0 0 1px #fdeca2' : 'none',
      '&:hover': { borderColor: '#fdeca2' },
    }),
    singleValue: (provided) => ({
      ...provided,
      color: '#333',
      borderRadius: '4px',
      padding: '2px 6px',
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999,
    }),
  };

  const customStylesSize: StylesConfig<SizeOption, false> = {
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? '#fdd111' : state.isFocused ? '#fdeca2' : 'white',
      color: state.isDisabled ? '#999' : '#333',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    }),
    control: (provided, state) => ({
      ...provided,
      borderColor: state.isFocused ? '#fdeca2' : '#ddd',
      boxShadow: state.isFocused ? '0 0 0 1px #fdeca2' : 'none',
      '&:hover': { borderColor: '#fdeca2' },
    }),
    singleValue: (provided) => ({
      ...provided,
      color: '#333',
      borderRadius: '4px',
      padding: '2px 6px',
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999,
    }),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const getLocalDateString = (date: Date | null): string => {
      if (!date) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const data = {
      id_client: Math.random().toString(36).substring(2, 8),
      first_name: (document.getElementById("first-name") as HTMLInputElement).value,
      last_name: (document.getElementById("last-name") as HTMLInputElement).value,
      email: (document.getElementById("email") as HTMLInputElement).value,
      tel: (document.getElementById("tel") as HTMLInputElement).value,
      date: getLocalDateString(selectedDate), 
      date_order: format(new Date(), "yyyy-MM-dd"),
      pickupHour,
      status: 'b',
      message: (document.getElementById("message") as HTMLTextAreaElement).value,
      cakes: cakes.map(c => {
        const cakeData = cakesData?.find(cake => Number(cake.id) === Number(c.cake_id));
        return {
          cake_id: cakeData?.id || c.cake_id,
          name: cakeData?.name || c.name,
          amount: c.amount,
          price: c.price,
          size: c.size,
          message_cake: c.message_cake || "",
          fruit_option: c.fruit_option
        };
      })
    }; 
    
    try {
      const res = await fetch(`${API_URL}/api/reservar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        navigate("/order/check", { state: { newOrderCreated: true } });
        if (cakesData && cakesData.length > 0) {
          const initialCake = cakesData[0];
          setCakes([{
            cake_id: initialCake.id,
            name: initialCake.name,
            amount: 1,
            size: "",
            price: 1,
            message_cake: "",
            fruit_option: "無し"
          }]);
        }
        setSelectedDate(null);
        setFruitOption("無し");
        setPickupHour("時間を選択");
        (document.getElementById("first-name") as HTMLInputElement).value = "";
        (document.getElementById("last-name") as HTMLInputElement).value = "";
        (document.getElementById("email") as HTMLInputElement).value = "";
        (document.getElementById("tel") as HTMLInputElement).value = "";
        (document.getElementById("message") as HTMLTextAreaElement).value = "";
      } else {
        alert(result.error);
      }
    } catch (error) {
      alert("送信に失敗しました。");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  function toKatakana(str: string) {
    return str.replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  }

  return (
    <div className='reservation-main'>
      <div className="container">
        <h2 className='cake-title-h2'>デコレーションケーキ</h2>
        <h2 className='cake-title-h2'>予約フォーム</h2>

        <form className="form-order" onSubmit={handleSubmit}>
          <div className="cake-information">
            {cakes.map((item, index) => {
              const selectedCakeData = cakesData?.find(c => c.id === item.cake_id);
              const sizeOptions: SizeOption[] = selectedCakeData?.sizes.map(s => ({
                ...s,
                value: s.size,
                label: `${s.size} ￥${s.price.toLocaleString()} `
              })) || [];
              const selectedSize = sizeOptions.find(s => s.size === item.size);

              return (
                <div className="box-cake" key={`${item.id}-${index}`} >
                  {index > 0 && (
                    <div className='btn-remove-div'>
                      <button type="button" onClick={() => removeCake(index)} className='btn-remove-cake'>
                        ❌
                      </button>
                    </div>
                  )}
                  {selectedCakeData && (
                    <img className='img-cake-order' src={`image/${selectedCakeData.image}`} alt={selectedCakeData.name} />
                  )}
                  <div className='input-group'>
                    <Select<CustomOptionType>
                      options={cakesData?.map(c => ({ value: String(c.id), label: c.name, image: c.image })) || []}
                      value={cakesData?.map(c => ({ value: String(c.id), label: c.name })).find(c => Number(c.value) === item.cake_id) || null}
                      onChange={selected => {
                        if (selected) {
                          const newCakeId = Number(selected.value);
                          const selectedCake = cakesData?.find(c => c.id === newCakeId);
                          updateCake(index, "cake_id", newCakeId);
                          updateCake(index, "size", "");
                          updateCake(index, "price", 0);
                          if (selectedCake?.sizes && selectedCake.sizes.length === 1) {
                            const singleSize = selectedCake.sizes[0];
                            if (singleSize.stock > 0) {
                              updateCake(index, "size", singleSize.size);
                              updateCake(index, "price", singleSize.price);
                            }
                          }
                        } else {
                          updateCake(index, "cake_id", 0);
                          updateCake(index, "size", "");
                          updateCake(index, "price", 0);
                        }
                      }}
                      noOptionsMessage={() => "読み込み中..."}
                      classNamePrefix="react-select"
                      placeholder="ケーキを選択"
                      required
                      isSearchable={false}
                      styles={customStyles}
                    />
                    <label className='select-group'>*ケーキ名:</label>
                  </div>
                  {selectedCakeData && (
                    <div className='input-group'>
                      <Select<SizeOption>
                        options={sizeOptions} 
                        value={selectedSize || null}
                        onChange={(selected) => {
                          if (selected) {
                            updateCake(index, "size", selected.size);
                            updateCake(index, "price", selected.price);
                          }
                        }}
                        placeholder='サイズを選択'
                        isSearchable={false}
                        classNamePrefix='react-select'
                        required
                        styles={customStylesSize}
                      />
                      <label className='select-group'>*ケーキのサイズ</label>
                    </div>
                  )}

                  <div className="input-group-radio">
  <div className="pill-group">
    <label className={`pill ${item.fruit_option === "無し" ? "active" : ""}`}>
      <input
        type="radio"
        name={`fruit-option-${index}`}  // Nome único para cada bolo
        value="無し"
        checked={item.fruit_option === "無し"}
        onChange={() => updateCake(index, "fruit_option", "無し")}
      />
      無し
    </label>
    <label className={`pill ${item.fruit_option === "有り" ? "active" : ""}`}>
      <input
        type="radio"
        name={`fruit-option-${index}`}  // Nome único para cada bolo
        value="有り"
        checked={item.fruit_option === "有り"}
        onChange={() => updateCake(index, "fruit_option", "有り")}
      />
      有り ＋648円（税込）
    </label>
  </div>
  <label className='select-group-radio'>*フルーツ盛り</label>
</div>



                  
                  <div className='input-group'>
                    <Select<OptionType>
                      options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                      value={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })).find(opt => opt.value === String(item.amount)) || null}
                      isSearchable={false}
                      onChange={selected => updateCake(index, "amount", selected ? Number(selected.value) : 0)}
                      classNamePrefix="react-select"
                      placeholder="数量"
                      styles={customStyles}
                      required
                    />
                    <label className='select-group'>*個数:</label>
                  </div>
                  

                  
                  <div className='input-group'>
                    <label htmlFor="message_cake">メッセージプレート</label>
                    <textarea name="message_cake" id="message_cake" placeholder="ご要望がある場合のみご記入ください。"
                      value={item.message_cake || ""}
                      onChange={(e) => updateCake(index, "message_cake", e.target.value)}
                    ></textarea>
                  </div>
                  <div className='btn-div'>
                    <button type='button' onClick={addCake} className='btn btn-add-cake'>
                      ➕ 別のケーキを追加
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="client-information">
            <label htmlFor="full-name" className='title-information'>お客様情報</label>
            <div className="full-name">
              <div className='name-label input-group'>
                <label htmlFor="name-label">*姓(カタカナ)</label>
                <input type="text" name="first-name" id="first-name" placeholder="ヒガ"
                  lang='ja' autoCapitalize='none' autoCorrect='off' onChange={(e) => setText(toKatakana(e.target.value))}
                  required />
              </div>
              <div className='name-label input-group'>
                <label htmlFor="first-name">*名(カタカナ)</label>
                <input type="text" name="last-name" id="last-name" placeholder="タロウ" required />
              </div>
              <div className='input-group'>
                <label htmlFor="email">*メールアドレス</label>
                <input type="email" name="email" id="email" placeholder='必須' required />
              </div>
              <div className='input-group'>
                <label htmlFor="tel">*お電話番号</label>
                <input type="tel" name="tel" id="tel" placeholder='ハイフン不要' required />
              </div>
            </div>
          </div>

          <div className="date-information">
            <label htmlFor="date" className='title-information'>*受取日時
               {/* / その他 */}
               </label>
            <div className='input-group'>
              <label htmlFor="datepicker" className='datepicker'>*受け取り希望日</label>
              <DatePicker
                selected={selectedDate}
                onChange={(date) => setSelectedDate(date)}
                minDate={today}
                maxDate={maxDate}
                excludeDates={excludedDates}
                filterDate={isDateAllowed}
                dateFormat="yyyy年MM月dd日"
                locale={ja}
                placeholderText="日付を選択"
                dayClassName={(date) => {
                  if (isSameDay(date, today)) return "hoje-azul";
                  if (getDay(date) === 0) return "domingo-vermelho";
                  return "";
                }}
                className="react-datepicker"
                calendarClassName="datepicker-calendar"
                calendarContainer={MyContainer}
                required
                renderDayContents={renderDayContents}
              />
            </div>
            <div className='input-group'>
              <Select<TimeOptionType>
                options={timeSlots}
                value={timeSlots.find(h => h.value === pickupHour)}
                onChange={(selected) => setPickupHour(selected?.value || "時間を選択")}
                classNamePrefix="react-select"
                styles={customStylesHour}
                placeholder="時間を選択"
                isSearchable={false}
                required
              />
              <label htmlFor="pickupHour" className='select-group'>受け取り希望時間</label>
            </div>
            <div className='input-group' style={{display: 'none'}}>
              <label htmlFor="message">その他</label>
              <textarea name="message" id="message" placeholder=""></textarea>
            </div>
          </div>

          <div className='btn-div'>
            <button type='submit' className='send btn' disabled={isSubmitting}>
              {isSubmitting ? "送信中..." : "送信"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
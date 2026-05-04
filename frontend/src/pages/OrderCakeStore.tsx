import { useState, useEffect, useMemo } from 'react';
import Select, { type StylesConfig, type GroupBase } from 'react-select';
import DatePicker, { CalendarContainer } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ja } from 'date-fns/locale';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, isSameDay, format, endOfMonth, getDay } from 'date-fns';

import type { Cake, OrderCake, OptionType, MyContainerProps, SizeOption, TimeOptionType, TimeslotSQL } from "../types/types.ts";
import "./OrderCake.css";

const API_URL = import.meta.env.VITE_API_URL;
const FOLDER_URL = import.meta.env.VITE_FOLDER_URL;

type CustomOptionType = OptionType & {
  isDisabled?: boolean;
};

export default function OrderCake() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [cakesData, setCakesData] = useState<Cake[]>([]);
  const [cakes, setCakes] = useState<OrderCake[]>([
    { cake_id: 0, name: "", amount: 1, size: "", price: 1, message_cake: "", fruit_option: "無し" }
  ]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeSlotsData, setTimeSlotsData] = useState<TimeslotSQL[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [hoursOptions, setHoursOptions] = useState<TimeOptionType[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickupHour, setPickupHour] = useState("時間を選択");
  const [, setText] = useState("");

  // Datas e calendário
  const today = new Date();
  const diasABloquear = 2;
  const maxDate = endOfMonth(addDays(today, 30));

  const [, setFruitOption] = useState<"有り" | "無し">("無し");

  // 🔹 CARREGAR BOLOS
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

  // 🔹 CARREGAR DATAS E HORÁRIOS DISPONÍVEIS DO BANCO
useEffect(() => {
  fetch(`${API_URL}/api/timeslots/`)
    .then(res => res.json())
    .then((data) => {
      if (data.success && Array.isArray(data.timeslots)) {
        setTimeSlotsData(data.timeslots);
        
        // Extrair datas únicas que têm horários disponíveis
        const uniqueDates = [...new Set(
          data.timeslots.map((slot: TimeslotSQL) => {
            const d = slot.date;
            return d.includes('T') ? d.split('T')[0] : d.split(' ')[0];
          })
        )] as string[];
        
        setAvailableDates(uniqueDates);
        // console.log('📅 Datas disponíveis com horários:', uniqueDates);
        // console.log('⏰ Horários carregados:', data.timeslots.length);
      } else {
        console.error("Formato inesperado de timeslots:", data);
        setTimeSlotsData([]);
        setAvailableDates([]);
      }
    })
    .catch(err => {
      console.error("Erro ao carregar datas:", err);
      setTimeSlotsData([]);
      setAvailableDates([]);
    });
}, []);
  // 🔹 GERAR DATAS BLOQUEADAS (apenas os próximos X dias)
  const excludedDates = useMemo(() => {
    const blockedDates: Date[] = [];
    for (let i = 0; i < diasABloquear; i++) {
      blockedDates.push(addDays(today, i));
    }
    return blockedDates;
  }, [today, diasABloquear]);

  // 🔹 CALCULAR DATAS PERMITIDAS PELOS BOLOS (CUSTOM DATES)
  const includedDatesFromCakes = useMemo(() => {
    if (!cakesData || cakesData.length === 0) return undefined;
    
    let intersection: Date[] | undefined = undefined;
    let hasCustomCake = false;

    cakes.forEach(item => {
      const cakeData = cakesData.find(c => c.id === item.cake_id);
      if (cakeData && cakeData.date_mode === 'custom') {
        hasCustomCake = true;
        const customDates = JSON.parse(cakeData.custom_dates || '[]').map((d: string) => {
          const [y, m, day] = d.split('-').map(Number);
          return new Date(y, m - 1, day);
        });
        
        if (intersection === undefined) {
          intersection = customDates;
        } else {
          intersection = intersection.filter(d1 => 
            customDates.some((d2: Date) => isSameDay(d1, d2))
          );
        }
      }
    });

    return hasCustomCake ? (intersection || []) : undefined;
  }, [cakes, cakesData]);

  // 🔹 FUNÇÃO PARA VERIFICAR DATAS DISPONÍVEIS
  const isDateAllowed = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // 0. Verificar se a data é permitida pelos bolos customizados (se houver algum bolo com data customizada)
    if (includedDatesFromCakes) {
      if (!includedDatesFromCakes.some(d => isSameDay(d, date))) {
        console.log(`🚫 Data ${dateStr} rejeitada: Não está nas datas customizadas do bolo`);
        return false;
      }
    } else {
      // Se não for customizado, verificar bloqueio padrão (preparação)
      if (excludedDates.some(blockedDate => isSameDay(blockedDate, date))) {
        console.log(`🚫 Data ${dateStr} rejeitada: Período de preparação`);
        return false;
      }
    }

    // 1. Verificar se a data é anterior à data atual
    if (date < new Date(new Date().setHours(0,0,0,0))) {
      console.log(`🚫 Data ${dateStr} rejeitada: Data passada`);
      return false;
    }
    
    // 2. Verificar se a data tem horários disponíveis no banco
    if (!availableDates.includes(dateStr)) {
      console.log(`❌ Data ${dateStr} rejeitada: Sem horários disponíveis no banco (availableDates)`);
      return false;
    }
    
    console.log(`✅ Data ${dateStr} permitida`);
    return true;
  };

  // 🔹 ATUALIZAR HORÁRIOS QUANDO A DATA MUDAR
  useEffect(() => {
    if (!selectedDate) {
      setHoursOptions([]);
      setPickupHour("時間を選択");
      return;
    }

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    // console.log('📅 Buscando horários para:', formattedDate);

    // Filtrar horários disponíveis para a data selecionada
    const availableSlots = timeSlotsData.filter((slot: TimeslotSQL) => {
      const d = slot.date;
      const slotDate = d.includes('T') ? d.split('T')[0] : d.split(' ')[0];
      return slotDate === formattedDate;
    });

    // console.log('⏰ Horários disponíveis:', availableSlots);

    // Converter para options do Select
    const options: TimeOptionType[] = availableSlots.map((slot: TimeslotSQL) => ({
      id: slot.id,
      value: slot.time,
      label: `${slot.time}`,
      isDisabled: false // Todos já são disponíveis
    }));

    setHoursOptions(options);

    // Resetar o horário selecionado se não estiver mais disponível
    if (pickupHour !== "時間を選択" && !options.find(opt => opt.value === pickupHour)) {
      setPickupHour("時間を選択");
    }
  }, [selectedDate, timeSlotsData, pickupHour]);

  const selectedCakeName = searchParams.get("cake");
  useEffect(() => {
    if (!cakesData || cakesData.length === 0) return;

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

  const renderDayContents = (day: number, date: Date) => {
    const isSelectable = isDateAllowed(date);
    const dayOfWeek = getDay(date);
    
    const extraClass =
      dayOfWeek === 0 ? "domingo-vermelho" :
      dayOfWeek === 6 ? "sabado-azul" : "";

    return (
      <div className={`day-cell ${extraClass}`}>
        <span>{day}</span>
        {!isSelectable && <span className="yassumi">x</span>}
        {isSelectable && <div className="selectable"></div>}
      </div>
    );
  };

  const customStylesHour: StylesConfig<TimeOptionType, false> = {
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? '#fdd111' : state.isFocused ? '#fdeca2' : 'white',
      color: '#333',
      cursor: 'pointer',
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
      status: 'c',
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
                    <img className='img-cake-order' src={`${API_URL}/image/${FOLDER_URL}/${selectedCakeData.image}`} alt={selectedCakeData.name} />
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
                          name={`fruit-option-${index}`}  
                          value="無し"
                          checked={item.fruit_option === "無し"}
                          onChange={() => updateCake(index, "fruit_option", "無し")}
                        />
                        <span style={{width:"120px", textAlign: "start"}}>通常盛り</span><span style={{width:"5rem", textAlign: "end"}}>+0円</span> 
                      </label>
                      <label className={`pill ${item.fruit_option === "有り" ? "active" : ""}`}>
                        <input
                          type="radio"
                          name={`fruit-option-${index}`} 
                          value="有り"
                          checked={item.fruit_option === "有り"}
                          onChange={() => updateCake(index, "fruit_option", "有り")}
                        />
                        <span style={{width:"125px", textAlign: "start"}}>フルーツ増し</span><span style={{width:"5rem", textAlign: "end"}}>+648円</span>      
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
            <label htmlFor="date" className='title-information'>*受取日時</label>
            <div className='input-group'>
              <label htmlFor="datepicker" className='datepicker'>*受け取り希望日</label>
               <DatePicker
                selected={selectedDate}
                onChange={(date) => setSelectedDate(date)}
                minDate={today}
                maxDate={maxDate}
                excludeDates={!includedDatesFromCakes ? excludedDates : undefined}
                includeDates={includedDatesFromCakes}
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
                options={hoursOptions}
                value={hoursOptions.find(h => h.value === pickupHour)}
                onChange={(selected) => setPickupHour(selected?.value || "時間を選択")}
                classNamePrefix="react-select"
                styles={customStylesHour}
                placeholder={selectedDate ? "時間を選択" : "日付を選択してください"}
                isSearchable={false}
                isDisabled={!selectedDate || hoursOptions.length === 0}
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
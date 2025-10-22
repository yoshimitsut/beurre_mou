import { useState, useEffect } from 'react';
import Select, { type StylesConfig, type GroupBase } from 'react-select';
import DatePicker, { CalendarContainer } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ja } from 'date-fns/locale';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, isAfter, isSameDay, format } from 'date-fns';
// import TimeSelect from "./TimeSelect"; 

import type { Cake, OrderCake, OptionType, MyContainerProps, TimeslotSQL, SizeOption } from "../types/types.ts";
import "./OrderCake.css";

const API_URL = import.meta.env.VITE_API_URL;

type CustomOptionType = OptionType & {
  isDisabled?: boolean;
};

type TimeOptionType = OptionType & {
  isDisabled?: boolean;
};

export default function OrderCake() {
  const navigate = useNavigate();

  const [cakesData, setCakesData] = useState<Cake[]>();
  const [cakes, setCakes] = useState<OrderCake[]>([
    { cake_id: 0, name: "", amount: 1, size: "", price: 1, message_cake: "" }
  ]);

  const isDateAllowed = (date: Date) => !excludedDates.some((d) => isSameDay(d, date));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hoursOptions, setHoursOptions] = useState<TimeOptionType[]>([]);

  // Efeito para carregar os dados dos bolos apenas uma vez
  useEffect(() => {
  fetch(`${API_URL}/api/cake`) // ou o endpoint correto do seu backend
    .then(res => res.json())
    .then(data => {
      // console.log("Resposta da API:", data);
      
      // ✅ Aqui acessa o campo "cakes"
      if (Array.isArray(data.cakes)) {
        setCakesData(data.cakes);
      } else {
        console.error("Formato inesperado:", data);
      }
    })
    .catch(err => console.error("Erro ao carregar bolos:", err));
}, []);

  const [timeSlotsData, setTimeSlotsData] = useState<TimeslotSQL[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/timeslots`)
      .then(res => res.json())
      .then((data) => {
        // Verifica se existe 'timeslots' e é array
        if (Array.isArray(data.timeslots)) {
          setTimeSlotsData(data.timeslots);
        } else {
          console.error("Formato inesperado de timeslots:", data);
          setTimeSlotsData([]);
        }

        // opcional — salvar as datas permitidas
        // if (Array.isArray(data.availableDates)) {
        //   const dates = data.availableDates.map(d => new Date(d));
        //   setAllowedDates(dates);
        // }
      })
      .catch(err => console.error("Erro ao carregar datas:", err));
  }, []);



      
  useEffect(() => {
  if (!selectedDate) return;

  // Usar a mesma função de formatação
  const formatDateForBackend = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formattedDate = formatDateForBackend(selectedDate);

  // console.log('Buscando horários para:', formattedDate);

  const daySlots = timeSlotsData.filter(slot => {
    // Slot.date pode vir como "2025-12-25" ou "2025-12-25T00:00:00.000Z"
    const slotDateStr = slot.date.split("T")[0];
    return slotDateStr === formattedDate;
  });

  const options = daySlots.map(slot => ({
    value: slot.time,
    label: slot.time,
    stock: slot.limit_slots,
    isDisabled: slot.limit_slots <= 0
  }));

  // console.log('Horários encontrados:', options);
  setHoursOptions(options);
}, [selectedDate, timeSlotsData]);



  const [searchParams] = useSearchParams();
  const selectedCakeName = searchParams.get("cake");

  useEffect(() => {
    if (!cakesData) return;

    if (selectedCakeName) {
      // procura pelo bolo que corresponde ao nome ou id
      const selectedCake = cakesData.find(c => String(c.id) === selectedCakeName || c.name === selectedCakeName);
      if (selectedCake) {
        setCakes([{
          cake_id: selectedCake.id,
          name: selectedCake.name,
          amount: 1,
          size: "",
          price: 1, //VERIFICAR
          message_cake: ""
        }]);
      }
    }
  }, [cakesData, selectedCakeName]);


  const MyContainer = ({ className, children }: MyContainerProps) => {
    return (
      <div>
        <CalendarContainer className={className}>{children}</CalendarContainer>
        <div className='calendar-notice'>
          {/* <div style={{ padding: "20px" }}>
              <p>３日前よりご予約可能（２週間後まで）</p>
            </div> */}
          <div className='notice'>
            <div className='selectable'></div>
            <span>予約可能日  /  <span className='yassumi'>x</span> 予約不可</span>
          </div>
        </div>
      </div>
    );
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const getOrderedAmount = (cakeId: number) => {
    return cakes.reduce((total, c) => (c.id === cakeId ? total + c.amount : total), 0)
  };

  const cakeOptions: CustomOptionType[] = cakesData?.map(c => {
    const totalStock = c.sizes?.reduce((sum, s) => sum + (s.stock || 0), 0)
    const orderedAmount = getOrderedAmount(c.id);
    const isSoldOut = totalStock <= 0 || (orderedAmount > 0 && orderedAmount >= totalStock);
    // console.log("cakesData:", cakesData);

    return {
      value: String(c.id),
      label: c.name,
      image: c.image,
      stock: totalStock,
      isDisabled: isSoldOut,
    };
  }) || [];


  const getQuantityOptions = (cake: Cake | undefined, size: SizeOption | undefined, index: number): OptionType[] => {
    if (!cake || !size) return [];

    const used = cakes.reduce((acc, c, i) => {
      if (i !== index && c.id === cake.id && c.size === size.size) {
        return acc + c.amount;
      }
      return acc;
    }, 0);

    const remaining = Math.max(0, size.stock - used);
    const limit = Math.min(10, remaining);

    return Array.from({ length: limit }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
      stock: size.stock
    }));
  };

  // Função para calcular o estoque restante de cada tamanho
  const getSizeOptionsWithStock = (cake: Cake, index: number): SizeOption[] => {
    return cake.sizes.map(s => {
      // Soma quantos já foram selecionados nas instâncias anteriores do mesmo bolo e tamanho
      const used = cakes.reduce((acc, c, i) => {
        if (i !== index && c.id === cake.id && c.size === s.size) {
          return acc + c.amount;
        }
        return acc;
      }, 0);

      const remainingStock = Math.max(0, s.stock - used);

      return {
        ...s,
        isDisabled: remainingStock <= 0,
        label: remainingStock > 0
          ? `${s.size} ￥${s.price.toLocaleString()} `
          : `${s.size} ￥${s.price.toLocaleString()} （完売）`
      };
    });
  };


  const addCake = () => {
    setCakes(prev => [
      ...prev,
      {
        cake_id: 0,
        name: "",
        amount: 1,
        size: "",
        price: 1,
        message_cake: ""
      }
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
        i === index ? { ...item, [field]: value } : item,
    // console.log(prev)
  )
    );
  };

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
  };

  const [pickupHour, setPickupHour] = useState("時間を選択");

  const today = new Date();
  const blockDay = 3;
  const daysOff = [
    { day: 12, month: 7 },
    { day: 21, month: 8 },
  ];

  const allowedDates = [
    // new Date(today.getFullYear(), 11, 21),
    // new Date(today.getFullYear(), 11, 22),
    // new Date(today.getFullYear(), 11, 23),
    new Date(today.getFullYear(), 11, 24),
    new Date(today.getFullYear(), 11, 25),
  ];

  const generateSpecificDatesWithMonth = () => {
    const dates: Date[] = [];
    daysOff.forEach(({ day, month }) => {
      const newDate = new Date(today.getFullYear(), month, day);
      if (isAfter(newDate, today)) {
        dates.push(newDate);
      }
    });
    return dates;
  };

  const generateBlockedDaysStart = () => {
    const dates: Date[] = [];
    let date = today;
    const fixedDates = new Set(
      generateSpecificDatesWithMonth().map(d => d.toDateString())
    );
    while (dates.length < blockDay) {
      const isBlockedforAFixedDate = fixedDates.has(date.toDateString());
      const alreadBlocked = dates.some(d => isSameDay(d, date));
      if (!isBlockedforAFixedDate && !alreadBlocked) {
        dates.push(date);
      }
      date = addDays(date, 1);
    }
    return dates;
  };

  const excludedDates = [
    ...generateBlockedDaysStart(),
    ...generateSpecificDatesWithMonth(),
  ];


  const customStyles: StylesConfig<OptionType, false, GroupBase<OptionType>> = {
      option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? '#fdd111' // fundo da opção selecionada (ex: bege claro)
        : state.isFocused
        ? '#fdeca2' // cor no hover (ex: rosa claro)
        : 'white',  // fundo normal
      color: state.isDisabled ? '#999' : '#333', // cor do texto
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    }),

    control: (provided, state) => ({
      ...provided,
      borderColor: state.isFocused ? '#fdeca2' : '#ddd',
      boxShadow: state.isFocused ? '0 0 0 1px #fdeca2' : 'none',
      '&:hover': {
        borderColor: '#fdeca2',
      },
    }),

    singleValue: (provided) => ({
      ...provided,
      color: '#333', // texto da opção selecionada
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
      backgroundColor: state.isSelected
        ? '#fdd111' // fundo da opção selecionada (ex: bege claro)
        : state.isFocused
        ? '#fdeca2' // cor no hover (ex: rosa claro)
        : 'white',  // fundo normal
      color: state.isDisabled ? '#999' : '#333', // cor do texto
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    }),

    control: (provided, state) => ({
      ...provided,
      borderColor: state.isFocused ? '#fdeca2' : '#ddd',
      boxShadow: state.isFocused ? '0 0 0 1px #fdeca2' : 'none',
      '&:hover': {
        borderColor: '#fdeca2',
      },
    }),

    singleValue: (provided) => ({
      ...provided,
      color: '#333', // texto da opção selecionada
      borderRadius: '4px',
      padding: '2px 6px',
    }),

    menu: (provided) => ({
      ...provided,
      zIndex: 9999,
    }),
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.blur();
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
          message_cake: c.message_cake || ""
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
            message_cake: ""
          }]);
        }
        setSelectedDate(null);
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

  const [, setText] = useState("");
  function toKatakana(str: string) {
    return str.replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  }

  return (
    <div className='reservation-main'>
      <div className="container">
        <h2>クリスマスケーキ予約フォーム</h2>

        <form className="form-order" onSubmit={handleSubmit}>
          
          <div className="cake-information">
            {cakes.map((item, index) => {
              const selectedCakeData = cakesData?.find(
                c => c.id === item.cake_id
              );

              const sizeOptions: SizeOption[] =
                selectedCakeData?.sizes
                  // .filter(s => s.stock > 0)
                  .map(s => ({
                    ...s,
                    value: s.size,
                    label: s.stock > 0
                      ? `${s.size} ￥${s.price.toLocaleString()} `
                      : `${s.size} ￥${s.price.toLocaleString()} （完売）`,
                    isDisabled: s.stock <= 0
                  })) || [];

              const selectedSize = sizeOptions.find(s => s.size === item.size);

              return (
                <div className="box-cake" key={`${item.id}-${index}`} >
                  {index > 0 && (
                    <div className='btn-remove-div'>
                      <button
                        type="button"
                        onClick={() => removeCake(index)}
                        className='btn-remove-cake'
                      >
                        ❌
                      </button>
                    </div>
                  )}
                  {selectedCakeData && (
                    <img
                      className='img-cake-order'
                      src={`image/${selectedCakeData.image}`}
                      alt={selectedCakeData.name}
                    />
                  )}
                  <div className='input-group'>
                    <Select<CustomOptionType>
                      options={cakeOptions}
                      value={cakeOptions.find(c => Number(c.value) === item.cake_id) }
                       onChange={selected => {
                        if (selected) {
                          const newCakeId = Number(selected.value);
                          const selectedCake = cakesData?.find(c => c.id === newCakeId);
                          
                          updateCake(index, "cake_id", newCakeId);
                          updateCake(index, "size", "");
                          updateCake(index, "price", 0);
                          
                          // Se o bolo tem apenas 1 tamanho, seleciona automaticamente
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
                      formatOptionLabel={(option, { context }) => {
                        const isSelected = Number(option.value) === item.cake_id;
                        if (context === 'menu' && option.isDisabled && !isSelected) {
                          return <div style={{ color: '#888' }}>{option.label} （完売）</div>;
                        }
                        return option.label;
                      }}
                    />
                    <label className='select-group'>*ケーキ名:</label>
                  </div>
                  {selectedCakeData && (
                    <div className='input-group'>
                      <Select<SizeOption>
                        options={getSizeOptionsWithStock(selectedCakeData, index)} // opções já com stock atualizado
                        value={getSizeOptionsWithStock(selectedCakeData, index).find(s => s.size === item.size) || null}
                        onChange={(selected) => {
                          if (selected) {
                            setCakes(prev =>
                              prev.map((c, i) =>
                                i === index ? { ...c, size: selected.size, price: selected.price } : c
                              )
                            );
                          }
                        }}
                        placeholder='サイズを選択'
                        isSearchable={false}
                        classNamePrefix='react-select'
                        required
                        styles={customStylesSize}
                        isOptionDisabled={(option) => !!option.isDisabled}
                        formatOptionLabel={(option) => {
                          return option.stock > 0
                            ? <p>{option.size} ￥{option.price.toLocaleString("ja-JP")}<span style={{ fontSize: '1rem' }}>（税込）</span></p>
                            : <p>{option.size} ￥{option.price.toLocaleString("ja-JP")}<span style={{ color: 'red', fontSize: '0.8rem' }}>（完売）</span></p>;
                        }}
                      />
                      <label className='select-group'>*ケーキのサイズ</label>
                    </div>
                  )}


                  <div className='input-group'>
                    <Select<OptionType>
                      options={getQuantityOptions(selectedCakeData, selectedSize, index)}
                      value={getQuantityOptions(selectedCakeData, selectedSize, index).find(
                        q => q.value === String(item.amount)
                      )}
                      isSearchable={false}
                      onChange={selected =>
                        updateCake(index, "amount", selected ? Number(selected.value) : 0)
                      }
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
            }
            )}
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
            <label htmlFor="date" className='title-information'>*受取日時 / その他</label>
            {/* <span className='notification'>受取日は休業日を除いた３日以降より可能</span> */}
            <div className='input-group'>
              <label htmlFor="datepicker" className='datepicker'>*受け取り希望日</label>
              <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                includeDates={allowedDates}
                filterDate={isDateAllowed}
                minDate={allowedDates[0]}
                maxDate={allowedDates[allowedDates.length - 1]}
                openToDate={allowedDates[0]}
                dateFormat="yyyy年MM月dd日"
                placeholderText="日付を選択"
                className="react-datepicker"
                locale={ja}
                calendarClassName="datepicker-calendar"
                calendarContainer={MyContainer}
                onFocus={handleFocus}
                required
                renderDayContents={(day, date) => {
                  const dayOfWeek = date.getDay();
                  const isAvailable = allowedDates.some(d => isSameDay(d, date));
                  const isFuture = isAfter(date, today);
                  const isHoliday = !isAvailable;
                  const extraClass =
                    dayOfWeek === 0 ? "domingo-vermelho" :
                      dayOfWeek === 6 ? "sabado-azul" : "";
                  return (
                    <div className={`day-cell ${extraClass}`}>
                      <span>{day}</span>
                      {isAvailable && isFuture && <div className="selectable"></div>}
                      {isHoliday && <span className="yassumi">x</span>}
                    </div>
                  );
                }}
              />
            </div>
            <div className='input-group'>
              <Select<TimeOptionType>
                // inputId="pickupHour"
                options={hoursOptions}
                value={hoursOptions.find(h => h.value === pickupHour)}
                onChange={(selected) => setPickupHour(selected?.value || "時間を選択")}
                classNamePrefix="react-select"
                styles={customStyles}
                placeholder="時間を選択"
                isSearchable={false}
                required
                formatOptionLabel={(option, { context }) => {
                  if (context === 'menu' && option.isDisabled) {
                    return <p>{option.label} <span style={{ color: 'red', fontSize: '0.8rem' }}>（完売）</span></p>;
                  }
                  return option.label;
                }}
              />
              <label htmlFor="pickupHour" className='select-group'>受け取り希望時間</label>
            </div>
            <div className='input-group'>
              <label htmlFor="message">その他</label>
              <textarea name="message" id="message" placeholder=""></textarea>
            </div>
          </div>
          <div className='btn-div'>
            <button type='submit' className='send btn'
              disabled={isSubmitting}
            >
              {isSubmitting ? "送信中..." : "送信"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import './TimeSlotsManagement.css';
import "react-datepicker/dist/react-datepicker.css";

// import Header from '../components/Header';
// import { useHeaderConfig } from '../hooks/useHeaderConfig'; 


import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths,
  subMonths,
  getDay,
  subDays,
  addDays
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

// ----------------------------------------------------
// FUNÇÕES DE DATA
// ----------------------------------------------------

const getJSTDate = (): Date => {
  const now = new Date();
  const jstString = new Date(now.getTime() + (9 * 60 * 60 * 1000)).toISOString().replace('Z', '+09:00');
  return new Date(jstString);
};

const formatDateJST = (date: Date): string => {
  const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  return jstDate.toISOString().split('T')[0];
};

// ----------------------------------------------------
// TIPOS E VARIÁVEIS
// ----------------------------------------------------

interface TimeslotBatchCreatorProps {
  onTimeslotsCreated?: () => void;
}

interface ApiResponse {
  success: boolean;
  inserted: number;
  skipped: number;
  error?: string;
}

interface TimeSlot {
  id: number;
  time_value: string;
}

interface DayTimeSlot {
  id: number;
  date: string;
  time: string;
  limit_slots: number;
}

interface DaySchedule {
  date: string;
  selectedTimes: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL+'/api/timeslots';

type TabType = 'times' | 'days';

// ----------------------------------------------------
// COMPONENTE PRINCIPAL
// ----------------------------------------------------

const TimeslotBatchCreator: React.FC<TimeslotBatchCreatorProps> = ({ onTimeslotsCreated }) => {
  const jstToday = getJSTDate();
  const [selectedDate, setSelectedDate] = useState<string>(formatDateJST(jstToday));
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [existingDayTimeSlots, setExistingDayTimeSlots] = useState<DayTimeSlot[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('days');
  const [currentMonth, setCurrentMonth] = useState(jstToday);
  
  const [monthSchedule, setMonthSchedule] = useState<DaySchedule[]>([]);

  // Estados de UI e Feedback
  const [newTime, setNewTime] = useState<string>('');
  const [isAddingTime, setIsAddingTime] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingTimes, setIsLoadingTimes] = useState<boolean>(true);
  const [isLoadingExisting, setIsLoadingExisting] = useState<boolean>(false);

  // const { headerConfig } = useHeaderConfig({
  //   buttons: [
  //     { 
  //       icon: "/icons/calendar_icon.ico", 
  //       alt: "カレンダーアイコン",
  //       path: "/admin/date",
  //       className: "list-btn qrcode-btn"
  //     },
  //     { 
  //       icon: "/icons/graph.ico", 
  //       alt: "グラフアイコン",
  //       path: "/ordertable",
  //       className: "list-btn"
  //     }
  //   ]
  // });


  // 🔥 FUNÇÃO CORRIGIDA: Gerar dias do calendário com preenchimento
  const generateCalendarDays = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    // Dias do mês atual
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Dias do mês anterior para preencher o início
    const startDayOfWeek = getDay(monthStart); // 0 = Domingo, 1 = Segunda, etc.
    const daysFromPrevMonth = startDayOfWeek; // Número de dias do mês anterior para mostrar
    
    const prevMonthEnd = endOfMonth(subMonths(month, 1));
    const prevMonthDays = eachDayOfInterval({
      start: subDays(prevMonthEnd, daysFromPrevMonth - 1),
      end: prevMonthEnd
    }).slice(-daysFromPrevMonth || 0);

    // Dias do próximo mês para completar (6 semanas no total)
    const totalCells = 42; // 6 semanas * 7 dias
    const nextMonthStart = startOfMonth(addMonths(month, 1));
    const remainingDays = totalCells - (prevMonthDays.length + monthDays.length);
    const nextMonthDays = eachDayOfInterval({
      start: nextMonthStart,
      end: addDays(nextMonthStart, Math.max(0, remainingDays - 1))
    });

    return [
      ...prevMonthDays.map(day => ({ 
        date: day, 
        isCurrentMonth: false, 
        isOtherMonth: true 
      })),
      ...monthDays.map(day => ({ 
        date: day, 
        isCurrentMonth: true, 
        isOtherMonth: false 
      })),
      ...nextMonthDays.map(day => ({ 
        date: day, 
        isCurrentMonth: false, 
        isOtherMonth: true 
      }))
    ];
  };

  // Calendário
  const calendarDays = generateCalendarDays(currentMonth);

  // 🔥 CORRIGIR: Funções de navegação do mês
  const nextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  // 🔥 SIMPLIFICAR: Função para inicializar o schedule
  const initializeMonthSchedule = (month: Date = currentMonth) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const allTimeValues = timeSlots.map(slot => slot.time_value);
    
    const newSchedule: DaySchedule[] = days.map(day => ({
      date: formatDateJST(day),
      selectedTimes: [...allTimeValues] // Todos os horários selecionados por padrão
    }));
    
    setMonthSchedule(newSchedule);
  };

  // Função para selecionar data
  const handleDateSelect = (date: Date) => {
    const dateKey = formatDateJST(date);
    setSelectedDate(dateKey);
  };

  // Função para verificar se a data está selecionada
  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    return formatDateJST(date) === selectedDate;
  };

  // Função para verificar se é hoje
  const isToday = (date: Date) => {
    return formatDateJST(date) === formatDateJST(jstToday);
  };

  // 🔥 FUNÇÃO: Obter horários selecionados para a data atual
  const getSelectedTimesForDate = (date: string): string[] => {
    const daySchedule = monthSchedule.find(day => day.date === date);
    return daySchedule ? daySchedule.selectedTimes : [];
  };

  // 🔥 FUNÇÃO: Atualizar horários para uma data específica
  const updateSelectedTimesForDate = (date: string, times: string[]) => {
    setMonthSchedule(prev => 
      prev.map(day => 
        day.date === date ? { ...day, selectedTimes: times } : day
      )
    );
  };

  // ----------------------------------------------------
  // MANIPULADORES DE TEMPO
  // ----------------------------------------------------

  const handleSelectAllTimes = (): void => {
    const allTimes = timeSlots.map(slot => slot.time_value);
    updateSelectedTimesForDate(selectedDate, allTimes);
  }

  const handleDeselectAllTimes = (): void => {
    updateSelectedTimesForDate(selectedDate, []);
  }

  const handleTimeToggle = (time: string): void => {
    const currentTimes = getSelectedTimesForDate(selectedDate);
    const newTimes = currentTimes.includes(time) 
      ? currentTimes.filter(t => t !== time)
      : [...currentTimes, time].sort();
    
    updateSelectedTimesForDate(selectedDate, newTimes);
  };

  // Aplicar a mesma configuração a todos os dias do mês
  const handleDeselectAllDays = (): void => {
    setMonthSchedule(prev => 
      prev.map(day => ({ ...day, selectedTimes: [] }))
    );
    setStatusMessage('すべての日の時間帯を解除しました。');
    setIsError(false);
  };

  // Resetar todos os dias para todos os horários selecionados
  const handleResetAllDays = (): void => {
    const allTimes = timeSlots.map(slot => slot.time_value);
    setMonthSchedule(prev => 
      prev.map(day => ({ ...day, selectedTimes: [...allTimes] }))
    );
    setStatusMessage('すべての日をリセットしました（すべての時間帯を選択）。');
    setIsError(false);
  };

  // ----------------------------------------------------
  // FUNÇÕES PARA SALVAMENTO
  // ----------------------------------------------------

  // Função auxiliar para deletar um slot de tempo
const deleteTimeSlot = async (slotId: number): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/${slotId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data?.success || false;
  } catch (error) {
    console.error('削除エラー:', error);
    return false;
  }
};

  // 🔥 SIMPLIFICAR: Função para carregar dados existentes
const loadExistingData = async () => {
  try {
    setIsLoadingExisting(true);
    const response = await fetch(`${API_BASE_URL}/`);
    const data = await response.json();
    
    console.log('Dados carregados da API:', data);
    
    if (data.success && data.timeslots) {
      setExistingDayTimeSlots(data.timeslots);
      
      const currentMonthString = format(currentMonth, 'yyyy-MM');
      const currentMonthSlots = data.timeslots.filter((slot: DayTimeSlot) => 
        slot.date.startsWith(currentMonthString)
      );

      console.log(`Slots do mês atual (${currentMonthString}):`, currentMonthSlots.length);

      // Se há dados para o mês atual, sincronizar
      if (currentMonthSlots.length > 0) {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        
        const newSchedule: DaySchedule[] = monthDays.map(day => {
          const dayDate = formatDateJST(day);
          const existingTimesForDay = data.timeslots
            .filter((slot: DayTimeSlot) => slot.date === dayDate)
            .map((slot: DayTimeSlot) => slot.time);
          
          console.log(`Data ${dayDate}: ${existingTimesForDay.length} horários existentes`);
          
          return {
            date: dayDate,
            selectedTimes: existingTimesForDay
          };
        });
        
        setMonthSchedule(newSchedule);
        console.log('Schedule sincronizado com dados existentes');
      } else {
        // Se não há dados, inicializar com padrão
        console.log('Nenhum dado existente, inicializando com padrão');
        initializeMonthSchedule();
      }
    } else {
      // Se não há timeslots, inicializar com padrão
      console.log('Resposta sem timeslots, inicializando com padrão');
      initializeMonthSchedule();
    }
  } catch (error) {
    console.error('既存データ読み込みエラー:', error);
    // Em caso de erro, inicializar com padrão
    initializeMonthSchedule();
  } finally {
    setIsLoadingExisting(false);
  }
};

  // Salvar todos os dias do mês
const handleSaveAllMonth = async (e: React.FormEvent): Promise<void> => {
  e.preventDefault();
  setStatusMessage(null);
  setIsError(false);
  setIsLoading(true);

  try {
    let totalInserted = 0;
    let totalDeleted = 0;

    // 1. Primeiro deletar TODOS os slots existentes do mês
    const currentMonthString = format(currentMonth, 'yyyy-MM');
    const slotsToDelete = existingDayTimeSlots.filter(slot => 
      slot.date.startsWith(currentMonthString)
    );

    console.log(`Deletando ${slotsToDelete.length} slots existentes do mês ${currentMonthString}`);

    // Deletar em paralelo para melhor performance
    const deletePromises = slotsToDelete.map(slot => deleteTimeSlot(slot.id));
    const deleteResults = await Promise.allSettled(deletePromises);
    
    totalDeleted = deleteResults.filter(result => 
      result.status === 'fulfilled' && result.value === true
    ).length;

    console.log(`${totalDeleted} slots deletados com sucesso`);

    // 2. Aguardar um pouco para garantir que as deleções foram processadas
    await new Promise(resolve => setTimeout(resolve, 100));

    // 3. Depois adicionar os novos slots baseados no monthSchedule atual
    const timeConfigs = new Map<string, string[]>();
    
    monthSchedule.forEach(day => {
      if (day.selectedTimes.length > 0) {
        const timeKey = day.selectedTimes.join(',');
        if (!timeConfigs.has(timeKey)) {
          timeConfigs.set(timeKey, []);
        }
        timeConfigs.get(timeKey)!.push(day.date);
      }
    });

    console.log(`Configurações únicas a serem enviadas: ${timeConfigs.size}`);

    // Para cada configuração única de horários, enviar em lote
    for (const [timeKey, dates] of timeConfigs) {
      const times = timeKey.split(',');
      
      const payload = {
        dates: dates,
        times: times,
        limit_slots: 10
      };

      console.log(`Enviando lote para datas: ${dates.join(', ')} com horários: ${times.join(', ')}`);

      const response = await fetch(`${API_BASE_URL}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: ApiResponse = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || `日付 ${dates[0]} などの登録に失敗しました。`);
      }

      totalInserted += data.inserted;
      console.log(`Lote inserido: ${data.inserted}, ignorados: ${data.skipped}`);
    }

    // 4. Atualizar a lista de slots existentes
    await loadExistingData();

    // 5. Mensagem de resultado
    let message = `成功！${format(currentMonth, 'yyyy年MM月', { locale: ja })}の時間帯を更新しました。`;
    
    if (totalDeleted > 0) {
      message += ` ${totalDeleted}個の古い時間帯を削除し、`;
    }
    
    if (totalInserted > 0) {
      message += ` ${totalInserted}個の新しい時間帯を追加しました。`;
    } else {
      message += ` すべての時間帯を削除しました。`;
    }

    setStatusMessage(message);
    setIsError(false);

    if (onTimeslotsCreated) {
      onTimeslotsCreated();
    }

  } catch (error) {
    console.error('データ送信エラー:', error);
    setIsError(true);
    setStatusMessage(`エラー: ${error instanceof Error ? error.message : '不明なエラー'}。API接続を確認してください。`);
  } finally {
    setIsLoading(false);
  }
};
  // ----------------------------------------------------
  // FETCHERS E APIS
  // ----------------------------------------------------

  const fetchTimeSlots = async () => {
    try {
      setIsLoadingTimes(true);
      const response = await fetch(`${API_BASE_URL}/times`);
      const data = await response.json();
      if (data.success && data.times) {
        setTimeSlots(data.times);
      } else {
        throw new Error('時間の取得に失敗しました');
      }
    } catch (error) {
      console.error('時間取得エラー:', error);
      setIsError(true);
      setStatusMessage('時間の読み込みに失敗しました。');
    } finally {
      setIsLoadingTimes(false);
    }
  };

  // 🔥 SIMPLIFICAR: useEffect principal
  useEffect(() => {
    if (activeTab === 'days') {
      const loadData = async () => {
        setIsLoadingExisting(true);
        await fetchTimeSlots();
        await loadExistingData();
        setIsLoadingExisting(false);
      };
      loadData();
    }
  }, [activeTab, currentMonth]);

  // Função para adicionar novo tempo
  const handleAddTime = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTime || timeSlots.some(slot => slot.time_value === newTime)) {
      setIsError(true);
      setStatusMessage('有効で重複しない時間を入力してください。');
      return;
    }

    setIsAddingTime(true);

    try {
      const response = await fetch(`${API_BASE_URL}/times`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ time_value: newTime }),
      });

      const data: ApiResponse = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '時間の追加に失敗しました。');
      }

      setStatusMessage(`時間 ${newTime} を追加しました！`);
      setIsError(false);
      setNewTime('');
      
      await fetchTimeSlots();
      
    } catch (error) {
      console.error('時間追加エラー:', error);
      setIsError(true);
      setStatusMessage(`エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsAddingTime(false);
    }
  };

  // Função para deletar um tempo
  const handleDeleteTime = async (timeId: number, timeValue: string) => {
    if (!window.confirm(`時間 ${timeValue} を削除してもよろしいですか？\nこの時間が使用されている日付からも削除されます。`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/times/${timeId}`, {
        method: 'DELETE',
      });

      const data: ApiResponse = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '時間の削除に失敗しました。');
      }

      setStatusMessage(`時間 ${timeValue} を削除しました！`);
      setIsError(false);
      
      await fetchTimeSlots();
      
    } catch (error) {
      console.error('時間削除エラー:', error);
      setIsError(true);
      setStatusMessage(`エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  // Horários selecionados para a data atual
  const currentSelectedTimes = getSelectedTimesForDate(selectedDate);

  const navigate = useNavigate();

  return (
    <>
      {/* <Header {...headerConfig} /> */}
      <div className="timeslot-batch-creator">

        <div className='timeslot-batch-creator-header'>
          <h2 className="timeslot-batch-creator__title">📅 時間帯管理</h2>
          <div className="table-order-actions-header" onClick={() => navigate("/list")}>
            <div className='btn-back'>
              <img src="/icons/btn-back.png" alt="list icon" />
            </div>
          </div>

        </div>
        
        {/* Abas de navegação */}
        <div className="timeslot-batch-creator__tabs">
          <button 
            className={`timeslot-batch-creator__tab ${activeTab === 'days' ? 'timeslot-batch-creator__tab--active' : ''}`}
            onClick={() => setActiveTab('days')}
          >
            📅 月別編集
          </button>
          <button 
            className={`timeslot-batch-creator__tab ${activeTab === 'times' ? 'timeslot-batch-creator__tab--active' : ''}`}
            onClick={() => setActiveTab('times')}
          >
            ⏰ 時間管理
          </button>
        </div>

        {/* Conteúdo das abas */}
        <div className="timeslot-batch-creator__tab-content">
          
          {/* Aba: Gerenciamento de Dias */}
          {activeTab === 'days' && (
            <div className="timeslot-batch-creator__day-management">

              <h3 className="timeslot-batch-creator__subtitle">月別時間帯編集</h3>
              <p>日付を選択して時間帯を編集してください。</p>

              <form onSubmit={handleSaveAllMonth}>
                <div className='timeslot-content'>
                  <div className="timeslot-batch-creator__form-row">
                    <div className="timeslot-batch-creator__form-group">
                      <label htmlFor="date" className="timeslot-batch-creator__label">設定日:</label>
                      <div className='timeslot-batch-selec-all-day'>
                          <button
                            type="button"
                            className="timeslot-batch-creator__bulk-button timeslot-batch-creator__bulk-button--deselect-all"
                            onClick={handleDeselectAllDays}
                          >
                            すべて選択解除
                          </button>
                          <button
                            type="button"
                            className="timeslot-batch-creator__bulk-button timeslot-batch-creator__bulk-button--reset-all"
                            onClick={handleResetAllDays}
                          >
                            すべて選択
                          </button>
                        </div>
                      <div className="month-calendar">
                        <div className="calendar-header">
                          <button type="button" onClick={prevMonth}>‹</button>
                          <h3>{format(currentMonth, 'yyyy年MM月', { locale: ja })}</h3>
                          <button type="button" onClick={nextMonth}>›</button>
                        </div>
                        
                        <div className="calendar-grid">
                          {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                            <div key={day} className="calendar-weekday">{day}</div>
                          ))}
                          
                          {calendarDays.map(({ date, isCurrentMonth }) => {
                            if (!isCurrentMonth) {
                              // Dias de outros meses - mostrar vazios
                              return (
                                <div
                                  key={date.toString()}
                                  className="calendar-day calendar-day--other-month"
                                >
                                  {format(date, 'd')}
                                </div>
                              );
                            }

                            const dayDate = formatDateJST(date);
                            const daySelectedTimes = getSelectedTimesForDate(dayDate);
                            const isFullySelected = daySelectedTimes.length === timeSlots.length;
                            const isPartiallySelected = daySelectedTimes.length > 0 && daySelectedTimes.length < timeSlots.length;
                            
                            return (
                              <button
                                key={date.toString()}
                                type="button"
                                className={`calendar-day ${
                                  isDateSelected(date) ? 'selected' : ''
                                } ${
                                  isToday(date) ? 'today' : ''
                                } ${
                                  isFullySelected ? 'calendar-day--fully-selected' : 
                                  isPartiallySelected ? 'calendar-day--partially-selected' : 
                                  'calendar-day--none-selected'
                                }`}
                                onClick={() => handleDateSelect(date)}
                                title={`${format(date, 'M月d日')} - ${daySelectedTimes.length}個の時間帯が選択中`}
                              >
                                {format(date, 'd')}
                                {isPartiallySelected && <span className="calendar-day-partial-indicator">•</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className='timeslot-add-content'>
                    <div className="timeslot-batch-creator__current-slots">
                      <div>
                        <h4 className="timeslot-batch-creator__subtitle">
                          📋 {selectedDate} の時間帯設定
                        </h4>
                      </div>
                      
                    </div>

                    {/* 時間選択 */}
                    <div className="timeslot-batch-creator__form-group">
                      {isLoadingTimes || isLoadingExisting ? (
                        <div className="timeslot-batch-creator__loading">
                          時間を読み込み中...
                        </div>
                      ) : timeSlots.length === 0 ? (
                        <div className="timeslot-batch-creator__error">
                          時間が見つかりません。まず「時間管理」タブで時間を登録してください。
                        </div>
                      ) : (
                        <>
                          <div className="timeslot-batch-creator__time-grid">
                            {timeSlots.map((timeSlot) => {
                              const isSelected = currentSelectedTimes.includes(timeSlot.time_value);
                              
                              return (
                                <div 
                                  key={timeSlot.id}
                                  className={`timeslot-batch-creator__time-button ${
                                    isSelected ? 'timeslot-batch-creator__time-button--selected' : ''
                                  }`}
                                  onClick={() => handleTimeToggle(timeSlot.time_value)}
                                  title="クリックで選択/解除"
                                >
                                  {timeSlot.time_value}
                                </div>
                              );
                            })}

                            <div className="timeslot-batch-creator__bulk-actions">
                              <div className='timeslot-batch-selec-all'>
                                {/* <div> */}
                                  <button
                                    type="button"
                                    className="timeslot-batch-creator__bulk-button timeslot-batch-creator__bulk-button--select"
                                    onClick={handleSelectAllTimes}
                                    disabled={timeSlots.length === 0 || currentSelectedTimes.length === timeSlots.length}
                                  >
                                    すべて選択
                                  </button>
                                  <button
                                    type="button"
                                    className="timeslot-batch-creator__bulk-button timeslot-batch-creator__bulk-button--deselect"
                                    onClick={handleDeselectAllTimes}
                                    disabled={currentSelectedTimes.length === 0}
                                  >
                                    すべて解除
                                  </button>
                                {/* </div> */}
                              
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <p className="timeslot-batch-creator__help-text">
                      ※ 初期設定ではすべての時間帯が選択されています。
                    </p>
                  </div>
                </div>

                <div className='timeslot-batch-creator__submit-div'>
                  <button 
                    type="submit" 
                    className="timeslot-batch-creator__submit-button"
                    disabled={isLoading || isLoadingExisting}
                  >
                    {isLoading ? '保存中...' : `${format(currentMonth, 'yyyy年MM月', { locale: ja })}の全${monthSchedule.length}日分を保存`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Aba: Gerenciamento de Horários */}
          {activeTab === 'times' && (
            <div className="timeslot-batch-creator__time-management">
              <h3 className="timeslot-batch-creator__subtitle">時間管理</h3>
              <p>利用可能な時間を追加または削除します。</p>
              
              <form onSubmit={handleAddTime} className="timeslot-batch-creator__add-time-form">
                <div className="timeslot-batch-creator__form-group">
                  <label htmlFor="newTime" className="timeslot-batch-creator__label">新しい時間:</label>
                  <input
                    id="newTime"
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    required
                    className="timeslot-batch-creator__input"
                    placeholder="例: 11:00〜12:00"
                  />
                </div>
                <button 
                  type="submit" 
                  className="timeslot-batch-creator__add-button"
                  disabled={isAddingTime || !newTime}
                >
                  {isAddingTime ? '追加中...' : '時間を追加'}
                </button>
              </form>

              <div className="timeslot-batch-creator__time-list">
                <h4 className="timeslot-batch-creator__list-title">利用可能な時間 ({timeSlots.length}個)</h4>
                {timeSlots.length === 0 ? (
                  <p className="timeslot-batch-creator__no-times">時間が登録されていません</p>
                ) : (
                  <div className="timeslot-batch-creator__time-items">
                    {timeSlots.map((timeSlot) => (
                      <div key={timeSlot.id} className="timeslot-batch-creator__time-item">
                        <span className="timeslot-batch-creator__time-value">
                          {timeSlot.time_value}
                        </span>
                        <button
                          type="button"
                          className="timeslot-batch-creator__delete-time-button"
                          onClick={() => handleDeleteTime(timeSlot.id, timeSlot.time_value)}
                          title="この時間を削除"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {statusMessage && (
          <div className={`timeslot-batch-creator__message ${
            isError ? 'timeslot-batch-creator__message--error' : 'timeslot-batch-creator__message--success'
          }`}>
            {statusMessage}
          </div>
        )}
      </div>
    </>
  );
};

export default TimeslotBatchCreator;
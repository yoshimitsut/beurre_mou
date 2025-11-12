import React, { useState, useEffect } from 'react';
import './TimeSlotsManagement.css';

// TypeScriptの型定義
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

// YYYY-MM-DD形式で日付をフォーマットするヘルパー関数
const formatDate = (date: Date): string => {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
};

const API_BASE_URL = import.meta.env.VITE_API_URL+'/api/timeslots';

type TabType = 'times' | 'days';

const TimeslotBatchCreator: React.FC<TimeslotBatchCreatorProps> = ({ onTimeslotsCreated }) => {
  const [activeTab, setActiveTab] = useState<TabType>('days');
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date())); 
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]); 
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [existingDayTimeSlots, setExistingDayTimeSlots] = useState<DayTimeSlot[]>([]);
  
  // 新しい状態: 時間追加フォーム
  const [newTime, setNewTime] = useState<string>('');
  const [isAddingTime, setIsAddingTime] = useState<boolean>(false);
  
  // フィードバックの状態（成功/エラー）
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingTimes, setIsLoadingTimes] = useState<boolean>(true);
  const [, setIsLoadingExisting] = useState<boolean>(false);

  // すべての利用可能な時間を取得
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

  useEffect(() => {
    fetchTimeSlots();
  }, []);

  // 選択された日付の既存の時間帯を取得
  useEffect(() => {
    const fetchExistingTimeSlots = async () => {
      if (!selectedDate) return;

      try {
        setIsLoadingExisting(true);
        const response = await fetch(`${API_BASE_URL}/`);
        const data = await response.json();
        
        if (data.success && data.timeslots) {
          const existingForSelectedDate = data.timeslots.filter(
            (slot: DayTimeSlot) => slot.date === selectedDate
          );
          setExistingDayTimeSlots(existingForSelectedDate);
          
          const existingTimes = existingForSelectedDate.map((slot: DayTimeSlot) => slot.time);
          setSelectedTimes(existingTimes);
        }
      } catch (error) {
        console.error('既存時間帯取得エラー:', error);
      } finally {
        setIsLoadingExisting(false);
      }
    };

    if (activeTab === 'days') {
      fetchExistingTimeSlots();
    }
  }, [selectedDate, activeTab]);

  // 新しい時間を追加する関数
  const handleAddTime = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTime) {
      setIsError(true);
      setStatusMessage('時間を入力してください。');
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

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '時間の追加に失敗しました。');
      }

      setStatusMessage(`時間 ${newTime} を追加しました！`);
      setIsError(false);
      setNewTime('');
      
      // 時間リストを再読み込み
      await fetchTimeSlots();
      
    } catch (error) {
      console.error('時間追加エラー:', error);
      setIsError(true);
      setStatusMessage(`エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsAddingTime(false);
    }
  };

  // 時間を削除する関数
  const handleDeleteTime = async (timeId: number, timeValue: string) => {
    if (!window.confirm(`時間 ${timeValue} を削除してもよろしいですか？\nこの時間が使用されている日付からも削除されます。`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/times/${timeId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '時間の削除に失敗しました。');
      }

      setStatusMessage(`時間 ${timeValue} を削除しました！`);
      setIsError(false);
      
      // 時間リストを再読み込み
      await fetchTimeSlots();
      
    } catch (error) {
      console.error('時間削除エラー:', error);
      setIsError(true);
      setStatusMessage(`エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  // 時間の選択/選択解除のハンドラー
  const handleTimeToggle = (time: string): void => {
    setSelectedTimes(prev => {
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      } else {
        return [...prev, time].sort();
      }
    });
  };

  // 時間帯を削除する関数
  const deleteTimeSlot = async (slotId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/${slotId}`, {
        method: 'DELETE',
      });

      console.log('🗑️ 削除レスポンス status:', response.status);
      
      const responseText = await response.text();
      console.log('🗑️ 削除レスポンス text:', responseText);

      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        return response.ok;
      }

      return data.success || response.ok;
    } catch (error) {
      console.error('削除エラー:', error);
      return false;
    }
  };

  // フォーム送信のハンドラー
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setStatusMessage(null);
    setIsError(false);
    
    if (!selectedDate) {
      setIsError(true);
      setStatusMessage('日付を選択してください。');
      return;
    }

    setIsLoading(true);

    try {
      let deletedCount = 0;
      let insertedCount = 0;
      let skippedCount = 0;

      // 1. 削除された時間帯を処理
      const timesToDelete = existingDayTimeSlots
        .filter(slot => !selectedTimes.includes(slot.time))
        .map(slot => slot.id);

      console.log('🗑️ 削除する時間帯:', timesToDelete);

      // 各削除を実行
      for (const slotId of timesToDelete) {
        const success = await deleteTimeSlot(slotId);
        if (success) {
          deletedCount++;
        }
      }

      // 2. 新しく追加する時間帯を処理
      const existingTimes = existingDayTimeSlots.map(slot => slot.time);
      const timesToAdd = selectedTimes.filter(time => !existingTimes.includes(time));

      console.log('➕ 追加する時間帯:', timesToAdd);

      if (timesToAdd.length > 0) {
        const payload = {
          dates: [selectedDate],
          times: timesToAdd,
          limit_slots: 10
        };

        const response = await fetch(`${API_BASE_URL}/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data: ApiResponse = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || '時間帯の登録に失敗しました。');
        }

        insertedCount = data.inserted;
        skippedCount = data.skipped;
      }

      // 3. 既存の時間帯を再読み込み
      const existingResponse = await fetch(`${API_BASE_URL}/`);
      const existingData = await existingResponse.json();
      if (existingData.success && existingData.timeslots) {
        const existingForSelectedDate = existingData.timeslots.filter(
          (slot: DayTimeSlot) => slot.date === selectedDate
        );
        setExistingDayTimeSlots(existingForSelectedDate);
      }

      // 4. 結果メッセージを表示
      let message = '';
      if (deletedCount > 0 && insertedCount > 0) {
        message = `成功！${deletedCount}個の時間帯を削除し、${insertedCount}個の時間帯を追加しました。`;
      } else if (deletedCount > 0) {
        message = `成功！${deletedCount}個の時間帯を削除しました。`;
      } else if (insertedCount > 0) {
        message = `成功！${insertedCount}個の時間帯を追加しました。${skippedCount > 0 ? `(${skippedCount}個は既に存在していたためスキップされました)` : ''}`;
      } else {
        message = '変更はありません。';
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

  // 既存の時間帯があるかチェック
  const hasExistingSlots = existingDayTimeSlots.length > 0;

  return (
    <div className="timeslot-batch-creator">
      <h2 className="timeslot-batch-creator__title">📅 時間帯管理システム</h2>
      
      {/* Abas de navegação */}
      <div className="timeslot-batch-creator__tabs">
        <button 
          className={`timeslot-batch-creator__tab ${activeTab === 'days' ? 'timeslot-batch-creator__tab--active' : ''}`}
          onClick={() => setActiveTab('days')}
        >
          📅 日別時間帯管理
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
            <h3 className="timeslot-batch-creator__subtitle">日別時間帯設定</h3>
            <p>日付を選択し、時間帯を管理してください。チェックを外すと時間帯が削除されます。</p>

            <form onSubmit={handleSubmit}>
              <div className="timeslot-batch-creator__form-row">
                <div className="timeslot-batch-creator__form-group">
                  <label htmlFor="date" className="timeslot-batch-creator__label">収集日:</label>
                  <input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                    className="timeslot-batch-creator__input"
                    min={formatDate(new Date())}
                  />
                </div>
              </div>

              {/* 現在登録されている時間帯表示 */}
              {hasExistingSlots && (
                <div className="timeslot-batch-creator__current-slots">
                  <h4 className="timeslot-batch-creator__subtitle">
                    📋 {selectedDate} の登録済み時間帯
                  </h4>
                  <p className="timeslot-batch-creator__help-text">
                    ※ チェックを外すと時間帯が削除されます
                  </p>
                </div>
              )}

              {/* 時間選択 */}
              <div className="timeslot-batch-creator__form-group">
                  <label className="timeslot-batch-creator__label">
                    時間帯の選択 ({selectedTimes.length}個選択中)
                  </label>
                  
                  {isLoadingTimes ? (
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
                          const isExisting = existingDayTimeSlots.some(slot => slot.time === timeSlot.time_value);
                          const isSelected = selectedTimes.includes(timeSlot.time_value);
                          
                          return (
                            <div 
                              key={timeSlot.id}
                              className={`timeslot-batch-creator__time-button ${
                                isSelected ? 'timeslot-batch-creator__time-button--selected' : ''
                              } ${
                                isExisting ? 'timeslot-batch-creator__time-button--existing' : ''
                              }`}
                              onClick={() => handleTimeToggle(timeSlot.time_value)}
                              title={isExisting ? '登録済み - チェックを外すと削除されます' : 'クリックで選択'}
                            >
                              {timeSlot.time_value}
                              {isExisting && <span className="timeslot-batch-creator__existing-badge">登録済み</span>}
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="timeslot-batch-creator__selection-info">
                        <p className="timeslot-batch-creator__selected-count">
                          <strong>選択された時間: {selectedTimes.length}個</strong>
                        </p>
                        {selectedTimes.length > 0 && (
                          <p className="timeslot-batch-creator__selected-times">
                            {selectedTimes.join('、 ')}
                          </p>
                        )}
                      </div>
                    </>
                  )}
              </div>

              <button 
                type="submit" 
                className="timeslot-batch-creator__submit-button"
                disabled={isLoading || !selectedDate}
              >
                {isLoading ? '保存中...' : `変更を保存`}
              </button>
            </form>
          </div>
        )}

        {/* Aba: Gerenciamento de Horários */}
        {activeTab === 'times' && (
          <div className="timeslot-batch-creator__time-management">
            <h3 className="timeslot-batch-creator__subtitle">時間管理</h3>
            <p>利用可能な時間を追加または削除します。</p>
            
            {/* 時間追加フォーム */}
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

            {/* 時間リスト */}
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
  );
};

export default TimeslotBatchCreator;
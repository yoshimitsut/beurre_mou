// components/DateTimePicker.tsx
import { useState, useEffect, type ReactNode } from "react";
import DatePicker, { CalendarContainer } from "react-datepicker";
import Select from "react-select";
import { ja } from "date-fns/locale";
import { isSameDay } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";
import type { TimeslotSQL, OptionType } from "../types/types";
// import { formatDateForBackend } from "../utils/dateUtils";

export type TimeOptionType = OptionType & {
  isDisabled?: boolean;
};

export type DateTimePickerProps = {
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  selectedTime: string;
  setSelectedTime: (time: string) => void;
  timeSlotsData: TimeslotSQL[];
  allowedDates: Date[];
  placeholderDate?: string;
  placeholderTime?: string;
};

type MyContainerProps = {
  className?: string;
  children: ReactNode;
};

// Função para converter Date para YYYY-MM-DD sem problemas de timezone
// const formatDateWithoutTimezone = (date: Date): string => {
//   const year = date.getFullYear();
//   const month = String(date.getMonth() + 1).padStart(2, '0');
//   const day = String(date.getDate()).padStart(2, '0');
//   return `${year}-${month}-${day}`;
// };

export default function DateTimePicker({
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  timeSlotsData,
  allowedDates,
  placeholderDate = "日付を選択",
  placeholderTime = "時間を選択",
}: DateTimePickerProps) {
  const [hoursOptions, setHoursOptions] = useState<TimeOptionType[]>([]);

  // Container customizado do calendário
  const MyContainer = ({ className, children }: MyContainerProps) => (
    <div>
      <CalendarContainer className={className}>{children}</CalendarContainer>
      <div className="calendar-notice">
        <div className="notice">
          <div className="selectable"></div>
          <span>予約可能日  /  <span className="yassumi">x</span> 予約不可</span>
        </div>
      </div>
    </div>
  );

  // Atualiza opções de horário quando a data muda - CORRIGIDO
  // DateTimePicker.tsx - useEffect corrigido
useEffect(() => {
  if (!selectedDate) return;

  // Converter selectedDate para o mesmo formato que vem do backend (YYYY-MM-DD)
  const selectedDateFormatted = selectedDate.toISOString().split('T')[0];
  
  const daySlots = timeSlotsData.filter((slot) => {
    // Slot.date já deve estar no formato '2025-12-25'
    // Se vier com timezone, remover a parte do tempo
    const slotDateFormatted = slot.date.split('T')[0];
    return selectedDateFormatted === slotDateFormatted;
  });

  const options: TimeOptionType[] = daySlots.map((slot) => ({
    value: slot.time,
    label: slot.time,
    isDisabled: slot.limit_slots <= 0,
  }));

  setHoursOptions(options);
}, [selectedDate, timeSlotsData]);

  const isDateAllowed = (date: Date) =>
    allowedDates.some((d) => isSameDay(d, date));

  return (
    <div className="datetime-picker">
      <div className="input-group-edit">
        <label style={{'paddingLeft': '2px'}}>受け取り希望日</label>
        <DatePicker
          selected={selectedDate}
          onChange={setSelectedDate}
          includeDates={allowedDates}
          filterDate={isDateAllowed}
          minDate={allowedDates[0]}
          maxDate={allowedDates[allowedDates.length - 1]}
          dateFormat="yyyy年MM月dd日"
          placeholderText={placeholderDate}
          className="input-text-modal"
          locale={ja}
          calendarClassName="datepicker-calendar"
          calendarContainer={MyContainer}
          required
        />
      </div>

      <div className="input-group-edit" >
        <label>受け取り希望時間</label>
        <Select<TimeOptionType>
          options={hoursOptions}
          value={hoursOptions.find((h) => h.value === selectedTime) || null}
          onChange={(selected) =>
            setSelectedTime(selected?.value || placeholderTime)
          }
          placeholder={placeholderTime}
          isSearchable={false}
          required
          classNamePrefix="react-select-edit"
          formatOptionLabel={(option, { context }) =>
            context === "menu" && option.isDisabled ? (
              <span style={{ color: "red", fontSize: "0.8rem" }}>
                {option.label} （定員に達した為、選択できません。）
              </span>
            ) : (
              option.label
            )
          }
        />
      </div>
    </div>
  );
}
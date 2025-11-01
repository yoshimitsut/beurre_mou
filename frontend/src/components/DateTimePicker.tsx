// components/DateTimePicker.tsx
import { useState } from "react";
import DatePicker  from "react-datepicker";
import Select from "react-select";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import type { 
  TimeOptionType, 
  // TimeslotSQL 
} from "../types/types";
import { addDays, isAfter, isSameDay, endOfMonth, getDay } from "date-fns";

export type DateTimePickerProps = {
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  selectedTime: string;
  setSelectedTime: (time: string) => void;
  // allowedDates: Date[];
  // timeSlotsData?: TimeslotSQL[]; // ← opcional, caso venha do backend
  placeholderDate?: string;
  placeholderTime?: string;
};

// type MyContainerProps = {
//   className?: string;
//   children: ReactNode;
// };

const today = new Date();
const diasABloquear = 3;
const maxDate = endOfMonth(addDays(today, 90));

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
    if (isAfter(date, today)) datas.push(date);
  });
  return datas;
};

const excludedDates = [
  ...gerarDiasBloqueadosInicio(),
  ...gerarDatasEspecificasComMes(),
];

const defaultTimeSlots: TimeOptionType[] = [
  { id: 1, value: "11:00〜12:00", label: "11:00〜12:00" },
  { id: 2, value: "12:00〜13:00", label: "12:00〜13:00" },
  { id: 3, value: "13:00〜14:00", label: "13:00〜14:00" },
  { id: 4, value: "14:00〜15:00", label: "14:00〜15:00" },
  { id: 5, value: "15:00〜16:00", label: "15:00〜16:00" },
  { id: 6, value: "16:00〜17:00", label: "16:00〜17:00" },
  { id: 7, value: "17:00〜18:00", label: "17:00〜18:00" },
  { id: 8, value: "18:00〜19:00", label: "18:00〜19:00" },
];


  const isDateAllowed = (date: Date) => !excludedDates.some((d) => isSameDay(d, date));

export default function DateTimePicker({
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  // allowedDates,
  // timeSlotsData,
}: DateTimePickerProps) {
  const [pickupHour, setPickupHour] = useState(selectedTime || "");

  const renderDayContents = (day: number, date: Date) => {
  const today = new Date();
  const isBlocked = excludedDates.some((d) => isSameDay(d, date));
  const isSunday = getDay(date) === 0;

  // normaliza o horário de "hoje" e compara timestamps
  const isPast = date.getTime() < new Date(today.setHours(0, 0, 0, 0)).getTime();

  const isGraySunday = isSunday && (isBlocked || isPast);

  return (
    <div className={`day-cell ${isGraySunday ? "domingo-cinza" : ""}`}>
      <span>{day}</span>
    </div>
  );
};


  // const isDateAllowed = (date: Date) =>
  //   allowedDates.some((d) => isSameDay(d, date));

  // const timeOptions: TimeOptionType[] = timeSlotsData?.map((slot) => ({
  //   id: slot.id,
  //   value: slot.time,
  //   label: slot.time,
  //   isDisabled: slot.limit_slots <= 0,
  // })) || defaultTimeSlots;

  return (
    <div className="datetime-picker">
      <div className="input-group-edit">
        <label style={{ paddingLeft: "2px" }}>受け取り希望日</label>
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
          // calendarContainer={MyContainer}
          required
          renderDayContents={renderDayContents}
        />
      </div>

      <div className="input-group-edit">
        <label>受け取り希望時間</label>
        <Select<TimeOptionType>
          options={defaultTimeSlots}
          value={defaultTimeSlots.find(h => h.value === pickupHour) || null}
          onChange={(selected) => {
            const newTime = selected?.value || "";
            setPickupHour(newTime);
            setSelectedTime(newTime);
          }}
          classNamePrefix="react-select"
          placeholder="時間を選択"
          isSearchable={false}
          required
          isOptionDisabled={(opt) => !!opt.isDisabled}
        />
      </div>
    </div>
  );
}

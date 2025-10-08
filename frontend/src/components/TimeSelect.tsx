import { useState, useEffect } from "react";
import Select from "react-select";

type TimeSlot = {
  time: string;
  limit: number;
};

type DaySlots = {
  date: string;
  slots: TimeSlot[];
};

type Props = {
  selectedDate: string;
  onChange: (slot: string) => void;
  value: string | null;
};

export default function TimeSelect({ selectedDate, onChange, value }: Props) {
  const [timeOptions, setTimeOptions] = useState<{ value: string; label: string; isDisabled?: boolean }[]>([]);

  // função para carregar slots do backend
  const fetchSlots = async () => {
    if (!selectedDate) {
      setTimeOptions([]);
      return;
    }

    try {
      const res = await fetch("/api/timeslot?date=" + selectedDate);
      const day: DaySlots = await res.json();

      const options = day.slots.map(slot => ({
        value: slot.time,
        label: `${slot.time} (${slot.limit} disponível${slot.limit !== 1 ? "s" : ""})`,
        isDisabled: slot.limit <= 0,
      }));

      setTimeOptions(options);
    } catch (err) {
      console.error("Erro ao carregar horários:", err);
      setTimeOptions([]);
    }
  };

  // atualiza sempre que a data muda
  useEffect(() => {
    fetchSlots();
  }, [selectedDate]);

  // polling a cada 5 segundos para atualizar os limites
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSlots();
    }, 5000); // 5s

    return () => clearInterval(interval);
  }, [selectedDate]);

  return (
    <Select
      options={timeOptions}
      onChange={option => onChange(option ? option.value : "")}
      value={timeOptions.find(opt => opt.value === value) || null}
      placeholder="選択してください"
      isClearable
    />
  );
}

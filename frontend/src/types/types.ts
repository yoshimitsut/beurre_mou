// types.ts
import type { ReactNode } from "react";

// ------------------ 🎂 Bolos ------------------

export type SizeOption = {
  id?: number;            // opcional: vem da tabela cake_sizes
  cake_id:number;
  size?: string;
  price: number;
  stock: number;
  isDisabled?: boolean;
};

export type Cake = {
  id: number;              // era id_cake, agora o MySQL usa "id"
  name: string;
  description: string | null; // pode ser null no banco
  image: string | null;       // pode ser null
  date_mode?: 'standard' | 'custom';
  custom_dates?: string;      // JSON array string
  sizes: SizeOption[];        // associação via cake_sizes
};

// Caso o backend retorne { cakes: [...] }
export type CakeResponse = {
  cakes: Cake[];
};

// ------------------ 🧾 Pedido ------------------

export type OrderCake = {
  id?: number;
  order_id?: number;
  cake_id: number;
  size?: string;
  amount: number;
  message_cake?: string;
  price: number;           // opcional
  name: string;            // útil para exibição
  stock?: number;
  fruit_option: "有り" | "無し";
};

export type Order = {
  id_order: number;               // era id_order
  id_client: string;
  first_name: string;
  last_name: string;
  email: string;
  tel: string;
  date: string;
  date_order?: string;
  pickupHour: string;
  message: string;
  status: string;
  cakes: OrderCake[];
};

// ------------------ 🕓 Horários ------------------

export type TimeslotSQL = {
  id: number;
  date: string;        // '2025-12-21T03:00:00.000Z'
  time: string;        // '11 ~ 13時'
  limit_slots: number;
};
// export type Slot = {
//   time: string;
//   limit_slots: number; // alterado de "limit" para refletir o nome SQL
// };

// export type TimeslotDay = {
//   date: string;
//   slots: Slot[];
// };

// export type TimeslotResponse = {
//   availableDates: string[];
//   timeslots: TimeslotDay[];
// };

// ------------------ ⚙️ Outros ------------------

export type OptionType = {
  value: string;
  label: string;
  image?: string | null;
};

export type TimeOptionType = OptionType & {
  id: number;
  isDisabled?: boolean;
};

export type MyContainerProps = {
  className?: string;
  children?: ReactNode;
};

export type StatusValue = "a" | "b" | "c" | "d" | "e";

export type StatusOption = {
  value: StatusValue;
  label: string;
};

export const STATUS_OPTIONS: StatusOption[] = [
  { value: "a", label: "未" },
  { value: "b", label: "オンライン予約" },
  { value: "c", label: "店頭支払い済" },
  { value: "d", label: "お渡し済" },
  { value: "e", label: "キャンセル" },
];
import * as XLSX from 'xlsx';
import React from 'react';

import type { Order, OrderCake } from '../types/types';

type ExcelExportButtonProps = {
  data: Order[];
  filename: string;
  sheetName: string;
}
const statusOptions: Record<number, string> = {
  1: "未",
  2: "オンライン予約",
  3: "店頭支払い済",
  4: "お渡し済",
};

const formatDataForExcel = (orders: Order[]) => {
  return orders.flatMap((order) => {
    return order.cakes.map((cake: OrderCake) => ({
      '受付番号': String(order.id_order).padStart(4, "0"),
      'お会計': statusOptions[Number(order.status)] || String(order.status),
      'お名前': `${order.first_name} ${order.last_name}`,
      'ケーキ名': cake.name,
      'サイズ/価格': cake.size,
      '個数': cake.amount,
      '受取日': order.date,
      '受け取り時間': order.pickupHour,
      'メッセージ ケーキ': cake.message_cake || 'なし',
      'その他': order.message || 'なし',
      '注文日': order.date_order,
      '電話番号': order.tel,
      'メールアドレス': order.email,
    }))
  })
}

const handleExport = (data: Order[], filename: string, sheetName: string) => {
  const formattedData = formatDataForExcel(data);
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook,filename)
};

const ExcelExportButton: React.FC<ExcelExportButtonProps> = ({ data, filename, sheetName}) => {
  return (
    <button onClick={() => handleExport(data, filename, sheetName)} className='list-btn excel-btn'>
      <img src='/icons/file-download.ico' alt='excel icon' />
    </button>
  )
}

export default ExcelExportButton;
// export function formatDateJP(dateString: string): string {
//   return new Date(dateString).toLocaleDateString("ja-JP", {
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//     timeZone: "Asia/Tokyo"
//   });
// }


export function formatDateJP(dateString: string): string {
  // Converte a string da API para o fuso horário de Tóquio
  const date = new Date(dateString);
  const tokyoDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

  return tokyoDate.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

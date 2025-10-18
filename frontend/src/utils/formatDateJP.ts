// export function formatDateJP(dateString: string): string {
//   return new Date(dateString).toLocaleDateString("ja-JP", {
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//     timeZone: "Asia/Tokyo"
//   });
// }

export function formatDateJP(dateString: string | null) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${year}年${month}月${day}日`;
}

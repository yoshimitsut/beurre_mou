// utils/dateUtils.ts
export const createLocalDate = (year: number, month: number, day: number): Date => {
  return new Date(year, month - 1, day);
};

export const formatDateForBackend = (date: Date | null): string => {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const areDatesEqual = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
};
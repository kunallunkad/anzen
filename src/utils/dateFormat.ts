/**
 * Centralized date formatting utilities
 * Ensures consistent DD/MM/YYYY format across the application
 */

/**
 * Format a date string or Date object to DD/MM/YYYY format
 * @param date - Date string, Date object, or null/undefined
 * @param includeTime - Whether to include time in format (DD/MM/YYYY HH:mm)
 * @returns Formatted date string or empty string if invalid
 */
export const formatDate = (
  date: string | Date | null | undefined,
  includeTime: boolean = false
): string => {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) return '';

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();

    if (includeTime) {
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Format a date to short format (DD/MM/YY)
 * @param date - Date string or Date object
 * @returns Formatted date string (DD/MM/YY)
 */
export const formatDateShort = (date: string | Date | null | undefined): string => {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) return '';

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getFullYear()).slice(-2);

    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Format a datetime string to readable format (DD/MM/YYYY HH:mm:ss)
 * @param datetime - Datetime string or Date object
 * @returns Formatted datetime string
 */
export const formatDateTime = (datetime: string | Date | null | undefined): string => {
  if (!datetime) return '';

  try {
    const dateObj = typeof datetime === 'string' ? new Date(datetime) : datetime;

    if (isNaN(dateObj.getTime())) return '';

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return '';
  }
};

/**
 * Convert DD/MM/YYYY string to YYYY-MM-DD for input fields
 * @param dateStr - Date string in DD/MM/YYYY format
 * @returns Date string in YYYY-MM-DD format
 */
export const toInputFormat = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';

  try {
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.split('T')[0];
    }

    // Parse DD/MM/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return '';
  } catch (error) {
    console.error('Error converting date format:', error);
    return '';
  }
};

/**
 * Get current date in YYYY-MM-DD format for input fields
 * @returns Current date string
 */
export const getTodayInputFormat = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format date for display in tables (DD/MM/YYYY)
 * This is an alias for formatDate for semantic clarity
 */
export const formatTableDate = formatDate;

/**
 * Parse ISO date string and return in DD/MM/YYYY format
 * @param isoDate - ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
 * @returns Formatted date string (DD/MM/YYYY)
 */
export const parseISODate = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';

  try {
    const date = new Date(isoDate);
    return formatDate(date);
  } catch (error) {
    console.error('Error parsing ISO date:', error);
    return '';
  }
};

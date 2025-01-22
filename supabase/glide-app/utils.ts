export const parseDate = (value: any): string | null => {
  if (!value) return null;
  try {
    const date = new Date(value);
    return date.toISOString();
  } catch (error) {
    console.warn('Failed to parse date:', value, error);
    return null;
  }
};

export const parseNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};
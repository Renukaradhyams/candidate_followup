/**
 * Centralized Master Date Utility (Backend)
 * Enforces Indian Standard Time (IST / Asia/Kolkata, UTC+5:30) date boundaries.
 */

// Format any date input to 'YYYY-MM-DD' in IST
const formatISTDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    return d.trim();
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  
  // Format in IST timezone
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(dt);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
};

// Calculate exact start (00:00:00.000) and end (23:59:59.999) timestamps in IST for any range
const getISTDateRange = (range, fromDate, toDate) => {
  const now = new Date();
  
  // IST Date String for Today
  const todayStr = formatISTDate(now);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  
  let startTime = 0;
  let endTime = Infinity;

  if (range === 'today') {
    startTime = new Date(ty, tm - 1, td, 0, 0, 0, 0).getTime();
    endTime = new Date(ty, tm - 1, td, 23, 59, 59, 999).getTime();
  } else if (range === 'yesterday') {
    const yest = new Date(ty, tm - 1, td - 1);
    const yStr = formatISTDate(yest);
    const [yy, ym, yd] = yStr.split('-').map(Number);
    startTime = new Date(yy, ym - 1, yd, 0, 0, 0, 0).getTime();
    endTime = new Date(yy, ym - 1, yd, 23, 59, 59, 999).getTime();
  } else if (range === 'week' || range === '7days') {
    startTime = Date.now() - 7 * 86400000;
    endTime = Date.now();
  } else if (range === 'month' || range === '30days') {
    startTime = Date.now() - 30 * 86400000;
    endTime = Date.now();
  } else if (range === 'last_month') {
    const firstDayLastMonth = new Date(ty, tm - 2, 1, 0, 0, 0, 0);
    const lastDayLastMonth = new Date(ty, tm - 1, 0, 23, 59, 59, 999);
    startTime = firstDayLastMonth.getTime();
    endTime = lastDayLastMonth.getTime();
  } else if (range === 'custom' && fromDate) {
    const fParts = fromDate.split('-').map(Number);
    startTime = new Date(fParts[0], fParts[1] - 1, fParts[2], 0, 0, 0, 0).getTime();
    if (toDate) {
      const tParts = toDate.split('-').map(Number);
      endTime = new Date(tParts[0], tParts[1] - 1, tParts[2], 23, 59, 59, 999).getTime();
    } else {
      endTime = startTime + 86400000 - 1;
    }
  }

  return { startTime, endTime, todayStr };
};

// Check if a date input falls within the selected IST range
const isDateInRange = (dateInput, range, fromDate, toDate) => {
  if (!range || range === 'all') return true;
  if (!dateInput) return false;

  const { startTime, endTime, todayStr } = getISTDateRange(range, fromDate, toDate);

  if (range === 'today') {
    return formatISTDate(dateInput) === todayStr;
  }

  const dt = new Date(dateInput);
  if (isNaN(dt.getTime())) return false;
  const t = dt.getTime();
  return t >= startTime && t <= endTime;
};

// Get standardized business date for each module
const getBusinessDate = (record, moduleType) => {
  if (!record) return null;
  const mod = (moduleType || '').toUpperCase().trim();

  if (mod === 'CRM' || mod === 'CANDIDATES') {
    return record.created_at || record.createdAt || null;
  }
  if (mod === 'INTERVIEW') {
    return record.interview_date || record.interviewDate || record.created_at || record.createdAt || null;
  }
  if (mod === 'OFFER_PENDING') {
    return record.created_at || record.createdAt || null;
  }
  if (mod === 'OFFER_ACCEPTED') {
    return record.confirm_date || record.confirmDate || record.updated_at || record.updatedAt || record.created_at || null;
  }
  if (mod === 'JOINED' || mod === 'EMPLOYEES' || mod === 'OFFER_JOINED') {
    return record.actual_doj || record.actualDoj || record.offered_doj || record.offeredDoj || record.updated_at || record.updatedAt || record.created_at || record.createdAt || null;
  }

  return record.created_at || record.createdAt || null;
};

module.exports = {
  formatISTDate,
  getISTDateRange,
  isDateInRange,
  getBusinessDate
};

import { format, differenceInDays, parseISO, isValid } from 'date-fns';

// Currency formatting for Indian Rupees
export function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

// Date formatting
export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  try {
    const parsed = parseISO(date);
    if (!isValid(parsed)) return '-';
    return format(parsed, 'dd MMM yyyy');
  } catch {
    return '-';
  }
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-';
  try {
    const parsed = parseISO(date);
    if (!isValid(parsed)) return '-';
    return format(parsed, 'dd MMM yyyy, hh:mm a');
  } catch {
    return '-';
  }
}

// Portfolio calculations
export function calculateAbsoluteReturn(invested: number, current: number): number {
  if (invested === 0) return 0;
  return ((current - invested) / invested) * 100;
}

export function calculateCAGR(invested: number, current: number, years: number): number {
  if (invested === 0 || years === 0) return 0;
  return (Math.pow(current / invested, 1 / years) - 1) * 100;
}

export function calculateInvestmentCAGR(
  invested: number,
  current: number,
  purchaseDate: string | null | undefined
): number {
  if (!purchaseDate || invested <= 0 || current <= 0) return 0;
  try {
    const start = parseISO(purchaseDate);
    const end = new Date();
    const days = differenceInDays(end, start);
    const years = days / 365.25;
    if (years <= 0.04) return 0; // Skip CAGR calculation for investments less than ~15 days old to avoid massive spikes
    return calculateCAGR(invested, current, years);
  } catch {
    return 0;
  }
}

// Goal planning calculations
export function calculateRequiredSIP(
  targetAmount: number,
  currentInvestment: number,
  years: number,
  expectedReturn: number
): number {
  if (years <= 0) return 0;
  const monthlyRate = expectedReturn / 100 / 12;
  const months = years * 12;
  const futureValueOfCurrent = currentInvestment * Math.pow(1 + monthlyRate, months);
  const remaining = targetAmount - futureValueOfCurrent;
  if (remaining <= 0) return 0;
  const sip = remaining * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1);
  return Math.ceil(sip);
}

export function calculateFutureValue(
  monthlyInvestment: number,
  years: number,
  expectedReturn: number
): number {
  const monthlyRate = expectedReturn / 100 / 12;
  const months = years * 12;
  return monthlyInvestment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
}

// Upcoming dates
export function getUpcomingBirthdays(clients: Array<{ name: string; dob: string | null }>, days: number = 30) {
  const today = new Date();
  return clients
    .filter((c) => c.dob)
    .map((c) => {
      const dob = parseISO(c.dob!);
      const birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (birthday < today) {
        birthday.setFullYear(today.getFullYear() + 1);
      }
      const daysUntil = differenceInDays(birthday, today);
      return { ...c, daysUntil, upcomingDate: birthday };
    })
    .filter((c) => c.daysUntil <= days && c.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function getUpcomingAnniversaries(clients: Array<{ name: string; anniversary: string | null }>, days: number = 30) {
  const today = new Date();
  return clients
    .filter((c) => c.anniversary)
    .map((c) => {
      const anniv = parseISO(c.anniversary!);
      const anniversary = new Date(today.getFullYear(), anniv.getMonth(), anniv.getDate());
      if (anniversary < today) {
        anniversary.setFullYear(today.getFullYear() + 1);
      }
      const daysUntil = differenceInDays(anniversary, today);
      return { ...c, daysUntil, upcomingDate: anniversary };
    })
    .filter((c) => c.daysUntil <= days && c.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

// Risk profile labels
export const riskProfileLabels: Record<string, string> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
  very_aggressive: 'Very Aggressive',
};

// Goal type labels
export const goalTypeLabels: Record<string, string> = {
  retirement: 'Retirement',
  education: 'Education',
  marriage: 'Marriage',
  house: 'House',
  vehicle: 'Vehicle',
  other: 'Other',
};

// Lead status labels and colors
export const leadStatusConfig: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  contacted: { label: 'Contacted', color: 'bg-yellow-100 text-yellow-700' },
  interested: { label: 'Interested', color: 'bg-purple-100 text-purple-700' },
  converted: { label: 'Converted', color: 'bg-green-100 text-green-700' },
  lost: { label: 'Lost', color: 'bg-red-100 text-red-700' },
};

// Task priority colors
export const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
};

// Task status colors
export const taskStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
};

// Indian states
export const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// WhatsApp message templates
export function generateWhatsAppMessage(clientName: string, portfolioValue?: string): string {
  return `Dear ${clientName},

Indian markets remained strong this month. Long term wealth is created through discipline and patience.

${portfolioValue ? `Your portfolio current value: ${portfolioValue}\n\n` : ''}Your Portfolio Summary is attached.

Regards,
Dhara Financial Services
📞 Contact us for any queries`;
}

export function generateWhatsAppLink(phone: string, message: string): string {
  const encodedMessage = encodeURIComponent(message);
  const cleanPhone = phone.replace(/\D/g, '');
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  return `https://wa.me/${fullPhone}?text=${encodedMessage}`;
}

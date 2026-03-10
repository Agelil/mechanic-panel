import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount) + ' руб.';
}

export function formatPriceRange(from: number, to?: number | null): string {
  if (to && to > from) {
    return `от ${formatPrice(from)} до ${formatPrice(to)}`;
  }
  return `от ${formatPrice(from)}`;
}


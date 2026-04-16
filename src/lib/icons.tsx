import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Building2,
  Car,
  CircleHelp,
  Coffee,
  Heart,
  Home,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  AlertTriangle,
  Building2,
  Car,
  Coffee,
  Heart,
  Home,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
};

export function resolveLucideIcon(iconName?: string | null): LucideIcon {
  if (!iconName) {
    return CircleHelp;
  }

  return iconMap[iconName] ?? CircleHelp;
}

export function resolveInsightIcon(tone?: string | null, insightType?: string | null): LucideIcon {
  switch (insightType) {
    case "low_balance_risk":
      return Wallet;
    case "spending_spike":
      return TrendingUp;
    case "installment_pressure":
      return AlertTriangle;
    case "category_concentration":
    case "top_category":
      return Target;
    case "recurring_charges":
      return Zap;
    case "unusual_expense":
      return AlertTriangle;
    default:
      break;
  }

  switch (tone) {
    case "warning":
      return AlertTriangle;
    case "success":
      return TrendingDown;
    case "info":
      return Target;
    default:
      return Sparkles;
  }
}

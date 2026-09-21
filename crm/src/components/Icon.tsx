"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Folder,
  Heart,
  Home,
  LayoutGrid,
  Lightbulb,
  Mail,
  MapPin,
  Megaphone,
  Moon,
  MoreHorizontal,
  Pencil,
  Pin,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  StickyNote,
  Sun,
  Tag,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  X,
  XCircle,
} from "lucide-react";

/**
 * Single icon surface for the whole CRM, backed by lucide-react. The
 * name-based API (<Icon name="search" size={16} />) is stable — call sites
 * never import lucide directly, so the icon set can be re-skinned here.
 * Unknown names render a neutral circle (never an empty element).
 */

const ICONS: Record<string, LucideIcon> = {
  // Navigation
  home: Home,
  target: Target,
  users: Users,
  building: Building2,
  heart: Heart,
  trending: TrendingUp,
  megaphone: Megaphone,
  check: Check,
  upload: Upload,
  chart: BarChart3,
  search: Search,
  settings: Settings,

  // Actions
  plus: Plus,
  edit: Pencil,
  trash: Trash2,
  mail: Mail,
  calendar: Calendar,
  note: StickyNote,
  file: FileText,
  download: Download,
  more: MoreHorizontal,
  close: X,
  chevron_down: ChevronDown,
  chevron_up: ChevronUp,
  chevron_right: ChevronRight,
  external: ExternalLink,

  // Status
  check_circle: CheckCircle2,
  x_circle: XCircle,
  alert: AlertTriangle,
  clock: Clock,
  pin: Pin,
  map_pin: MapPin,
  refresh: RefreshCw,

  // File / object
  folder: Folder,
  box: Box,
  shield: Shield,
  plug: Plug,
  grid: LayoutGrid,
  tag: Tag,
  sliders: SlidersHorizontal,

  // Misc
  moon: Moon,
  sun: Sun,
  bell: Bell,
  lightbulb: Lightbulb,
};

export function Icon({
  name,
  size = 16,
  className,
  strokeWidth = 2,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Component = ICONS[name] ?? Circle;
  return (
    <Component
      size={size}
      className={className}
      strokeWidth={strokeWidth}
      aria-hidden
      style={{ flexShrink: 0 }}
    />
  );
}

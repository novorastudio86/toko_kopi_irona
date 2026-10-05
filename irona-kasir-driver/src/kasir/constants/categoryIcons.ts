import {
  CirclePlus,
  Coffee,
  Croissant,
  CupSoda,
  FlaskConical,
  Leaf,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';

/** Kunci ikon kategori dari Web Admin → ikon lucide yang paling mirip */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'add-on': CirclePlus,
  'coffee-cup': Coffee,
  'cup-saucer': Coffee,
  'hot-mug': Coffee,
  'iced-coffee': CupSoda,
  'main-course': UtensilsCrossed,
  'manual-brew': FlaskConical,
  pastry: Croissant,
  tea: Leaf,
};
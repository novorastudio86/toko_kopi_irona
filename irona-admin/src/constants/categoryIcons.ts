import coffeeCup from '../assets/category-icons/coffee-cup.svg';
import manualBrew from '../assets/category-icons/manual-brew.svg';
import hotMug from '../assets/category-icons/hot-mug.svg';
import cupSaucer from '../assets/category-icons/cup-saucer.svg';
import icedCoffee from '../assets/category-icons/iced-coffee.svg';
import tea from '../assets/category-icons/tea.svg';
import pastry from '../assets/category-icons/pastry.svg';
import mainCourse from '../assets/category-icons/main-course.svg';
import addOn from '../assets/category-icons/add-on.svg';

export const CATEGORY_ICONS: Record<string, { label: string; src: string }> = {
  'coffee-cup': { label: 'Kopi Panas', src: coffeeCup },
  'manual-brew': { label: 'Manual Brew', src: manualBrew },
  'hot-mug': { label: 'Mug', src: hotMug },
  'cup-saucer': { label: 'Cangkir & Tatakan', src: cupSaucer },
  'iced-coffee': { label: 'Kopi Es', src: icedCoffee },
  tea: { label: 'Teh & Matcha', src: tea },
  pastry: { label: 'Roti & Pastry', src: pastry },
  'main-course': { label: 'Makanan Utama', src: mainCourse },
  'add-on': { label: 'Add On', src: addOn },
};

export const DEFAULT_CATEGORY_ICON = 'coffee-cup';

export function getCategoryIconSrc(key: string | null): string {
  return (CATEGORY_ICONS[key ?? ''] ?? CATEGORY_ICONS[DEFAULT_CATEGORY_ICON]).src;
}
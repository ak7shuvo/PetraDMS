import { formatStock, type ProductDto } from '@petra/core';
import { useI18n, type I18n } from '../i18n';

/** Stock as packs, for example "2 Carton, 5 pcs" (digits follow the language). */
export function stockText(i: I18n, p: Pick<ProductDto, 'packs' | 'baseUnit'>, baseQty: number): string {
  const levels = p.packs.length > 0 ? p.packs : [{ id: 0, name: p.baseUnit, factor: 1 }];
  return i.n(formatStock(baseQty, levels.map((k) => ({ id: k.id, name: k.name, factor: k.factor }))));
}

export function useDisplayDate(): (iso: string) => string {
  const { n } = useI18n();
  return (iso) => (iso ? n(`${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`) : '');
}

/** Localised product name: Bangla when the UI is Bangla and a Bangla name exists. */
export function productName(lang: 'bn' | 'en', p: { name: string; nameBn: string }): string {
  return lang === 'bn' && p.nameBn ? p.nameBn : p.name;
}

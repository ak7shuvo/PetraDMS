import { useEffect, useState } from 'react';
import { formatDate, fromBnDigits, isIsoDate, parseMoney, toBnDigits, type Poisha } from '@petra/core';
import { Input } from './controls';
import { useI18n } from '../i18n';

interface BaseProps {
  id?: string;
  invalid?: boolean;
  'aria-describedby'?: string;
  disabled?: boolean;
}

/** Money entry in taka; reports integer poisha, or null while the text is not a valid amount. */
export function MoneyInput({ value, onChange, ...rest }: BaseProps & { value: Poisha | null; onChange: (p: Poisha | null) => void }) {
  const { lang } = useI18n();
  const show = (p: Poisha | null) => (p === null ? '' : lang === 'bn' ? toBnDigits((p / 100).toFixed(p % 100 === 0 ? 0 : 2)) : (p / 100).toFixed(p % 100 === 0 ? 0 : 2));
  const [text, setText] = useState(show(value));
  useEffect(() => {
    if (parseMoney(text) !== value) setText(show(value));
  }, [value, lang]);
  return (
    <Input
      {...rest}
      numeric
      inputMode="decimal"
      value={text}
      invalid={rest.invalid || (text !== '' && parseMoney(text) === null)}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.trim() === '' ? null : parseMoney(e.target.value));
      }}
    />
  );
}

/** Whole-number quantity entry. */
export function QtyInput({ value, onChange, ...rest }: BaseProps & { value: number | null; onChange: (n: number | null) => void }) {
  const { lang } = useI18n();
  const show = (n: number | null) => (n === null ? '' : lang === 'bn' ? toBnDigits(String(n)) : String(n));
  const [text, setText] = useState(show(value));
  useEffect(() => {
    const cur = /^\d+$/.test(fromBnDigits(text)) ? Number(fromBnDigits(text)) : null;
    if (cur !== value) setText(show(value));
  }, [value, lang]);
  return (
    <Input
      {...rest}
      numeric
      inputMode="numeric"
      value={text}
      invalid={rest.invalid || (text !== '' && !/^\d+$/.test(fromBnDigits(text)))}
      onChange={(e) => {
        setText(e.target.value);
        const d = fromBnDigits(e.target.value.trim());
        onChange(d === '' ? null : /^\d+$/.test(d) ? Number(d) : null);
      }}
    />
  );
}

export function parseDisplayDate(text: string): string | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(fromBnDigits(text.trim()));
  if (!m) return null;
  const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
}

/** Date entry as DD/MM/YYYY; value is an ISO date string. */
export function DateInput({ value, onChange, ...rest }: BaseProps & { value: string | null; onChange: (iso: string | null) => void }) {
  const { lang } = useI18n();
  const show = (iso: string | null) => (iso && isIsoDate(iso) ? (lang === 'bn' ? toBnDigits(formatDate(iso)) : formatDate(iso)) : '');
  const [text, setText] = useState(show(value));
  useEffect(() => {
    if (parseDisplayDate(text) !== value) setText(show(value));
  }, [value, lang]);
  return (
    <Input
      {...rest}
      numeric
      placeholder={lang === 'bn' ? 'দিন/মাস/বছর' : 'DD/MM/YYYY'}
      value={text}
      invalid={rest.invalid || (text !== '' && parseDisplayDate(text) === null)}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseDisplayDate(e.target.value));
      }}
    />
  );
}

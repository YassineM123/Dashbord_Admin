import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../ui/utils';

export type DatePreset = 'aujourd_hui' | 'hier' | '7j' | '30j' | '90j' | 'ce_mois' | 'mois_dernier' | 'custom';

interface DatePresetFilterProps {
  value: DatePreset;
  onChange: (preset: DatePreset, from?: Date, to?: Date) => void;
  className?: string;
}

const presetLabels: Record<DatePreset, string> = {
  'aujourd_hui': "Aujourd'hui",
  'hier': 'Hier',
  '7j': '7 derniers jours',
  '30j': '30 derniers jours',
  '90j': '90 derniers jours',
  'ce_mois': 'Ce mois',
  'mois_dernier': 'Mois dernier',
  'custom': 'Personnalisé',
};

export function DatePresetFilter({ value, onChange, className }: DatePresetFilterProps) {
  const [open, setOpen] = useState(false);

  const handlePresetClick = (preset: DatePreset) => {
    const now = new Date();
    let from: Date;
    let to: Date = new Date();

    switch (preset) {
      case 'aujourd_hui':
        from = new Date(now);
        from.setHours(0, 0, 0, 0);
        break;
      case 'hier':
        from = new Date(now);
        from.setDate(now.getDate() - 1);
        from.setHours(0, 0, 0, 0);
        to = new Date(from);
        to.setHours(23, 59, 59, 999);
        break;
      case '7j':
        from = new Date(now);
        from.setDate(now.getDate() - 7);
        break;
      case '30j':
        from = new Date(now);
        from.setDate(now.getDate() - 30);
        break;
      case '90j':
        from = new Date(now);
        from.setDate(now.getDate() - 90);
        break;
      case 'ce_mois':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'mois_dernier':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      default:
        from = new Date(now);
    }

    onChange(preset, from, to);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('gap-2', className)}>
          <Calendar size={16} />
          <span className="hidden sm:inline">{presetLabels[value]}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          {(Object.keys(presetLabels) as DatePreset[]).filter(k => k !== 'custom').map((preset) => (
            <Button
              key={preset}
              variant={value === preset ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handlePresetClick(preset)}
            >
              {presetLabels[preset]}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface DateRangeFilterProps {
  onDateChange: (from: Date | null, to: Date | null) => void;
}

export const DateRangeFilter = ({ onDateChange }: DateRangeFilterProps) => {
  const [date, setDate] = useState<DateRange | undefined>();
  const [open, setOpen] = useState(false);

  const handleQuickFilter = (from: Date, to: Date) => {
    setDate({ from, to });
    onDateChange(from, to);
    setOpen(false);
  };

  const handleClear = () => {
    setDate(undefined);
    onDateChange(null, null);
    setOpen(false);
  };

  const handleApply = () => {
    if (date?.from) {
      onDateChange(
        startOfDay(date.from),
        date.to ? endOfDay(date.to) : endOfDay(date.from)
      );
    }
    setOpen(false);
  };

  const quickFilters = [
    {
      label: "Hoje",
      onClick: () => handleQuickFilter(startOfDay(new Date()), endOfDay(new Date()))
    },
    {
      label: "Ontem",
      onClick: () => handleQuickFilter(startOfDay(subDays(new Date(), 1)), endOfDay(subDays(new Date(), 1)))
    },
    {
      label: "Últimos 7 dias",
      onClick: () => handleQuickFilter(startOfDay(subDays(new Date(), 6)), endOfDay(new Date()))
    },
    {
      label: "Últimos 30 dias",
      onClick: () => handleQuickFilter(startOfDay(subDays(new Date(), 29)), endOfDay(new Date()))
    },
    {
      label: "Esta semana",
      onClick: () => handleQuickFilter(startOfWeek(new Date(), { locale: ptBR }), endOfWeek(new Date(), { locale: ptBR }))
    },
    {
      label: "Semana passada",
      onClick: () => {
        const lastWeek = subWeeks(new Date(), 1);
        handleQuickFilter(startOfWeek(lastWeek, { locale: ptBR }), endOfWeek(lastWeek, { locale: ptBR }));
      }
    },
    {
      label: "Este mês",
      onClick: () => handleQuickFilter(startOfMonth(new Date()), endOfMonth(new Date()))
    },
    {
      label: "Mês passado",
      onClick: () => {
        const lastMonth = subMonths(new Date(), 1);
        handleQuickFilter(startOfMonth(lastMonth), endOfMonth(lastMonth));
      }
    },
    {
      label: "Este ano",
      onClick: () => handleQuickFilter(startOfYear(new Date()), endOfYear(new Date()))
    }
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal gap-2",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {date?.from ? (
            date.to ? (
              <>
                {format(date.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                {format(date.to, "dd/MM/yyyy", { locale: ptBR })}
              </>
            ) : (
              format(date.from, "dd/MM/yyyy", { locale: ptBR })
            )
          ) : (
            <span>Filtrar por data</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="flex flex-col gap-1 p-3 border-r">
            {quickFilters.map((filter) => (
              <Button
                key={filter.label}
                variant="ghost"
                className="justify-start text-sm"
                onClick={filter.onClick}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <div className="p-3">
            <Calendar
              mode="range"
              selected={date}
              onSelect={setDate}
              numberOfMonths={1}
              locale={ptBR}
              className={cn("pointer-events-auto")}
            />
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClear}
              >
                Limpar
              </Button>
              <Button
                className="flex-1"
                onClick={handleApply}
                disabled={!date?.from}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

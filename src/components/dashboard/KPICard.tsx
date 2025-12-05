import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

const variantStyles = {
  default: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    border: "hover:border-primary/30",
  },
  success: {
    iconBg: "bg-success/10",
    iconColor: "text-success",
    border: "hover:border-success/30",
  },
  warning: {
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    border: "hover:border-warning/30",
  },
  danger: {
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    border: "hover:border-destructive/30",
  },
  info: {
    iconBg: "bg-secondary/10",
    iconColor: "text-secondary",
    border: "hover:border-secondary/30",
  },
};

export const KPICard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  description,
  variant = "default" 
}: KPICardProps) => {
  const styles = variantStyles[variant];
  
  return (
    <Card className={cn(
      "relative overflow-hidden border border-border/50 bg-card",
      "shadow-card hover:shadow-elevated transition-all duration-300",
      "hover:-translate-y-0.5",
      styles.border
    )}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/[0.02] pointer-events-none" />
      
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {value}
              </p>
              {trend && (
                <div className={cn(
                  "inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full",
                  trend.isPositive 
                    ? "text-success bg-success/10" 
                    : "text-destructive bg-destructive/10"
                )}>
                  <span>{trend.isPositive ? '↑' : '↓'}</span>
                  <span>{Math.abs(trend.value)}%</span>
                </div>
              )}
              {description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>
          
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            "transition-all duration-300",
            styles.iconBg
          )}>
            <Icon className={cn("h-6 w-6", styles.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

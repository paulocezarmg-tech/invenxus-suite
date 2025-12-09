import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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
  href?: string;
}

const variantStyles = {
  default: {
    iconBg: "bg-primary/10 group-hover:bg-primary/20",
    iconColor: "text-primary",
    border: "hover:border-primary/40",
    glow: "group-hover:shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)]",
  },
  success: {
    iconBg: "bg-success/10 group-hover:bg-success/20",
    iconColor: "text-success",
    border: "hover:border-success/40",
    glow: "group-hover:shadow-[0_0_30px_-5px_hsl(var(--success)/0.3)]",
  },
  warning: {
    iconBg: "bg-warning/10 group-hover:bg-warning/20",
    iconColor: "text-warning",
    border: "hover:border-warning/40",
    glow: "group-hover:shadow-[0_0_30px_-5px_hsl(var(--warning)/0.3)]",
  },
  danger: {
    iconBg: "bg-destructive/10 group-hover:bg-destructive/20",
    iconColor: "text-destructive",
    border: "hover:border-destructive/40",
    glow: "group-hover:shadow-[0_0_30px_-5px_hsl(var(--destructive)/0.3)]",
  },
  info: {
    iconBg: "bg-secondary/10 group-hover:bg-secondary/20",
    iconColor: "text-secondary",
    border: "hover:border-secondary/40",
    glow: "group-hover:shadow-[0_0_30px_-5px_hsl(var(--secondary)/0.3)]",
  },
};

export const KPICard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  description,
  variant = "default",
  href
}: KPICardProps) => {
  const styles = variantStyles[variant];
  
  const cardContent = (
    <Card className={cn(
      "group relative overflow-hidden border border-border/50 bg-card cursor-pointer",
      "shadow-card hover:shadow-elevated transition-all duration-500 ease-out",
      "hover:-translate-y-2 hover:scale-[1.02]",
      styles.border,
      styles.glow
    )}>
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/[0.03] pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-0" />
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.02] via-transparent to-transparent pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-0" />
      
      {/* Shine effect on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors duration-300 group-hover:text-foreground/70">
              {title}
            </p>
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight text-foreground transition-transform duration-300 group-hover:scale-105 origin-left">
                {value}
              </p>
              {trend && (
                <div className={cn(
                  "inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full transition-all duration-300",
                  trend.isPositive 
                    ? "text-success bg-success/10 group-hover:bg-success/20" 
                    : "text-destructive bg-destructive/10 group-hover:bg-destructive/20"
                )}>
                  <span className="transition-transform duration-300 group-hover:scale-125">{trend.isPositive ? '↑' : '↓'}</span>
                  <span>{Math.abs(trend.value)}%</span>
                </div>
              )}
              {description && (
                <p className="text-sm text-muted-foreground mt-1 transition-colors duration-300 group-hover:text-muted-foreground/80">
                  {description}
                </p>
              )}
            </div>
          </div>
          
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            "transition-all duration-500 ease-out",
            "group-hover:scale-110 group-hover:rotate-3",
            styles.iconBg
          )}>
            <Icon className={cn(
              "h-6 w-6 transition-all duration-500",
              "group-hover:scale-110",
              styles.iconColor
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link to={href} className="block">{cardContent}</Link>;
  }

  return cardContent;
};

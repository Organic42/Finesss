import { HTMLAttributes, forwardRef } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCard({ className, padded = true, children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-white/10 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl",
          "transition-colors hover:border-white/30",
          padded && "p-6",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

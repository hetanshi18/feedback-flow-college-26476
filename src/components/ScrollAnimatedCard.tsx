import { cn } from '@/lib/utils';

interface ScrollAnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const ScrollAnimatedCard = ({ children, className }: ScrollAnimatedCardProps) => {
  return (
    <div className={cn(className)}>
      {children}
    </div>
  );
};


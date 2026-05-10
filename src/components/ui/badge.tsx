interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// Map session status to badge variant
export function statusBadgeVariant(status: string): BadgeProps['variant'] {
  switch (status) {
    case 'completed': return 'success';
    case 'interviewing': return 'info';
    case 'processing': return 'warning';
    case 'researching': return 'warning';
    case 'ready': return 'info';
    case 'failed': return 'danger';
    default: return 'default';
  }
}

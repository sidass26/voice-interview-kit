import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 dark:text-[#c3c3cc]"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`block w-full rounded-lg border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#1e1e2a] px-3 py-2 text-sm text-gray-900 dark:text-[#ededf3] shadow-sm placeholder:text-gray-400 dark:placeholder:text-[#70707d] focus:border-blue-500 dark:focus:border-[#6B2AEA] focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#6B2AEA] ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
);

Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, id, options, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 dark:text-[#c3c3cc]"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={`block w-full rounded-lg border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#1e1e2a] px-3 py-2 text-sm text-gray-900 dark:text-[#ededf3] shadow-sm focus:border-blue-500 dark:focus:border-[#6B2AEA] focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#6B2AEA] ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
);

Select.displayName = 'Select';

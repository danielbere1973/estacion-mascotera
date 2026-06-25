"use client";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  confirmMessage: string;
}

export function ConfirmSubmitButton({ confirmMessage, children, onClick, ...props }: Props) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

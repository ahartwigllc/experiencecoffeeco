"use client";

/** Submit button that asks for confirmation first. Use inside a <form action={serverAction}>. */
export function ConfirmButton({
  children,
  message,
  className = "btn btn-small btn-ghost",
  name,
  value,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      name={name}
      value={value}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

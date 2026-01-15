import { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export default function Card({ title, description, footer, children }: Props) {
  return (
    <div className="w-full max-w-3xl m-auto my-8 border rounded-xl p border-border bg-card/50 backdrop-blur-sm">
      <div className="px-5 py-4">
        <h3 className="mb-1 text-2xl font-medium text-foreground">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
        {children}
      </div>
      {footer && (
        <div className="p-4 border-t rounded-b-xl border-border bg-secondary/50 text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}

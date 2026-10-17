import type { JSX, ReactNode } from 'react';

// The settings tabs are columns of ruled sections (Section in src/ui).

/** The paper column a tab reads in: the first seven of the twelve columns. */
export function Column({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <div className="grid split:grid-cols-12 split:gap-x-gutter">
      <div className="grid min-w-0 content-start gap-10 split:col-span-7">{children}</div>
    </div>
  );
}

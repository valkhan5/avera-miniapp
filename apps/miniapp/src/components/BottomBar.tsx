import type { ReactNode } from 'react';

export function BottomBar({ children }: { children: ReactNode }) {
  return <div className="bottom-bar"><div className="bottom-inner">{children}</div></div>;
}

export function PrimaryButton(props: { children: ReactNode; onClick?: () => void; disabled?: boolean; test?: string; busy?: boolean }) {
  return (
    <button className="btn-primary" data-test={props.test} disabled={props.disabled} aria-busy={props.busy} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

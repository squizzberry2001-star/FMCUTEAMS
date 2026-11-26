import React, { createContext, useContext, useMemo } from 'react';

export interface NsoRouteMatch {
  pathname: string;
  search: string;
  params: Record<string, string>;
  navigate: (to: string) => void;
  onExitNso?: () => void;
  initialStoreName?: string;
}

const NsoRouterContext = createContext<NsoRouteMatch>({
  pathname: '/facilitator',
  search: '',
  params: {},
  navigate: (to: string) => {
    window.location.href = to;
  },
});

export function NsoRouterProvider({
  value,
  children,
}: {
  value: NsoRouteMatch;
  children: React.ReactNode;
}) {
  return <NsoRouterContext.Provider value={value}>{children}</NsoRouterContext.Provider>;
}

export function useNsoRouter(): NsoRouteMatch {
  return useContext(NsoRouterContext);
}

/** Drop-in replacement for next/navigation `useParams` */
export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  const ctx = useContext(NsoRouterContext);
  return ctx.params as T;
}

/** Drop-in replacement for next/navigation `useSearchParams` */
export function useSearchParams(): URLSearchParams {
  const ctx = useContext(NsoRouterContext);
  return useMemo(() => new URLSearchParams(ctx.search), [ctx.search]);
}

/** Drop-in replacement for next/link `Link` */
export interface NsoLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children?: React.ReactNode;
}

export const NsoLink: React.FC<NsoLinkProps> = ({ href, onClick, target, children, ...rest }) => {
  const { navigate } = useContext(NsoRouterContext);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(event);
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0 ||
      target === '_blank' ||
      /^https?:\/\//i.test(href) ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    ) {
      return;
    }

    event.preventDefault();
    navigate(href);
  };

  return (
    <a href={href} target={target} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};

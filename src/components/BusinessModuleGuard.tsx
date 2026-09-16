import type { ReactNode } from 'react';
import {
  BUSINESS_MODULES,
  getBusinessModules,
  type BusinessModule,
} from '@/lib/businessModules';

type BusinessModuleGuardProps = {
  businessTypeName: string | null | undefined;
  module: BusinessModule;
  children: ReactNode;
  fallback?: ReactNode;
};

export function BusinessModuleGuard({
  businessTypeName,
  module,
  children,
  fallback = null,
}: BusinessModuleGuardProps) {
  const modules = getBusinessModules(businessTypeName);

  if (!modules.includes(module)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function BusinessModulesList({
  businessTypeName,
}: {
  businessTypeName: string | null | undefined;
}) {
  return (
    <>
      {getBusinessModules(businessTypeName).map((module) => (
        <span key={module}>{BUSINESS_MODULES[module]}</span>
      ))}
    </>
  );
}

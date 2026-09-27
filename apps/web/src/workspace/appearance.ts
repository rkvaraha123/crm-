export interface OrganizationAppearance {
  organizationId: string;
  workspaceName: string;
  primaryColor: string;
  accentColor: string;
  sidebarColor: string;
  pageBackground: string;
  surfaceColor: string;
}

export const DEFAULT_APPEARANCE: OrganizationAppearance = {
  organizationId: '',
  workspaceName: 'RK Varaha CRM',
  primaryColor: '#0f766e',
  accentColor: '#14b8a6',
  sidebarColor: '#0f172a',
  pageBackground: '#f5f7fb',
  surfaceColor: '#ffffff',
};

export function contrastColor(hex: string) {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.58 ? '#0f172a' : '#f8fafc';
}

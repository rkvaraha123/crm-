export interface ProductConfig {
  organizationId: string;
  companiesEnabled: boolean;
  contactsEnabled: boolean;
  leadsEnabled: boolean;
  dealsEnabled: boolean;
  tasksEnabled: boolean;
  activitiesEnabled: boolean;
  dashboardLabel: string;
  companiesLabel: string;
  contactsLabel: string;
  leadsLabel: string;
  dealsLabel: string;
  tasksLabel: string;
}

export const DEFAULT_PRODUCT_CONFIG: Omit<ProductConfig, 'organizationId'> = {
  companiesEnabled: true,
  contactsEnabled: true,
  leadsEnabled: true,
  dealsEnabled: true,
  tasksEnabled: true,
  activitiesEnabled: true,
  dashboardLabel: 'Dashboard',
  companiesLabel: 'Companies',
  contactsLabel: 'Contacts',
  leadsLabel: 'Leads',
  dealsLabel: 'Deals',
  tasksLabel: 'Tasks',
};

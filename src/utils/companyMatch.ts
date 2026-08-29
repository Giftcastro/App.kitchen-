// Matches a user's work email to a registered corporate client by domain,
// so signup can auto-detect "which company the user falls under" instead of
// asking them to type it in.

export function getEmailDomain(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf('@');
  if (at === -1 || at === email.length - 1) return null;
  return email.trim().toLowerCase().slice(at + 1);
}

export interface DomainMatchable {
  id: string;
  name: string;
  domains: string[];
}

/** Finds the first registered company whose domain list contains this email's domain. */
export function findCompanyForEmail<T extends DomainMatchable>(email: string, companies: T[]): T | undefined {
  const domain = getEmailDomain(email);
  if (!domain) return undefined;
  return companies.find(c => c.domains.some(d => d.trim().toLowerCase() === domain));
}

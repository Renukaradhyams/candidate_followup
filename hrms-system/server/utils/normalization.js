/**
 * BSC HRMS Application-Layer Data Normalization Engine
 * Standardizes Department and Designation strings without altering historical DB rows.
 */

const APPROVED_DEPARTMENTS = [
  'Mens',
  'Ladies',
  'Kids',
  'Ground Floor Saree',
  'First Floor Saree',
  'Art & Raw Silk Saree',
  'Home Furnishing',
  'Others',
];

// Explicit Department Mapping dictionary
const DEPT_MAP = new Map([
  ['mens', 'Mens'],
  ['men', 'Mens'],
  ['m', 'Mens'],
  ['ladies', 'Ladies'],
  ['women', 'Ladies'],
  ['womens', 'Ladies'],
  ['w', 'Ladies'],
  ['female', 'Ladies'],
  ['kids', 'Kids'],
  ['kid', 'Kids'],
  ['children', 'Kids'],
  ['saare', 'Ground Floor Saree'],
  ['saree', 'Ground Floor Saree'],
  ['sarees', 'Ground Floor Saree'],
  ['ground floor saree', 'Ground Floor Saree'],
  ['gf saree', 'Ground Floor Saree'],
  ['first floor saree', 'First Floor Saree'],
  ['ff saree', 'First Floor Saree'],
  ['art & raw silk saree', 'Art & Raw Silk Saree'],
  ['raw silk saree', 'Art & Raw Silk Saree'],
  ['silk saree', 'Art & Raw Silk Saree'],
  ['home furnishing', 'Home Furnishing'],
  ['furnishing', 'Home Furnishing'],
  ['billing', 'Others'],
  ['accounts', 'Others'],
  ['account', 'Others'],
  ['hr', 'Others'],
  ['human resources', 'Others'],
  ['others', 'Others'],
  ['other', 'Others'],
  ['unassigned', 'Unassigned'],
]);

// Explicit Designation Mapping dictionary
const DESIG_MAP = new Map([
  ['sales executive', 'Sales Executive'],
  ['salesexec', 'Sales Executive'],
  ['sales ex', 'Sales Executive'],
  ['sales man', 'Sales Executive'],
  ['salesman', 'Sales Executive'],
  ['salesgirl', 'Sales Executive'],
  ['sales girl', 'Sales Executive'],
  ['cashier', 'Cashier'],
  ['billing executive', 'Billing Executive'],
  ['billing exec', 'Billing Executive'],
  ['billing', 'Billing Executive'],
  ['greeter', 'Greeter'],
  ['welcome greeter', 'Greeter'],
  ['hr executive', 'HR Executive'],
  ['hr exec', 'HR Executive'],
  ['hr manager', 'HR Manager'],
  ['accounts executive', 'Accounts Executive'],
  ['accounts exec', 'Accounts Executive'],
  ['accountant', 'Accounts Executive'],
  ['store manager', 'Store Manager'],
  ['floor supervisor', 'Floor Supervisor'],
  ['supervisor', 'Floor Supervisor'],
  ['section manager', 'Section Manager'],
  ['assistant store manager', 'Assistant Store Manager'],
  ['asm', 'Assistant Store Manager'],
]);

/**
 * Converts a string to Title Case with clean space collapsing.
 */
function toTitleCase(str) {
  if (!str) return 'Unassigned';
  let clean = str.trim().replace(/\s+/g, ' ');
  if (!clean) return 'Unassigned';

  return clean
    .split(' ')
    .map(word => {
      const u = word.toUpperCase();
      if (u === 'HR' || u === 'IT' || u === 'POS' || u === 'CEO' || u === 'CTO') return u;
      if (word.toLowerCase() === '&') return '&';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Normalizes Department string
 */
function normalizeDepartment(dept) {
  if (!dept || !dept.trim()) return 'Unassigned';
  const clean = dept.trim().replace(/\s+/g, ' ');
  const lower = clean.toLowerCase();
  if (DEPT_MAP.has(lower)) return DEPT_MAP.get(lower);
  const title = toTitleCase(clean);
  if (APPROVED_DEPARTMENTS.includes(title)) return title;
  return 'Unassigned'; // Returns Unassigned if not in approved taxonomy, routing to Data Verification panel
}

/**
 * Normalizes Designation string
 */
function normalizeDesignation(desig) {
  if (!desig || !desig.trim()) return 'Unassigned';
  const clean = desig.trim().replace(/\s+/g, ' ');
  const lower = clean.toLowerCase();
  if (DESIG_MAP.has(lower)) return DESIG_MAP.get(lower);
  return toTitleCase(clean);
}

/**
 * Normalizes Section string
 */
function normalizeSection(sec) {
  if (!sec || !sec.trim()) return 'General';
  return toTitleCase(sec.trim().replace(/\s+/g, ' '));
}

module.exports = {
  APPROVED_DEPARTMENTS,
  normalizeDepartment,
  normalizeDesignation,
  normalizeSection,
  toTitleCase,
};


/**
 * BSC TEXTILES - Department and Section Hierarchy
 */

export const BSC_DEPARTMENT_SECTIONS: Record<string, string[]> = {
  'Mens': [
    'Ethnic Wear',
    'Brands',
    'Mid',
    'Economic',
    'Undergarments',
    'Watch & Accessories',
    'Suiting & Shirting',
    'Luggage'
  ],
  'Ladies': [
    'Ethnic Wear',
    'Mix & Match',
    'Western',
    'Undergarments & Nightwear',
    'Jewellery Set',
    'Bridal Wear',
    'Accessories',
    'Dress Material',
    'Blouses'
  ],
  'Kids': [
    'Boys',
    'Girls',
    'Newborn',
    'Infants',
    'Boys Accessories',
    'Undergarments'
  ],
  'First Floor Saree': [
    'Silk',
    'Art & Mix',
    'Designer',
    'Cotton'
  ],
  'Ground Floor Saree': [
    'Synthetic',
    'Cotton',
    'Silk',
    'Art & Raw',
    'Fancy',
    'Others / Remaining'
  ],
  'Home Furnishing': [
    'Full Home Furnishing'
  ],
  'Others': [
    'General'
  ]
};

export const BSC_DEPARTMENTS = Object.keys(BSC_DEPARTMENT_SECTIONS);

export function getSectionsForDepartment(deptName: string): string[] {
  if (!deptName) return [];
  // Match exact or case-insensitive
  const key = BSC_DEPARTMENTS.find(d => d.toLowerCase() === deptName.toLowerCase());
  return key ? BSC_DEPARTMENT_SECTIONS[key] : [];
}

/**
 * Normalizes any department string to match canonical casing from BSC_DEPARTMENTS,
 * or formats non-standard strings into proper Title Case.
 */
export function normalizeDepartmentName(deptName: string | null | undefined): string {
  if (!deptName) return '';
  const trimmed = deptName.trim();
  if (!trimmed) return '';

  // 1. Check if it matches a standard BSC_DEPARTMENTS (case-insensitive)
  const canonical = BSC_DEPARTMENTS.find(d => d.toLowerCase() === trimmed.toLowerCase());
  if (canonical) return canonical;

  // 2. Otherwise format as Title Case
  return trimmed
    .toLowerCase()
    .split(' ')
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
    .join(' ');
}

/**
 * Returns a deduplicated, case-insensitively merged array of department names.
 */
export function getUniqueDepartments(rawDepartments?: (string | null | undefined)[]): string[] {
  const map = new Map<string, string>(); // lowercase key -> display name

  // First seed canonical BSC_DEPARTMENTS
  BSC_DEPARTMENTS.forEach(dept => {
    map.set(dept.toLowerCase(), dept);
  });

  // Then add external departments, ensuring no duplicate casing entries like "MENS" / "Mens"
  (rawDepartments || []).forEach(d => {
    if (!d || !d.trim()) return;
    const norm = normalizeDepartmentName(d);
    const key = norm.toLowerCase();
    if (!map.has(key)) {
      map.set(key, norm);
    }
  });

  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

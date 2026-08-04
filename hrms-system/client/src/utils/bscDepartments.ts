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

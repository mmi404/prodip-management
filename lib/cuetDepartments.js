/**
 * Official 12 Undergraduate Degree-Offering Departments at CUET
 * Chittagong University of Engineering and Technology
 */
export const CUET_DEPARTMENTS = [
  { value: 'Civil', label: 'CE - Civil Engineering' },
  { value: 'CSE', label: 'CSE - Computer Science & Engineering' },
  { value: 'EEE', label: 'EEE - Electrical & Electronic Engineering' },
  { value: 'ME', label: 'ME - Mechanical Engineering' },
  { value: 'ETE', label: 'ETE - Electronics & Telecommunication Engineering' },
  { value: 'URP', label: 'URP - Urban & Regional Planning' },
  { value: 'Architecture', label: 'Arch - Architecture' },
  { value: 'PME', label: 'PME - Petroleum & Mining Engineering' },
  { value: 'WRE', label: 'WRE - Water Resources Engineering' },
  { value: 'MIE', label: 'MIE - Mechatronics & Industrial Engineering' },
  { value: 'BME', label: 'BME - Biomedical Engineering' },
  { value: 'MME', label: 'MME - Materials & Metallurgical Engineering' },
  { value: 'Other', label: 'Other Department' }
];

export const CUET_DEPARTMENT_NAMES = CUET_DEPARTMENTS.map(d => d.value);

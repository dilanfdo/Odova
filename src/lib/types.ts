export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number | null;
  fuel_type: string;
  nickname: string | null;
}

export const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG'];

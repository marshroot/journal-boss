export interface ModuleItem {
  id: string;
  name: string;
  category: string;
  loadRate: string; // capacity
  accuracy: number; // range
  speed: string; // speed
  cabinHeight: string; // spec 1
  cabinWidth: string; // spec 2
  storageLimit: string; // luggage
  description: string;
  imageUrl: string;
  costEstimate: number; // rate
  metrics?: { label: string; value: string; icon: 'users' | 'compass' | 'wind' | 'layers' }[];
  specs?: { label: string; value: string }[];
}

export interface SubjectItem {
  id: string;
  name: string;
  code: string;
  area: string; // region
  imageUrl: string;
  description: string;
  complexity: number; // distance
  shortQuote: string;
}

export interface PopularOrigin {
  code: string;
  name: string;
}



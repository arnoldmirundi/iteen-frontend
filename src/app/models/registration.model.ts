export interface Category {
  id: number;
  section: string;
  ageGroup: string;
}

export interface RegistrationEntry {
  section: string;
  ageGroup: string;
  count: number;
}

export interface CreateRegistration {
  clubName: string;
  country: string;
  logo?: string;
  kitPrimary?: string;
  kitSecondary?: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  entries: RegistrationEntry[];
  notes?: string;
}

export interface Registration extends CreateRegistration {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  paymentStatus: 'not_required' | 'unpaid' | 'paid';
  amountDue: number;
  createdAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
  clubId: number | null;
  rejectionReason: string | null;
}
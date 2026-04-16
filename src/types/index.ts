import { Timestamp } from "firebase/firestore";

export type Patient = {
  id: string;
  professionalId: string;
  name: string;
  dni: string;
  phone: string;
  email: string;
  insurance: string;
  lastVisit: string; // ISO string
  totalVisits: number;
  avatarUrl: string;
  missedAppointments: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Appointment = {
  id: string;
  professionalId: string;
  patientId: string;
  patientName: string;
  patientAvatarUrl: string;
  time: string;
  duration: number; // in minutes
  type: 'first_time' | 'checkup' | 'urgent';
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'no_show';
  patientResponse?: 'confirmed' | 'declined';
  patientRespondedAt?: string;
  reminderSentAt?: string;
  ratingRequestSentAt?: string;
  ratingRequestTokenExpiresAt?: string;
  ratingRequestUsedAt?: string;
  reviewSubmittedAt?: string;
  reviewId?: string;
  date: Timestamp;
  revenue?: number;
  hasSeña?: boolean;
  notes?: string;
  cancelledAt?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Professional = {
  id: string;
  userId: string;
  email?: string;
  role?: 'professional_owner' | 'professional_assigned' | 'secretary';
  name: string;
  dni?: string;
  specialty: string;
  licenseNumber: string;
  whatsappNumber: string;
  photoURL?: string;
  coverImageUrl?: string;
  address: string;
  workingHours: string; // JSON string
  appointmentDuration: number;
  messages: string; // JSON string
  subscription: string; // JSON string
  publicProfile: {
    enabled: boolean;
    verified: boolean;
    slug: string;
    bio: string;
    insurances: string[];
    rating: number;
    reviewCount: number;
    mapUrl?: string;
    cardTheme?: {
      primaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
    };
  };
  stats: string; // JSON string
  organizationId?: string;
  blockedDates?: string[];
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ManagedProfessional = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dni?: string;
  verified?: boolean;
  plan: 'Básico' | 'Profesional' | 'Clínica' | 'Trial';
  status: 'Activa' | 'Vencida' | 'Bloqueada' | 'En prueba';
  lastPayment: string;
  avatarUrl: string;
  trialEndsAt?: string;
  appointmentCount: number;
  appointmentLimit: number | 'unlimited';
};

export type Payment = {
  id: string;
  date: string;
  amount: number;
  status: 'Pagado' | 'Fallido';
  plan: string;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: 'Dueño' | 'Profesional' | 'Secretaria';
  status: 'Activo' | 'Pendiente';
  avatarUrl: string;
};

export type SupportTicket = {
  id: string;
  professionalId: string;
  professionalName: string;
  professionalAvatar: string;
  subject: string;
  description: string;
  priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  status: 'Abierto' | 'En proceso' | 'Resuelto' | 'Cerrado';
  createdAt: string;
  assignedTo?: string; // ID of a super admin team member
  history: {
    type: 'status_change' | 'reply' | 'created' | 'priority_change' | 'assignment';
    content: string;
    date: string;
    author: string;
  }[];
};

export type SuperAdminTeamMember = {
  id: string;
  name: string;
  avatarUrl: string;
};

export type Review = {
  id: string;
  appointmentId?: string;
  professionalId?: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  status: 'pending' | 'approved';
};

export type ActivityLogEntry = {
  id: string;
  date: string;
  type: 'appointment_created' | 'appointment_completed' | 'appointment_cancelled' | 'payment_received' | 'profile_updated';
  description: string;
  author: string; // e.g., 'Dr. Juan Pérez', 'Lucía Fernandez (Secretaria)', 'Sistema'
  authorRole: 'Profesional' | 'Secretaria' | 'Sistema' | 'Paciente';
  details?: {
    patientName?: string;
    appointmentDate?: string;
    amount?: number;
    plan?: string;
  }
};

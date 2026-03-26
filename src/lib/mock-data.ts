import type { Patient, Appointment, Professional, ManagedProfessional, Payment, TeamMember, SupportTicket, SuperAdminTeamMember, Review, ActivityLogEntry } from '@/types';

export const mockPatients: Patient[] = [];
export const allAppointments: Appointment[] = [];
export const mockProfessionals: Professional[] = [];
export const mockManagedProfessionals: ManagedProfessional[] = [];
export const mockPayments: { [key: string]: Payment[] } = {};
export const mockTeamMembers: TeamMember[] = [];
export const mockSuperAdminTeam: SuperAdminTeamMember[] = [];
export const mockSupportTickets: SupportTicket[] = [];
export const mockReviews: Review[] = [];
export const mockActivityLogs: { [key: string]: ActivityLogEntry[] } = {};

/**
 * Authentication helpers backed by the legacy Node.js backend's
 * /api/auth/* endpoints.  Cookies are set by the backend (HttpOnly,
 * SameSite=Lax) — we just rely on `credentials: "include"`.
 */
import { api } from "./api";

export type UserRole = "admin" | "user";
export type UserStatus = "active" | "disabled" | "pending";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  credits: number;
  createdAt?: string;
}

export interface CheckinInfo {
  checkedInToday: boolean;
  credit: number;
}

export interface PublicSettings {
  hasApiKey: boolean;
  model: string;
  activeUpstream: string;
  allowRegistration: boolean;
  requireApproval: boolean;
  defaultCredits: number;
  generationCreditCost: number;
  checkinCredit: number;
  maxImagesPerRequest: number;
}

export interface AuthMeResponse {
  user: AuthUser | null;
  firstRun: boolean;
  checkin: CheckinInfo;
  settings: PublicSettings;
}

export function fetchMe(): Promise<AuthMeResponse> {
  return api.get<AuthMeResponse>("/api/auth/me");
}

export function login(email: string, password: string) {
  return api.post<{ user: AuthUser }>("/api/auth/login", { email, password });
}

export function register(email: string, password: string, name?: string) {
  return api.post<{ user: AuthUser; pendingApproval?: boolean }>(
    "/api/auth/register",
    { email, password, name },
  );
}

export function logout() {
  return api.post<void>("/api/auth/logout");
}

/**
 * Default route per user role.  Admins land on the dashboard; ordinary
 * users land on the image creation workspace.
 */
export function defaultRouteForRole(role: UserRole | undefined): string {
  return role === "admin" ? "/admin/dashboard" : "/create";
}

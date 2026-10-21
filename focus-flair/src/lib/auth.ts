export type AuthUser = {
  _id: string;
  fullName: string;
  email: string;
  role: "student" | "admin" | "superadmin";
  isActive?: boolean;
  instituteId?: string;
  institute?: {
    _id: string;
    name: string;
    code: string;
    slug?: string;
    logoUrl?: string;
  } | null;
  profile?: Record<string, unknown> | null;
};

const TOKEN_KEY = "exam_portal_token";
const USER_KEY = "exam_portal_user";

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setAuthSession = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getStoredUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

import { Navigate, Outlet } from "react-router-dom";
import { getStoredUser, getToken } from "@/lib/auth";

type Props = {
  allowedRoles?: Array<"student" | "admin">;
};

export function ProtectedRoute({ allowedRoles }: Props) {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/student/dashboard"} replace />;
  }

  return <Outlet />;
}

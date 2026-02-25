import { Redirect } from "expo-router";
import { useAuthStore } from "../store/auth";

export default function Index() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (token) {
    const hasName = !!(user?.name && user.name.trim());
    if (!hasName) return <Redirect href="/complete-profile" />;
    return <Redirect href="/(tabs)/map" />;
  }
  return <Redirect href="/login" />;
}

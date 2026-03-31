import { RedirectToSignIn, useAuth } from "@clerk/react";
import { Dashboard } from "./pages/Dashboard";
import "./index.css";

export default function App() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <RedirectToSignIn />;

  return <Dashboard />;
}

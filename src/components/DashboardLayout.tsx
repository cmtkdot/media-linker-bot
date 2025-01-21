import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import GlideSync from "./GlideSync";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-semibold">Media Manager</Link>
            <Link to="/glide-sync" className="text-gray-600 hover:text-gray-900">
              Glide Sync
            </Link>
          </div>
          <Button onClick={handleSignOut} variant="outline">
            Sign Out
          </Button>
        </div>
      </header>
      <main className="container mx-auto py-6 px-4">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
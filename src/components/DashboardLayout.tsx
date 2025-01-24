import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { ThemeToggle } from "./ThemeToggle";
import { ShootingStars } from "./ui/shooting-stars";
import { AnimatedGridPattern } from "./ui/animated-grid-pattern";
import { useTheme } from "@/hooks/use-theme";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const { theme } = useTheme();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background with stars */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15)_0%,rgba(0,0,0,0)_80%)]" />
        <div className="stars absolute inset-0" />
      </div>

      {/* Shooting stars layers */}
      <ShootingStars
        starColor="#9E00FF"
        trailColor="#2EB9DF"
        minSpeed={15}
        maxSpeed={35}
        minDelay={1000}
        maxDelay={3000}
      />
      <ShootingStars
        starColor="#FF0099"
        trailColor="#FFB800"
        minSpeed={10}
        maxSpeed={25}
        minDelay={2000}
        maxDelay={4000}
      />

      {/* Content */}
      <div className="relative z-10">
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2">
                <img
                  src={theme === 'dark' ? '/lovable-uploads/3ec87b19-c041-4e80-8db8-953c89275ff4.png' : '/lovable-uploads/5b54e72a-75ea-42c5-97c5-d202e3e76a15.png'}
                  alt="Media Manager Logo"
                  className="h-8 w-auto"
                />
                <span className="text-xl font-semibold">Media Manager</span>
              </Link>
              <Link to="/products" className="text-muted-foreground hover:text-foreground transition-colors">
                Products
              </Link>
              <Link to="/inventory" className="text-muted-foreground hover:text-foreground transition-colors">
                Inventory
              </Link>
              <Link to="/glide-sync" className="text-muted-foreground hover:text-foreground transition-colors">
                Glide Sync
              </Link>
              <Link to="/glide-connections" className="text-muted-foreground hover:text-foreground transition-colors">
                Glide Config
              </Link>
              <Link to="/database-chat" className="text-muted-foreground hover:text-foreground transition-colors">
                Database Chat
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button onClick={handleSignOut} variant="outline">
                Sign Out
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto py-6 px-4">
          <div className="glass-card rounded-xl p-6">
            {children}
          </div>
        </main>
      </div>

      <style>
        {`
          .stars {
            background-image: 
              radial-gradient(2px 2px at 20px 30px, #eee, rgba(0,0,0,0)),
              radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)),
              radial-gradient(2px 2px at 50px 160px, #ddd, rgba(0,0,0,0)),
              radial-gradient(2px 2px at 90px 40px, #fff, rgba(0,0,0,0)),
              radial-gradient(2px 2px at 130px 80px, #fff, rgba(0,0,0,0)),
              radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0));
            background-repeat: repeat;
            background-size: 200px 200px;
            animation: twinkle 5s ease-in-out infinite;
            opacity: 0.5;
          }

          @keyframes twinkle {
            0% { opacity: 0.5; }
            50% { opacity: 0.8; }
            100% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};

export default DashboardLayout;
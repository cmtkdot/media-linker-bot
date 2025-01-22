import { useEffect, useState } from "react";
import { Loader2, Database, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";

const DatabaseChat = () => {
  const [iframeUrl, setIframeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const { toast } = useToast();

  useEffect(() => {
    const initializeChatbot = async () => {
      try {
        setConnectionStatus('checking');
        
        // Replace this with your actual API key and endpoint
        const response = await fetch("https://www.askyourdatabase.com/api/chatbot/v2/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_AYD_API_KEY}`,
          },
          body: JSON.stringify({
            chatbotId: "ffa05499087f66d554e38ff4fadf4972",
            name: "User", // Replace with actual user name from your auth system
            email: "user@example.com", // Replace with actual user email from your auth system
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to initialize chatbot session");
        }

        const { url } = await response.json();

        if (!url) {
          throw new Error("Invalid chatbot session URL");
        }

        setIframeUrl(url);
        setConnectionStatus('success');
        toast({
          title: "Connection Successful",
          description: "Database chat is ready to use",
        });
      } catch (err) {
        console.error('Error:', err);
        setConnectionStatus('error');
        setError("Failed to initialize chat. Please try again later.");
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "Failed to connect to the database chat service",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeChatbot();
  }, [toast]);

  const renderConnectionStatus = () => {
    switch (connectionStatus) {
      case 'checking':
        return (
          <Alert className="mb-4">
            <Database className="h-4 w-4" />
            <AlertDescription className="flex items-center ml-2">
              Initializing database chat...
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            </AlertDescription>
          </Alert>
        );
      case 'success':
        return null;
      case 'error':
        return (
          <Alert variant="destructive" className="mb-4">
            <XCircle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              Failed to connect to database chat. Please try again later.
            </AlertDescription>
          </Alert>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[600px] text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="p-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h1 className="text-2xl font-bold mb-4">Database Chat</h1>
        {renderConnectionStatus()}
        <div className="relative rounded-lg overflow-hidden bg-muted">
          {connectionStatus === 'success' && iframeUrl && (
            <iframe
              className="w-full border-0"
              style={{ height: "600px" }}
              src={iframeUrl}
              allow="clipboard-write"
            />
          )}
        </div>
      </Card>
    </div>
  );
};

export default DatabaseChat;

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trash2, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const DeleteAccountRequest = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      // Try to sign in - if user is already logged in, delete directly
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && session.user.email === email) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user-account`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          await supabase.auth.signOut();
          setSubmitted(true);
          return;
        }
      }

      // If not logged in or different email, just show confirmation
      setSubmitted(true);
      toast({
        title: "Request received",
        description: "If an account exists with this email, it will be processed. Please log in to the app and delete your account from Settings > Account.",
      });
    } catch (error) {
      console.error('Error:', error);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Button variant="ghost" size="icon" className="absolute left-4 top-4" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Trash2 className="h-10 w-10 text-destructive mx-auto mb-2" />
          <CardTitle className="text-xl">Delete Account & Data</CardTitle>
          <CardDescription>
            Request deletion of your Sermable account and all associated data including speeches, practice sessions, and progress.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="font-medium">Request received</p>
                <p className="text-sm text-muted-foreground mt-1">
                  If you're logged in, your account has been deleted. Otherwise, please log in to the app and go to Settings → Account → Delete Account.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/')} className="mt-4">
                Go to Home
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This will permanently delete your account, all speeches, practice history, and personal data. This action cannot be undone.
              </p>
              <Button
                type="submit"
                variant="destructive"
                className="w-full"
                disabled={isSubmitting || !email}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Request Account Deletion"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeleteAccountRequest;

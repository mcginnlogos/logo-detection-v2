import Logo from '@/components/icons/Logo';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Card from '@/components/ui/Card';
import OauthSignIn from '@/components/ui/AuthForms/OauthSignIn';
import { Scan, Sparkles } from 'lucide-react';

export default async function SignIn() {
  // Check if the user is already logged in and redirect to the account page if so
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    return redirect('/');
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <div className="flex flex-col justify-between max-w-lg p-3 m-auto w-80 animate-fade-in">
        <div className="flex justify-center pb-12">
          <div className="relative">
            <div className="p-4 rounded-2xl gradient-accent">
              <Scan className="w-12 h-12 text-primary-foreground" />
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-primary animate-float" />
          </div>
        </div>
        <Card title="Sign In">
          <OauthSignIn />
        </Card>
      </div>
    </div>
  );
}

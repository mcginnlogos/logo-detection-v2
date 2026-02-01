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
        <div className="flex flex-col items-center pb-12 gap-4">
          <h1 className="text-5xl font-bold tracking-tight text-primary">logodetekt</h1>
        </div>
        <Card title="Sign In">
          <OauthSignIn />
        </Card>
      </div>
    </div>
  );
}

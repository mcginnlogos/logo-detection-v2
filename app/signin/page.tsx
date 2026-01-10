import Logo from '@/components/icons/Logo';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Card from '@/components/ui/Card';
import OauthSignIn from '@/components/ui/AuthForms/OauthSignIn';

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
    <div className="flex justify-center height-screen-helper">
      <div className="flex flex-col justify-between max-w-lg p-3 m-auto w-80 ">
        <div className="flex justify-center pb-12 ">
          <Logo width="64px" height="64px" />
        </div>
        <Card title="Sign In">
          <OauthSignIn />
        </Card>
      </div>
    </div>
  );
}
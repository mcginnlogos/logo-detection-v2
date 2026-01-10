import Pricing from '@/components/ui/Pricing/Pricing';
import { createClient } from '@/utils/supabase/server';
import {
  getProducts,
  getSubscription,
  getUser
} from '@/utils/supabase/queries';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const supabase = await createClient();
  const [user, products, subscription] = await Promise.all([
    getUser(supabase),
    getProducts(supabase),
    getSubscription(supabase)
  ]);

  // If user is authenticated, redirect to dashboard
  if (user) {
    return redirect('/dashboard');
  }

  return (
    <div className="bg-black min-h-screen">
      {/* Welcome Section */}
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-extrabold text-white sm:text-6xl lg:text-7xl">
            Welcome to Logo Detection Project
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-xl text-zinc-300">
            Powerful AI-driven logo detection and analysis tools for your business needs.
          </p>
        </div>

        {/* Pricing Section */}
        <Pricing
          user={user}
          products={products ?? []}
          subscription={subscription}
        />
      </div>
    </div>
  );
}

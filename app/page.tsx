import Pricing from '@/components/ui/Pricing/Pricing';
import { createClient } from '@/utils/supabase/server';
import {
  getProducts,
  getSubscription,
  getUser
} from '@/utils/supabase/queries';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function HomePage() {
  const supabase = createClient();
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
      {/* Header for non-authenticated users */}
      <div className="flex justify-end p-6">
        <Link
          href="/signin"
          className="inline-flex items-center px-6 py-2 text-sm font-medium text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors duration-200"
        >
          Sign In
        </Link>
      </div>

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

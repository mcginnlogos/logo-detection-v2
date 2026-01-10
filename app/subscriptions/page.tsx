import Pricing from '@/components/ui/Pricing/Pricing';
import { createClient } from '@/utils/supabase/server';
import {
  getProducts,
  getSubscription,
  getUser
} from '@/utils/supabase/queries';
import { redirect } from 'next/navigation';

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  
  // Check authentication first, before fetching any data
  const user = await getUser(supabase);
  
  if (!user) {
    return redirect('/signin');
  }

  // Only fetch products and subscription data if user is authenticated
  const [products, subscription] = await Promise.all([
    getProducts(supabase),
    getSubscription(supabase)
  ]);

  return (
    <div className="bg-black min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Pricing
          user={user}
          products={products ?? []}
          subscription={subscription}
        />
      </div>
    </div>
  );
}
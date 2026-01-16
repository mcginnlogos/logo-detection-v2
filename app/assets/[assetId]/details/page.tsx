import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AssetDetailsClient from './AssetDetailsClient';

export default async function AssetDetailsPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const supabase = await createClient();
  const { assetId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/signin');
  }

  return <AssetDetailsClient user={user} assetId={assetId} />;
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runDailySync } from '@/pricing-engine/scheduler'

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Triggered by Vercel Cron (Authorization: Bearer <CRON_SECRET>)
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const report = await runDailySync(makeSupabase())
  return NextResponse.json(report)
}

// Triggered manually (x-sync-secret header)
export async function POST(req: NextRequest) {
  if (req.headers.get('x-sync-secret') !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const report = await runDailySync(makeSupabase())
  return NextResponse.json(report)
}

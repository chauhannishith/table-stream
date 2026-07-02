import { NextResponse } from 'next/server'
import { checkDbHealth } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = await checkDbHealth()
  if (!db.ok) {
    return NextResponse.json(
      { status: 'error', service: 'cloud-dashboard', db },
      { status: 503 },
    )
  }

  return NextResponse.json({
    status: 'ok',
    service: 'cloud-dashboard',
    db,
  })
}

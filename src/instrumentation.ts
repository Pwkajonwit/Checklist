export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startServerScheduler } = await import('@/lib/server-scheduler')
    startServerScheduler()
  }
}

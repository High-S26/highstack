export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ testmodus: !process.env.ANTHROPIC_API_KEY, speicher: process.env.DATABASE_URL ? "postgres" : "datei" });
}

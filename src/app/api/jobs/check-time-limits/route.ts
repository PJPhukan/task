import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { NotificationService } from "@/server/modules/notifications/service";
import { sendNotificationEmailsAsync } from "@/server/modules/notifications/email-sender";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing CRON_SECRET" } },
      { status: 401 }
    );
  }

  try {
    // Check all time limits and create notifications
    const notifiedCount = await NotificationService.checkTimeLimits();

    // Send pending notification emails for all projects
    // Note: We'll send emails for all projects since we don't know which ones were affected
    const projects = await (await import("@/server/lib/prisma")).prisma.project.findMany({
      where: { archivedAt: null },
      select: { id: true },
    });

    for (const project of projects) {
      try {
        await sendNotificationEmailsAsync(project.id);
      } catch (e) {
        console.error(`Error sending emails for project ${project.id}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      notifiedCount,
      message: `Checked time limits and notified ${notifiedCount} stage entries`,
    });
  } catch (error: any) {
    console.error("Error checking time limits:", error);
    return NextResponse.json(
      { error: { code: "JOBS_ERROR", message: error.message || "Failed to check time limits" } },
      { status: 500 }
    );
  }
}

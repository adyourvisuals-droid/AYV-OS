import { db } from "@/lib/db";

export async function getDashboardMetrics(organizationId: string) {
  const [
    openDeals,
    wonDealsThisMonth,
    leadsByStatus,
    dealsByStage,
    recentActivities,
    overdueTasks,
    topLeads,
  ] = await Promise.all([
    db.deal.aggregate({
      where: { organizationId, status: "OPEN" },
      _sum: { value: true },
      _count: true,
    }),
    db.deal.aggregate({
      where: {
        organizationId,
        status: "WON",
        closedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { value: true },
      _count: true,
    }),
    db.lead.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: true,
    }),
    db.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { order: "asc" },
      include: {
        _count: { select: { deals: true } },
        deals: { where: { status: "OPEN" }, select: { value: true } },
      },
    }),
    db.activity.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        lead: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
      },
    }),
    db.activity.count({
      where: {
        organizationId,
        type: { in: ["TASK", "FOLLOW_UP"] },
        status: { in: ["OPEN", "IN_PROGRESS"] },
        dueDate: { lt: new Date() },
      },
    }),
    db.lead.findMany({
      where: { organizationId, status: { not: "CONVERTED" } },
      orderBy: { score: "desc" },
      take: 5,
      select: { id: true, name: true, score: true, status: true },
    }),
  ]);

  const totalLeads = leadsByStatus.reduce((sum, group) => sum + group._count, 0);

  return {
    openDealsCount: openDeals._count,
    openPipelineValue: Number(openDeals._sum.value ?? 0),
    wonDealsThisMonthCount: wonDealsThisMonth._count,
    wonValueThisMonth: Number(wonDealsThisMonth._sum.value ?? 0),
    totalLeads,
    leadsByStatus: leadsByStatus.map((g) => ({ status: g.status, count: g._count })),
    dealsByStage: dealsByStage.map((stage) => ({
      id: stage.id,
      name: stage.name,
      count: stage._count.deals,
      value: stage.deals.reduce((sum, deal) => sum + Number(deal.value), 0),
      isWon: stage.isWon,
      isLost: stage.isLost,
    })),
    recentActivities,
    overdueTasksCount: overdueTasks,
    topLeads,
  };
}

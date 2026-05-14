import { ComingSoon } from "@/components/coming-soon";

export default function AdminDashboard() {
  return (
    <ComingSoon
      kicker="Dashboard"
      title="仪表盘"
      description="GPT Image Studio 运行概览：用户、生图、号池健康度、积分消耗趋势。"
      phase="P4"
      features={[
        "核心指标卡（总生图 / 活跃用户 / 健康账号 / 积分消耗）",
        "近 7 / 30 天趋势折线",
        "最近生图 + 最新用户 + 异常账号告警三栏",
      ]}
    />
  );
}

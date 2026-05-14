import { ComingSoon } from "@/components/coming-soon";

export default function AdminUsersPage() {
  return (
    <ComingSoon
      kicker="Users & Credits"
      title="用户与积分"
      description="合并：用户管理、卡密管理、积分流水、支付订单。"
      phase="P4"
      features={[
        "tab：用户 / 卡密批次 / 积分流水 / 支付订单",
        "用户表：状态切换 / 充值 / 手动调整积分",
        "卡密批次：批量生成 / 启停 / 导出 CSV",
        "积分流水：按类型筛选 + 用户筛选 + 导出",
      ]}
    />
  );
}

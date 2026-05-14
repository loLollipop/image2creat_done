import { AuthGuard } from "@/components/auth-guard";
import { ComingSoon } from "@/components/coming-soon";

export default function CreditsPage() {
  return (
    <AuthGuard>
      <ComingSoon
        kicker="Credits"
        title="积分中心"
        description="积分余额、签到、卡密兑换、流水查询。"
        phase="P2"
        features={["每日签到", "卡密兑换", "积分流水（注册赠送 / 签到 / 生成 / 退款 / 调整）"]}
      />
    </AuthGuard>
  );
}

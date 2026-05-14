import { ComingSoon } from "@/components/coming-soon";

export default function AdminSettingsPage() {
  return (
    <ComingSoon
      kicker="Settings"
      title="接口设置"
      description="对应原版「接口设置」+ 业务规则统一收口。"
      phase="P6"
      features={[
        "上游切换：chatgpt2api / CPA 两条预设 + 一键测试",
        "业务规则：默认积分、生成扣费、签到积分、单次最大张数",
        "注册策略：是否允许注册 / 是否需要审批",
        "管理员账户：邮箱 / 密码 / 显示名",
      ]}
    />
  );
}

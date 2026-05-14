import { ComingSoon } from "@/components/coming-soon";

export default function AdminAccountsPage() {
  return (
    <ComingSoon
      kicker="Account Pool"
      title="号池与注册机"
      description="合并：chatgpt2api 号池管理 + 自动注册机。"
      phase="P5"
      features={[
        "号池表：账号状态 / 类型 / 配额 / 批量删除 / 一键刷新",
        "注册机：模式 / 线程 / 目标配额 / 邮箱提供商，高级项默认折叠",
        "运行中实时日志面板（保留现有 patchRegisterLiveSections 等价能力）",
      ]}
    />
  );
}
